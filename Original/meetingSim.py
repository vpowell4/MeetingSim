# meeting_sim_refactored.py
# — A refactored, single-file version with clearer structure & the same behavior —

from typing import List, Dict, Optional, Tuple, Any
from collections import Counter
import random
import math

import matplotlib.pyplot as plt
import networkx as nx
from pydantic import BaseModel, Field, field_validator
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END


# =============================
# ========= CONSTANTS =========
# =============================

STAGES = ["introduce", "clarify", "discuss", "options", "evaluate", "decide", "confirm"]
STANCE_ORDER = ["against", "neutral", "for"]
CRITERIA = ["cost", "risk", "speed", "fairness", "innovation", "consensus"]
NON_PERSON_MAP = {"all", "everyone", "team", "group", "committee", "room"}
VALID_REACTIONS = {"accept", "reject+propose", "decline"}

TEMP_BY_STAGE = {
    "introduce": 0.6, "clarify": 0.3, "discuss": 0.7, "options": 0.8,
    "evaluate": 0.4, "decide": 0.3, "confirm": 0.2
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
    "clarify":   "Ask 1 pointed question or resolve a single ambiguity. Avoid restating prior questions.",
    "discuss":   "Offer 1 pro and 1 con. If responding to a prior point, briefly STEELMAN it first.",
    "options":   "Propose 1 concrete option with a short label; include 1 specific implementation detail.",
    "evaluate":  "Compare 2 options with 2 criteria (cost, risk, speed, fairness). If group is one-sided, play devil’s advocate once.",
    "decide":    "State a preference and 1 justification; if undecided, ask for 1 missing fact.",
    "confirm":   "Restate the decision and 1 action item; check for final objections (yes/no).",
}

AGENT_PERSONAS = {
    "Alice":  "Chair; brisk, diplomatic, outcome-oriented. Prefers structure.",
    "Bob":    "Finance-minded; cost/risk focused; skeptical but pragmatic.",
    "Charlie":"Consensus-seeker; careful with language; asks for evidence.",
    "Dana":   "Innovation-first; optimistic; pushes for bold options.",
}

SPEECH_ACTS = {
  "introduce": ["concern", "hope"],
  "clarify":   ["question"],
  "discuss":   ["argument", "counterargument", "steelman"],
  "options":   ["propose_option"],
  "evaluate":  ["compare", "weigh", "devils_advocate"],
  "decide":    ["recommend", "commit", "ask_missing_fact"],
  "confirm":   ["summarize", "check-consent"],
}

QUALITY_CHECKLIST = """
Before finalizing, ensure:
- It adds a NEW point vs last 6 turns.
- It matches the Stage micro-brief.
- If proposing an option: label + 1 concrete detail.
- If evaluating: compare at least 2 criteria briefly.
- ≤2 sentences unless 'discuss' stage.
"""


# =============================
# ========= DATA MODELS =======
# =============================

class MeetingTurn(BaseModel):
    asker: str
    question: str
    responder: str
    message: str
    reaction: str
    stance_updates: Dict[str, str] = Field(default_factory=dict)
    chair_decision: Optional[str] = None
    end_stage: bool = False
    next_stage: str
    action_item: Optional[str] = None
    # Options API
    option_proposal: Optional[str] = None
    option_ref: Optional[str] = None
    option_vote: Optional[str] = None  # "support" | "oppose" | "abstain"
    option_comment: Optional[str] = None
    # Negotiation hook
    negotiation_offer: Optional[str] = None

class PlanSpec(BaseModel):
    speech_act: str
    objective: str

    @field_validator("speech_act", mode="before")
    def validate_act(cls, v):
        return str(v).strip().lower()

class CriticScore(BaseModel):
    novelty: float = Field(ge=0.0, le=1.0)
    stage_fit: float = Field(ge=0.0, le=1.0)
    usefulness: float = Field(ge=0.0, le=1.0)
    overall: float = Field(ge=0.0, le=1.0)

class OptionEval(BaseModel):
    cost: float = Field(ge=0.0, le=1.0)
    risk: float = Field(ge=0.0, le=1.0)
    speed: float = Field(ge=0.0, le=1.0)
    fairness: float = Field(ge=0.0, le=1.0)
    innovation: float = Field(ge=0.0, le=1.0)
    consensus: float = Field(ge=0.0, le=1.0)

class MeetingState(Dict):
    # core
    issue: str
    stage: str
    dialogue: List[str]
    agents: List[str]
    stances: Dict[str, str]
    turn: int
    last_speaker: str
    last_responder: str
    decision: Optional[str]
    chair_used: bool
    convo_edges: List[Dict]
    dominance: Dict[str, float]
    stage_turns: int
    actions: List[str]
    # memory
    goals: Dict[str, Dict[str, float]]
    traits: Dict[str, Dict[str, float]]
    interaction_history: Dict[Tuple[str, str], List[Dict[str, int]]]
    affinity: Dict[str, Dict[str, float]]
    episodic: List[Dict]
    # options
    options: Dict[str, Dict]
    option_counter: int
    # metrics
    stance_history: List[Dict[str, str]]
    metrics: Dict[str, Any]
    # dialogue quality
    recent_pairs: List[Tuple[str, str]]
    question_seen: set
    interruptions_this_stage: int
    accepts_this_stage: int


# =============================
# ====== LLM CLIENT HELPERS ===
# =============================

def llm_for_stage(stage: str) -> ChatOpenAI:
    return ChatOpenAI(model="gpt-4o-mini", temperature=TEMP_BY_STAGE.get(stage, 0.5))

summary_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

def call_structured_llm(stage: str, context: str) -> MeetingTurn:
    llm = llm_for_stage(stage)
    structured_llm = llm.with_structured_output(MeetingTurn, method="function_calling")
    return structured_llm.invoke(context)

def plan_step(stage: str, agent: str, persona: str, stage_brief: str, memory_brief: str) -> PlanSpec:
    planner = ChatOpenAI(model="gpt-4o-mini", temperature=0.4)
    acts = SPEECH_ACTS.get(stage, ["statement"])
    prompt = f"""You are planning a SHORT meeting utterance.
Agent: {agent} ({persona})
Stage: {stage}
Stage brief: {stage_brief}
Recent context: {memory_brief}

Choose one speech act from {acts} and write a one-line objective for the utterance.
Return JSON with: speech_act, objective."""
    parser = planner.with_structured_output(PlanSpec, method="function_calling")
    return parser.invoke(prompt)

def critic_score(stage: str, persona: str, stage_brief: str, candidate_message: str, recent_texts: List[str]) -> float:
    critic = ChatOpenAI(model="gpt-4o-mini", temperature=0.0)
    prompt = f"""You are a meeting dialogue critic. Rate the following candidate (0..1) on novelty, stage-fit, and usefulness, and give an overall 0..1.
Stage: {stage}
Persona: {persona}
Stage brief: {stage_brief}
Recent lines: {' | '.join(recent_texts[-6:])}
Candidate: {candidate_message}
Return strict JSON with keys: novelty, stage_fit, usefulness, overall (0..1)."""
    parser = critic.with_structured_output(CriticScore, method="function_calling")
    sc: CriticScore = parser.invoke(prompt)
    return max(0.0, min(1.0, sc.overall))


# =============================
# ======= SANITIZATION ========
# =============================

def coerce_agent(name: str, state: MeetingState) -> str:
    if not name:
        return "Alice"
    low = str(name).strip().lower()
    if low in NON_PERSON_MAP:
        return "Alice"
    for a in state["agents"]:
        if low == a.lower():
            return a
    return "Alice"

def pick_alternate(agent: str, state: MeetingState) -> str:
    others = [a for a in state["agents"] if a != agent]
    return random.choice(others) if others else agent

def normalize_reaction(r: str) -> str:
    if not r:
        return "accept"
    rl = r.strip().lower()
    if rl in VALID_REACTIONS:
        return rl
    if rl.startswith(("acknowled", "agree", "yes")):
        return "accept"
    if rl.startswith(("reject", "counter", "propos")):
        return "reject+propose"
    if rl.startswith(("decline", "no", "disagree")):
        return "decline"
    return "accept"

def valid_next_stage(s: str) -> str:
    return s if s in STAGES else "discuss"

def sanitize_turn(parsed: MeetingTurn, state: MeetingState, caller_agent: str) -> MeetingTurn:
    parsed.asker = coerce_agent(parsed.asker or caller_agent, state)
    parsed.responder = coerce_agent(parsed.responder or pick_alternate(parsed.asker, state), state)
    if parsed.asker == parsed.responder:
        parsed.responder = pick_alternate(parsed.asker, state)
    parsed.reaction = normalize_reaction(parsed.reaction)
    parsed.next_stage = valid_next_stage(parsed.next_stage or state["stage"])
    if not (parsed.message or "").strip():
        parsed.message = "Noted."
    return parsed


# =============================
# ======== STATE HELPERS ======
# =============================

def reset_stage_counters(state: MeetingState) -> None:
    state["interruptions_this_stage"] = 0
    state["question_seen"] = set()
    state["accepts_this_stage"] = 0

def advance_stage(state: MeetingState, next_stage: Optional[str] = None) -> None:
    idx = STAGES.index(state["stage"])
    state["stage"] = next_stage if next_stage in STAGES else (STAGES[idx + 1] if idx + 1 < len(STAGES) else STAGES[-1])
    state["stage_turns"] = 0
    reset_stage_counters(state)

def half_life_decay(delta_turns: int, half_life: int = 12) -> float:
    if delta_turns <= 0:
        return 1.0
    return 0.5 ** (delta_turns / max(1, half_life))

def decayed_support_bias(state: MeetingState, listener: str, speaker: str) -> float:
    hist = state["interaction_history"].get((listener, speaker), [])
    if not hist:
        return 0.0
    now = state["turn"]
    num = den = 0.0
    for ev in hist[-80:]:
        w = half_life_decay(now - ev["turn"], half_life=12)
        num += w * ev["val"]
        den += w
    return 0.0 if den == 0 else max(-1.0, min(1.0, num / den))

def _toward(a: str, b: str) -> str:
    if a == b:
        return a
    ai, bi = STANCE_ORDER.index(a), STANCE_ORDER.index(b)
    return STANCE_ORDER[ai + (1 if bi > ai else -1)]

def _align_score(agent_goals: Dict[str, float], target: str) -> float:
    g = agent_goals
    if target == "for":
        return 0.6 * g.get("innovation", 0) + 0.4 * g.get("speed", 0)
    if target == "against":
        return 0.6 * g.get("risk", 0) + 0.4 * g.get("cost", 0)
    return 0.5 * g.get("consensus", 0) + 0.5 * g.get("fairness", 0)

def persuasion_probability(sp_traits, li_traits, dom_sp, align, affinity_ls) -> float:
    base = 0.15
    p = (base
         + 0.35 * sp_traits.get("persuasion", 0)
         + 0.25 * min(1.0, dom_sp / 1.5)
         + 0.20 * align
         + 0.25 * max(-0.5, min(0.5, affinity_ls))
         - 0.20 * li_traits.get("conflict_avoid", 0))
    return max(0.02, min(0.9, p))

def update_affinity(state: MeetingState, src: str, dst: str, delta: float) -> None:
    cur = state["affinity"][src].get(dst, 0.0)
    state["affinity"][src][dst] = max(-1.0, min(1.0, cur * 0.9 + delta * 0.1))

def log_interaction(state: MeetingState, listener: str, speaker: str, val: int) -> None:
    state["interaction_history"].setdefault((listener, speaker), []).append({"turn": state["turn"], "val": val})

def episodic_log(state: MeetingState, stage: str, speaker: str, kind: str, text: str, meta: Dict = None) -> None:
    state["episodic"].append({
        "turn": state["turn"], "stage": stage, "speaker": speaker,
        "kind": kind, "text": text, "meta": meta or {}
    })

def build_memory_pack(state: MeetingState, N: int = 6) -> Tuple[str, str, str]:
    last = state["dialogue"][-N:]
    unresolved = [d for d in last if "?" in d][-2:]
    opts = []
    for oid, info in state.get("options", {}).items():
        s = len(info["supporters"]); o = len(info["opponents"]); a = len(info["abstainers"])
        opts.append(f"{oid}:{info['text']} (by {info['proposer']}) S={s}/O={o}/A={a}")
    return "\n".join(last), "\n".join(unresolved) or "None", "\n".join(opts) or "None"

def score_candidate_heuristic(text: str, stage: str, recent_texts: List[str]) -> float:
    t = text.lower()
    overlap_penalty = 0.0
    for r in recent_texts[-6:]:
        if not r:
            continue
        rlow = r.lower()
        overlap_penalty += 0.02 * sum(1 for w in t.split() if w in rlow)
    specificity = 0.05 * sum(ch.isdigit() for ch in t) + 0.03 * len([w for w in t.split() if len(w) > 6])
    wants = {
        "clarify": ["how", "what", "when", "why", "clarify", "specifically"],
        "options": ["option", "we could", "plan", "proposal"],
        "evaluate": ["pros", "cons", "tradeoff", "criterion", "risk", "cost"],
        "decide": ["prefer", "decide", "choose", "recommend"],
    }
    fit = 0.1 * sum(kw in t for kw in wants.get(stage, []))
    return max(0.0, 1.0 + specificity + fit - overlap_penalty)


# =============================
# ========== OPTIONS ==========
# =============================

def _norm(s: str) -> str:
    return " ".join(s.lower().strip().split())

def new_option_id(state: MeetingState) -> str:
    state["option_counter"] += 1
    return f"O{state['option_counter']}"

def evaluate_option_attributes(text: str) -> Dict[str, float]:
    analyst = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    prompt = f"""Rate this option on 0..1 (higher is better) for: cost (affordability), risk (safety), speed, fairness, innovation, consensus likelihood.
Return strict JSON with keys: cost, risk, speed, fairness, innovation, consensus.
Option: {text}"""
    parser = analyst.with_structured_output(OptionEval, method="function_calling")
    ev: OptionEval = parser.invoke(prompt)
    return ev.dict()

def register_option(state: MeetingState, text: str, proposer: str) -> str:
    norm = _norm(text)
    for oid, info in state["options"].items():
        if _norm(info["text"]) == norm:
            state["dialogue"].append(f"[{state['stage']}] (duplicate) Referencing existing {oid}: {info['text']}")
            info["supporters"].add(proposer)
            episodic_log(state, state["stage"], proposer, "vote", "support", {"id": oid, "comment": "proposer implicit support"})
            return oid
    oid = new_option_id(state)
    attrs = evaluate_option_attributes(text)
    state["options"][oid] = {
        "text": text.strip(),
        "proposer": proposer,
        "supporters": {proposer},
        "opponents": set(),
        "abstainers": set(),
        "first_stage": state["stage"],
        "first_turn": state["turn"],
        "attributes": attrs,
    }
    state["metrics"]["options_proposed"] += 1
    state["dialogue"].append(f"[{state['stage']}] OPTION PROPOSED {oid} by {proposer}: {text.strip()}")
    episodic_log(state, state["stage"], proposer, "option", text.strip(), {"id": oid, "attrs": attrs})
    return oid

def resolve_option_ref(state: MeetingState, option_ref: Optional[str]) -> Optional[str]:
    if option_ref and option_ref in state["options"]:
        return option_ref
    if state["options"]:
        return sorted(state["options"].keys(), key=lambda k: int(k[1:]))[-1]
    return None

def vote_option(state: MeetingState, voter: str, option_ref: Optional[str], vote: str, comment: Optional[str]) -> None:
    oid = resolve_option_ref(state, option_ref)
    if not oid:
        state["dialogue"].append(f"[{state['stage']}] (vote ignored) No option available to vote on.")
        return
    info = state["options"][oid]
    info["supporters"].discard(voter)
    info["opponents"].discard(voter)
    info["abstainers"].discard(voter)
    if vote == "support": info["supporters"].add(voter)
    elif vote == "oppose": info["opponents"].add(voter)
    else: info["abstainers"].add(voter)
    state["metrics"]["votes_cast"] += 1
    msg = f"[{state['stage']}] VOTE {voter} -> {oid}: {vote.upper()}"
    if comment: msg += f" — {comment}"
    state["dialogue"].append(msg)
    episodic_log(state, state["stage"], voter, "vote", vote, {"id": oid, "comment": comment or ""})

def best_option(state: MeetingState) -> Optional[str]:
    if not state["options"]:
        return None
    scored = []
    for oid, info in state["options"].items():
        score = len(info["supporters"]) - len(info["opponents"])
        sp = len(info["supporters"])
        scored.append((score, sp, -info["first_turn"], oid))
    scored.sort(reverse=True)
    return scored[0][-1] if scored else None

def agent_weights_from_goals(goals: Dict[str, float]) -> Dict[str, float]:
    w = {
        "cost": goals.get("cost", 0.3),
        "risk": goals.get("risk", 0.3),
        "speed": goals.get("speed", 0.3),
        "fairness": goals.get("fairness", 0.2),
        "innovation": goals.get("innovation", 0.2),
        "consensus": goals.get("consensus", 0.2),
    }
    s = sum(w.values()) or 1.0
    return {k: v/s for k, v in w.items()}

def utility_for(agent: str, state: MeetingState, oid: str) -> float:
    weights = agent_weights_from_goals(state["goals"][agent])
    attrs = state["options"][oid].get("attributes", {})
    return sum(weights[c] * attrs.get(c, 0.5) for c in CRITERIA)

def auto_vote_for_agent(state: MeetingState, agent: str) -> None:
    if not state["options"]:
        return
    oid = resolve_option_ref(state, None)
    if not oid:
        return
    info = state["options"][oid]
    if agent in (info["supporters"] | info["opponents"] | info["abstainers"]):
        return
    u = utility_for(agent, state, oid)
    proposer = info["proposer"]
    aff = state["affinity"][agent].get(proposer, 0.0)
    u_adj = u + 0.05 * aff
    vote = "support" if u_adj >= 0.55 else ("oppose" if u_adj <= 0.45 else "abstain")
    vote_option(state, voter=agent, option_ref=oid, vote=vote, comment=None)


# =============================
# ========= AGENT STEP ========
# =============================

def agent_step(state: MeetingState, agent: str) -> MeetingState:
    stage = state["stage"]
    issue = state["issue"]

    # stage housekeeping
    state["stage_turns"] = 0 if state["stage_turns"] == 0 else state["stage_turns"]
    state["stage_turns"] += 1

    if state["stage_turns"] > 10:
        state["dialogue"].append(f"[{stage}] CHAIR (Alice): We've spent enough time here, let's move on.")
        advance_stage(state)
        return state

    if state["turn"] > 40:
        state["dialogue"].append(f"[{stage}] Time’s up! Chair forces decision.")
        state["stage"] = "decide"
        reset_stage_counters(state)
        return state

    # memory prompt pack
    stage_brief = STAGE_TEMPLATES[stage]
    persona = AGENT_PERSONAS.get(agent, "Neutral style.")
    last_n, open_qs, options_brief = build_memory_pack(state, N=6)
    memory_brief = f"Last lines: {last_n[-400:] if last_n else ''} | Unresolved: {open_qs} | Options: {options_brief}"

    # plan
    plan = plan_step(stage, agent, persona, stage_brief, memory_brief)

    # context
    context = f"""
Agent: {agent}
Persona: {persona}

Stage: {stage} → Goal: {STAGE_GOALS[stage]}
Stage micro-brief: {stage_brief}
Chosen speech act: {plan.speech_act}
Objective: {plan.objective}

Issue: {issue}
Agents: {', '.join(state['agents'])}

Recent dialogue (last {min(6,len(state['dialogue']))} turns):
{last_n}

Unresolved questions: {open_qs}
Options on table: {options_brief}

Behavior Rules:
- Choose content that fits the chosen speech act and objective.
- Avoid repeating a question from the last 6 turns.
- Prefer NEW content; if repeating, add a genuinely new angle.
- Follow the Stage micro-brief.
- ACTION items must be explicit (e.g., 'ACTION: Bob to ...').
- Set `asker` and `responder` to EXACTLY ONE name from: {', '.join(state['agents'])}. Do NOT use 'all' or 'everyone'.

Options Protocol (IMPORTANT):
- In 'options'/'discuss', if suggesting a concrete plan, set `option_proposal` to a short label.
- In 'evaluate'/'decide', you may cast a vote: `option_vote` = "support" | "oppose" | "abstain".
- When voting, set `option_ref` if you know the id (e.g., "O1"); else leave blank (most recent).
- If voting, you may add `option_comment` (optional).

Quality checklist:
{QUALITY_CHECKLIST}
"""

    # candidates + critic
    K = 3
    candidates = [call_structured_llm(stage, context) for _ in range(K)]
    recent_texts = state["dialogue"][-6:]
    scored = []
    for c in candidates:
        h = score_candidate_heuristic(c.message, stage, recent_texts)
        cr = critic_score(stage, persona, stage_brief, c.message, recent_texts)
        scored.append((0.7 * h + 0.3 * cr, c))
    parsed = max(scored, key=lambda x: x[0])[1]

    # sanitize
    parsed = sanitize_turn(parsed, state, agent)

    # dedup questions
    dup_key = (stage, parsed.asker, parsed.question.strip().lower())
    if dup_key in state["question_seen"]:
        state["dialogue"].append(f"[{stage}] CHAIR (Alice): That’s been asked already—let’s move forward.")
        advance_stage(state)
        return state
    state["question_seen"].add(dup_key)

    # interruptions
    interrupter = None
    if parsed.responder != agent and state["interruptions_this_stage"] < 2:
        candidates_int = [a for a in state["agents"] if a not in {agent, parsed.responder}]
        if candidates_int:
            cand = random.choice(candidates_int)
            itrait = state["traits"][cand].get("interrupt", 0.0)
            neg_aff = max(0.0, -state["affinity"][cand].get(parsed.responder, 0.0))
            stage_base = {"introduce": 0.04, "clarify": 0.05, "discuss": 0.16, "options": 0.12, "evaluate": 0.16, "decide": 0.08, "confirm": 0.02}[stage]
            interrupt_prob = min(0.65, stage_base + 0.45 * itrait + 0.25 * neg_aff)
            if random.random() < interrupt_prob:
                interrupter = cand
                state["interruptions_this_stage"] += 1
                state["dialogue"].append(f"[{stage}] (INTERRUPTION) {interrupter} cuts in while {parsed.responder} is speaking!")
                state["dialogue"].append(f"[{stage}] CHAIR (Alice): Let's take one at a time, please.")
                state["metrics"]["interruptions"] += 1

    # action items
    if parsed.action_item:
        if parsed.action_item not in state["actions"]:
            state["actions"].append(parsed.action_item)
            state["dialogue"].append(f"[{stage}] ACTION RAISED: {parsed.action_item}")
            episodic_log(state, stage, agent, "action", parsed.action_item)
            state["metrics"]["actions_raised"] = len(state["actions"])
        advance_stage(state)
        return state

    # style & log
    emotion = random.choice(["(hesitant)", "(enthusiastic)", "(frustrated)", "(calm)"])
    msg = parsed.message if random.choice([True, False]) else (parsed.message.split(".")[0] if "." in parsed.message else parsed.message)
    if random.choice([False, True]) and stage != "confirm":
        msg = msg if msg.endswith("...") else (msg + " Let me expand a bit more on that point...")

    stage_tag = f"[{stage}]"
    q_line = f"{stage_tag} {parsed.asker} asks {parsed.responder}: {parsed.question}"
    a_line = f"{stage_tag} {parsed.responder} responds {emotion}: {msg}"
    r_line = f"{stage_tag} {parsed.asker} reacts: {parsed.reaction}"
    state["dialogue"].extend([q_line, a_line, r_line])
    print(q_line); print(a_line); print(r_line)

    episodic_log(state, stage, parsed.asker, "question", parsed.question)
    episodic_log(state, stage, parsed.responder, "response", msg)
    episodic_log(state, stage, parsed.asker, "reaction", parsed.reaction)
    if parsed.negotiation_offer:
        state["dialogue"].append(f"{stage_tag} NEGOTIATION OFFER: {parsed.negotiation_offer}")
        episodic_log(state, stage, parsed.responder, "negotiation", parsed.negotiation_offer)

    # metrics
    state["metrics"]["turns_per_stage"][stage] += 1
    state["metrics"]["turns_by_agent"][parsed.asker] += 1
    state["metrics"]["turns_by_agent"][parsed.responder] += 1

    # graph edge + pairs
    state["convo_edges"].append({
        "from": parsed.asker, "to": parsed.responder, "stage": stage,
        "question": parsed.question, "response": msg, "reaction": parsed.reaction,
    })
    state.setdefault("recent_pairs", []).append((parsed.asker, parsed.responder))
    if len(state["recent_pairs"]) > 50:
        state["recent_pairs"] = state["recent_pairs"][-50:]

    # stance updates
    for k, v in parsed.stance_updates.items():
        if v in STANCE_ORDER:
            state["stances"][k] = v

    # reaction → memory
    reaction = parsed.reaction.lower()
    if reaction.startswith("accept"):
        state["accepts_this_stage"] += 1
        log_interaction(state, parsed.asker, parsed.responder, +1)
        update_affinity(state, parsed.asker, parsed.responder, +0.12)
    else:
        state["accepts_this_stage"] = max(0, state["accepts_this_stage"] - 1)
        if reaction.startswith(("decline", "reject")):
            log_interaction(state, parsed.asker, parsed.responder, -1)
            update_affinity(state, parsed.asker, parsed.responder, -0.12)

    # accept spam control
    if state["accepts_this_stage"] >= 4 and stage in ("discuss", "options", "evaluate"):
        state["dialogue"].append(f"[{stage}] CHAIR (Alice): Let's hear a counterpoint before we proceed.")
        state["accepts_this_stage"] = 0

    # options
    if parsed.option_proposal:
        register_option(state, parsed.option_proposal, parsed.responder)
    if parsed.option_vote:
        vote_option(state, voter=parsed.responder, option_ref=parsed.option_ref, vote=parsed.option_vote, comment=parsed.option_comment)

    # auto-vote in evaluate/decide
    if stage in ("evaluate", "decide") and state["options"]:
        for a in state["agents"]:
            auto_vote_for_agent(state, a)

    # persuasion
    speaker = parsed.responder
    sp_target = state["stances"].get(speaker, "neutral")
    sp_traits = state["traits"].get(speaker, {})
    sp_dom = state["dominance"].get(speaker, 1.0)

    def maybe_shift(listener: str):
        if listener == speaker:
            return
        listener_goals = state["goals"][listener]
        listener_traits = state["traits"][listener]
        align = _align_score(listener_goals, sp_target)
        aff = state["affinity"][listener].get(speaker, 0.0)
        bias = decayed_support_bias(state, listener, speaker)
        p = persuasion_probability(sp_traits, listener_traits, sp_dom, align, aff)
        p = max(0.02, min(0.95, p * (1 + 0.25 * bias)))
        if random.random() < p:
            old = state["stances"][listener]
            new = _toward(old, sp_target)
            if new != old:
                state["stances"][listener] = new
                state["dialogue"].append(f"{stage_tag} ({listener} seems swayed toward {new} after {speaker}'s response.)")
                update_affinity(state, listener, speaker, +0.06)
        else:
            update_affinity(state, listener, speaker, -0.02)

    maybe_shift(parsed.asker)
    if interrupter:
        maybe_shift(interrupter)

    # chair override
    if parsed.chair_decision:
        state["dialogue"].append(f"{stage_tag} CHAIR DECISION: {parsed.chair_decision}")
        state["chair_used"] = True

    # stage transitions
    if len(set(state["stances"].values())) == 1:
        state["dialogue"].append(f"{stage_tag} Consensus reached → moving to next stage.")
        advance_stage(state)
    elif parsed.end_stage and parsed.next_stage in STAGES:
        advance_stage(state, parsed.next_stage)

    # bookkeeping
    state["last_speaker"] = parsed.asker
    state["last_responder"] = parsed.responder
    state["turn"] += 1
    state["stance_history"].append(dict(state["stances"]))

    # decision
    if state["stage"] == "decide" and not state["decision"]:
        oid = best_option(state) if state["options"] else None
        if oid:
            opt = state["options"][oid]
            state["decision"] = f"{oid}: {opt['text']}"
            state["dialogue"].append(
                f">>> DECISION: Adopt {oid} — supporters={len(opt['supporters'])}, "
                f"opponents={len(opt['opponents'])}, abstainers={len(opt['abstainers'])}"
            )
        else:
            counts = {s: 0 for s in ["for", "against", "neutral"]}
            for v in state["stances"].values():
                counts[v] += 1
            state["decision"] = max(counts, key=counts.get)
            state["dialogue"].append(f">>> DECISION (fallback): {state['decision']}")

    return state


# =============================
# ======= GRAPH/ROUTING =======
# =============================

graph = StateGraph(MeetingState)

def make_node(agent: str):
    def node_fn(state: MeetingState) -> MeetingState:
        return agent_step(state, agent)
    return node_fn

for agent in ["Alice", "Bob", "Charlie", "Dana"]:
    graph.add_node(agent, make_node(agent))

graph.set_entry_point("Alice")

def route_next(state: MeetingState) -> str:
    if state["stage"] == "confirm" or state["decision"]:
        return END
    candidates = [a for a in state["agents"] if a != state["last_speaker"]]
    recent = state.get("recent_pairs", [])
    counts = {a: sum(1 for x in recent[-12:] if x[0] == a or x[1] == a) for a in candidates}
    return min(candidates, key=lambda a: (counts[a], state["dominance"].get(a, 1.0)))

for agent in ["Alice", "Bob", "Charlie", "Dana"]:
    graph.add_conditional_edges(agent, route_next)

builder = graph.compile()


# =============================
# ======== VIS + SUMMARY ======
# =============================

def visualize_conversation(state: MeetingState) -> None:
    G = nx.MultiDiGraph()
    for edge in state["convo_edges"]:
        label = f"{edge['question']} → {edge['response']} ({edge['reaction']})"
        G.add_edge(edge["from"], edge["to"], label=label, stage=edge["stage"])
    pos = nx.spring_layout(G, seed=42)
    plt.figure(figsize=(12, 8))
    nx.draw(G, pos, with_labels=True, node_size=3000, node_color="lightblue", arrows=True)
    edge_labels = {(u, v, k): d["label"] for u, v, k, d in G.edges(keys=True, data=True)}
    plt.tight_layout()
    nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels, font_size=7)
    plt.title("Messy Meeting Conversation Graph")
    plt.show()

def build_options_summary(state: MeetingState) -> str:
    if not state["options"]:
        return "No explicit options were proposed."
    lines = []
    for oid, info in sorted(state["options"].items(), key=lambda item: int(item[0][1:])):
        a = info.get("attributes", {})
        lines.append(
            f"{oid}: {info['text']} (by {info['proposer']}; "
            f"S={len(info['supporters'])}, O={len(info['opponents'])}, A={len(info['abstainers'])}; "
            f"cost={a.get('cost',0):.2f}, risk={a.get('risk',0):.2f}, speed={a.get('speed',0):.2f}, "
            f"fair={a.get('fairness',0):.2f}, innov={a.get('innovation',0):.2f}, cons={a.get('consensus',0):.2f})"
        )
    return "\n".join(lines)

def summarize_meeting(dialogue: List[str], decision: str, issue: str, actions: List[str], options_summary: str) -> str:
    context = f"""
You are a helpful meeting assistant. Summarize the following meeting:

Issue discussed: {issue}
Final decision: {decision}
Options overview:
{options_summary}

Actions raised: {actions if actions else "None"}

Meeting dialogue:
{chr(10).join(dialogue)}

Guidelines:
- Provide a concise narrative of how the conversation unfolded.
- Highlight the main concerns, options discussed, and key tradeoffs.
- Emphasize the role of the chair (Alice) in directing the discussion.
- List all actions clearly at the end.
- End with the final decision.
"""
    return summary_llm.invoke(context).content

def print_metrics(state: MeetingState) -> None:
    m = state["metrics"]
    print("\n=== METRICS ===")
    print("Turns per stage:", dict(m["turns_per_stage"]))
    talk = m["turns_by_agent"]
    denom = sum(talk.values()) or 1
    print("Talk share by agent:", {k: round(v/denom, 3) for k, v in talk.items()})
    print("Interruptions:", m["interruptions"])
    print("Action items:", m["actions_raised"])
    print("Options proposed:", m["options_proposed"])
    print("Votes cast:", m["votes_cast"])
    if state["options"]:
        for oid, info in state["options"].items():
            a = info.get("attributes", {})
            print(f" - {oid}: {info['text']} | by={info['proposer']} | "
                  f"S={len(info['supporters'])} O={len(info['opponents'])} A={len(info['abstainers'])} | "
                  f"attrs={ {k: round(a.get(k,0),2) for k in CRITERIA} }")
    if state["stance_history"]:
        print("Final stances:", state["stance_history"][-1])
    snap = {a: {b: round(v, 2) for b, v in state["affinity"][a].items()} for a in state["affinity"]}
    print("Affinity snapshot (−1..+1):", snap)


# =============================
# =========== MAIN ============
# =============================

if __name__ == "__main__":
    goals = {
        "Alice":  {"speed": 0.8, "consensus": 0.7, "fairness": 0.6, "risk": 0.2},
        "Bob":    {"cost": 0.8, "risk": 0.7, "speed": 0.3},
        "Charlie":{"consensus": 0.8, "fairness": 0.7, "risk": 0.4},
        "Dana":   {"innovation": 0.9, "speed": 0.7, "cost": 0.2},
    }
    traits = {
        "Alice":  {"interrupt": 0.2,  "conflict_avoid": 0.3, "persuasion": 0.7},
        "Bob":    {"interrupt": 0.5,  "conflict_avoid": 0.2, "persuasion": 0.6},
        "Charlie":{"interrupt": 0.05, "conflict_avoid": 0.8, "persuasion": 0.4},
        "Dana":   {"interrupt": 0.25, "conflict_avoid": 0.3, "persuasion": 0.65},
    }
    agents = ["Alice", "Bob", "Charlie", "Dana"]
    affinity = {a: {b: (0.0 if a != b else 0.0) for b in agents} for a in agents}

    initial_state: MeetingState = {
        "issue": "How can the war in Ukrane be resolved given Russia appears to be untrustworthy in disucssions, how could this affect the rest of Europe",
        "stage": "introduce",
        "dialogue": [],
        "agents": agents,
        "stances": {"Alice": "for", "Bob": "against", "Charlie": "neutral", "Dana": "for"},
        "turn": 0,
        "last_speaker": "",
        "last_responder": "",
        "decision": None,
        "chair_used": False,
        "convo_edges": [],
        "dominance": {"Alice": 1.0, "Bob": 1.5, "Charlie": 0.7, "Dana": 1.2},
        "stage_turns": 0,
        "actions": [],
        # memory + options + metrics
        "goals": goals,
        "traits": traits,
        "interaction_history": {},
        "affinity": affinity,
        "episodic": [],
        "options": {},
        "option_counter": 0,
        "stance_history": [],
        "metrics": {
            "turns_per_stage": Counter(),
            "turns_by_agent": Counter(),
            "interruptions": 0,
            "actions_raised": 0,
            "options_proposed": 0,
            "votes_cast": 0,
        },
        # dialogue quality
        "recent_pairs": [],
        "question_seen": set(),
        "interruptions_this_stage": 0,
        "accepts_this_stage": 0,
    }

    state = initial_state
    while True:
        state = builder.invoke(state, config={"recursion_limit": 100})
        if state["decision"] or state["stage"] == "confirm":
            break

    print("\n=== FINAL DECISION ===")
    print(state["decision"])

    print("\n--- DIALOGUE ---")
    for line in state["dialogue"]:
        print(line)

    opt_summary = build_options_summary(state)
    summary = summarize_meeting(
        dialogue=state["dialogue"],
        decision=state["decision"],
        issue=state["issue"],
        actions=state["actions"],
        options_summary=opt_summary,
    )
    print("\n=== MEETING SUMMARY ===")
    print(summary)

    print_metrics(state)
    visualize_conversation(state)
