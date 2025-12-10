# meeting_sim_refactored.py

from typing import List, Dict, Optional
from collections import Counter
import random
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END, START

# ======================================================
# ===================== CONSTANTS ======================
# ======================================================

STAGES = ["introduce", "clarify", "discuss", "options", "evaluate", "decide", "confirm"]
SPEECH_ACTS = {
  "introduce": ["concern", "hope"],
  "clarify": ["question"],
  "discuss": ["argument", "counterargument"],
  "options": ["propose_option"],
  "evaluate": ["compare", "weigh"],
  "decide": ["recommend", "commit", "ask_missing_fact"],
  "confirm": ["summarize", "check-consent"],
}
TEMP_BY_STAGE = {
    "introduce": 0.6, "clarify": 0.3, "discuss": 0.7,
    "options": 0.8, "evaluate": 0.4, "decide": 0.3, "confirm": 0.2
}
STAGE_GOALS = {
    "introduce": "Raise initial opinions and concerns about the issue.",
    "clarify": "Clarify misunderstandings or ambiguous points.",
    "discuss": "Debate the pros and cons openly.",
    "options": "Generate possible options for action.",
    "evaluate": "Evaluate the strengths and weaknesses of the options.",
    "decide": "Make a decision, aiming for consensus or majority.",
    "confirm": "Confirm the decision and wrap up the discussion."
}
STAGE_TEMPLATES = {
    "introduce": "Be concise (≤2 sentences). Raise 1–2 distinct concerns or hopes.",
    "clarify": "Ask 1 pointed question or resolve a single ambiguity.",
    "discuss": "Offer 1 pro and 1 con; if responding, briefly STEELMAN the prior point.",
    "options": "Propose 1 option with 1 implementation detail.",
    "evaluate": "Compare 2 options with 2 criteria (cost, risk, speed, fairness).",
    "decide": "State a preference and 1 justification; if undecided, ask 1 missing fact.",
    "confirm": "Restate the decision and 1 action item; check for final objections."
}

# ======================================================
# ===================== DATA MODELS ====================
# ======================================================

class MeetingTurn(BaseModel):
    asker: str
    question: str
    responder: str
    message: str
    reaction: str

class PlanSpec(BaseModel):
    speech_act: str
    objective: str
    @field_validator("speech_act", mode="before")
    def lower(cls, v): return str(v).lower()

# ======================================================
# ==================== LLM HELPERS =====================
# ======================================================

def llm_for_stage(stage: str) -> ChatOpenAI:
    return ChatOpenAI(model="gpt-4o-mini", temperature=TEMP_BY_STAGE.get(stage, 0.5))

summary_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

def make_stage_prompt(stage: str, issue: str, dialogue: list[str], goal: str) -> str:
    last_lines = "\n".join(dialogue[-6:])
    return (
        f"You are the Chair (Alice). Stage: {stage}. Goal: {goal}. Issue: {issue}.\n"
        f"Transcript so far:\n{last_lines}\n\n"
        "Give one short instruction or question to guide the team to the stage goal. "
        "Keep it concise (≤2 sentences). Don't allow duplicate questions."
    )

def make_agent_context(agent: str, stage: str, state: dict, plan: PlanSpec) -> dict:
    last_lines = "\n".join(state["dialogue"][-6:])
    persona = state["personas"][agent]
    return {
        "agent": agent,
        "stage": stage,
        "issue": state["issue"],
        "persona": persona,
        "objective": plan.objective,
        "agents": state["agents"],
        "dialogue": last_lines,
    }

# ======================================================
# ===================== UTILITIES ======================
# ======================================================

def broadcast_line(line: str):
    print(line)

def advance_stage(state: dict, next_stage: Optional[str] = None):
    idx = STAGES.index(state["stage"])
    state["stage"] = next_stage or (STAGES[min(idx + 1, len(STAGES) - 1)])
    state["stage_turns"] = 0

def best_option(state: dict) -> Optional[str]:
    if not state["options"]:
        return None
    scored = [(len(info["supporters"]) - len(info["opponents"]), oid) for oid, info in state["options"].items()]
    scored.sort(reverse=True)
    return scored[0][1] if scored else None

# ======================================================
# ==================== CHAIR STEPS =====================
# ======================================================

def chair_should_advance(stage: str, stage_turns: int) -> bool:
    max_turns = {
        "introduce": 6, "clarify": 6, "discuss": 8,
        "options": 6, "evaluate": 6, "decide": 4, "confirm": 2
    }
    return stage_turns >= max_turns.get(stage, 6)

def handle_stage_completion(state: dict) -> None:
    stage = state["stage"]
    if stage == "decide" and not state["decision"]:
        oid = best_option(state)
        if oid:
            opt = state["options"][oid]
            msg = f"[decide] CHAIR (Alice): We'll adopt {oid}: {opt['text']}"
            state["decision"] = f"{oid}: {opt['text']}"
        else:
            msg = "[decide] CHAIR (Alice): No consensus reached. We'll record that."
        broadcast_line(msg)
        state["dialogue"].append(msg)
        advance_stage(state, "confirm")
        return

    if stage == "confirm":
        msg = f"[confirm] CHAIR (Alice): Meeting concluded. Final decision: {state['decision']}."
        broadcast_line(msg)
        state["dialogue"].append(msg)

def chair_prompt_next(state: dict) -> str:
    stage, issue = state["stage"], state["issue"]
    goal = STAGE_GOALS[stage]
    prompt = make_stage_prompt(stage, issue, state["dialogue"], goal)
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    return llm.invoke(prompt).content

def chair_step(state: dict) -> dict:
    stage = state["stage"]
    if chair_should_advance(stage, state["stage_turns"]):
        msg = f"[{stage}] CHAIR (Alice): We've had enough contributions here. Let's move on."
        broadcast_line(msg)
        state["dialogue"].append(msg)
        advance_stage(state)
        return state

    handle_stage_completion(state)
    if stage == "confirm":
        return state

    resp = chair_prompt_next(state)
    line = f"[{stage}] CHAIR (Alice): {resp}"
    broadcast_line(line)
    state["dialogue"].append(line)
    state["stage_turns"] += 1
    return state

# ======================================================
# ==================== AGENT STEPS =====================
# ======================================================

def plan_agent_action(stage: str, agent: str, persona: str, stage_brief: str, memory: str) -> PlanSpec:
    planner = ChatOpenAI(model="gpt-4o-mini", temperature=0.4)
    acts = SPEECH_ACTS.get(stage, ["statement"])
    prompt = (
        f"Agent {agent} persona: {persona}\nStage: {stage}\nStage brief: {stage_brief}\n"
        f"Recent: {memory}\nPick one act from {acts} and an objective. JSON: {{speech_act, objective}}"
    )
    parser = planner.with_structured_output(PlanSpec, method="function_calling")
    return parser.invoke(prompt)

def call_structured_llm(stage: str, context: dict) -> MeetingTurn:
    try:
        llm = llm_for_stage(stage)
        structured = llm.with_structured_output(MeetingTurn, method="function_calling")
        prompt_text = "\n".join(f"{k}: {v}" for k, v in context.items())
        return structured.invoke(prompt_text)
    except Exception:
        return MeetingTurn(
            asker=context.get("agent", "Unknown"),
            responder=random.choice(context.get("agents", ["Agent"])),
            question=context.get("issue", "Clarify?"),
            message="Let's move on.",
            reaction="accept",
        )

def render_turn_lines(stage: str, parsed: MeetingTurn) -> list[str]:
    return [
        f"[{stage}] {parsed.asker} asks {parsed.responder}: {parsed.question}",
        f"[{stage}] {parsed.responder}: {parsed.message}",
        f"[{stage}] {parsed.asker} reacts: {parsed.reaction}",
    ]

def agent_step(state: dict, agent: str) -> dict:
    stage = state["stage"]
    persona = state["personas"][agent]
    stage_brief = STAGE_TEMPLATES[stage]
    memory = "\n".join(state["dialogue"][-6:])

    plan = plan_agent_action(stage, agent, persona, stage_brief, memory)
    ctx = make_agent_context(agent, stage, state, plan)
    parsed = call_structured_llm(stage, ctx)

    for line in render_turn_lines(stage, parsed):
        broadcast_line(line)
        state["dialogue"].append(line)

    state["turn"] += 1
    state["stage_turns"] += 1
    return state

# ======================================================
# ==================== GRAPH LOGIC =====================
# ======================================================

def route_after_chair(state: dict) -> str:
    if state["stage"] == "confirm" or state.get("decision"):
        return END
    return state["agents"][0]

def build_graph(agents: list[str]):
    graph = StateGraph(dict)
    graph.add_node("chair", chair_step)
    for a in agents:
        graph.add_node(a, lambda s, agent=a: agent_step(s, agent))
    graph.add_edge(START, "chair")
    graph.add_edge("chair", agents[0])
    for i, a in enumerate(agents):
        nxt = agents[i + 1] if i + 1 < len(agents) else "chair"
        graph.add_edge(a, nxt)
    graph.add_conditional_edges("chair", route_after_chair)
    return graph.compile()

# ======================================================
# ==================== RUN MEETING =====================
# ======================================================

def init_meeting_state(issue: str, agents: list[str], personas: dict[str, str]) -> dict:
    return {
        "issue": issue,
        "stage": "introduce",
        "dialogue": [],
        "agents": agents,
        "personas": personas,
        "turn": 0,
        "stage_turns": 0,
        "decision": None,
        "options": {},
        "metrics": {"turns_per_stage": Counter(), "turns_by_agent": Counter(),
                    "actions_raised": 0, "options_proposed": 0, "votes_cast": 0}
    }

def summarize_meeting(state: dict) -> str:
    issue = state["issue"]
    decision = state.get("decision", "None")
    dialogue = "\n".join(state["dialogue"][-60:])
    prompt = f"Summarize this meeting:\nIssue: {issue}\nDecision: {decision}\nTranscript:\n{dialogue}\n"
    return summary_llm.invoke(prompt).content

def run_meeting(issue: str, agents: list[str], personas: dict[str, str]) -> dict:
    state = init_meeting_state(issue, agents, personas)
    meeting_graph = build_graph(agents)

    while True:
        state = meeting_graph.invoke(state)
        if state["stage"] == "confirm" or state.get("decision"):
            break

    summary = summarize_meeting(state)
    return {"decision": state["decision"], "dialogue": state["dialogue"],
            "summary": summary, "metrics": state["metrics"], "options_summary": "N/A"}
