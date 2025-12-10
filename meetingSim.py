from typing import List, Dict, Optional, Tuple, Any
from collections import Counter
import random
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END, START

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
    next_stage: Optional[str] = None
    action_item: Optional[str] = None
    option_proposal: Optional[str] = None
    option_ref: Optional[str] = None
    option_vote: Optional[str] = None  # "support" | "oppose" | "abstain"
    option_comment: Optional[str] = None
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
    personas: Dict[str,str]
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


def chair_step(state: MeetingState) -> MeetingState:
    stage = state["stage"]
    issue = state["issue"]
    goal = STAGE_GOALS[stage]

    # --- Stage control logic ---
    max_turns = {"introduce": 6, "clarify": 6, "discuss": 8,
                 "options": 6, "evaluate": 6, "decide": 4, "confirm": 2}

    # If too many turns in this stage → advance
    if state["stage_turns"] >= max_turns.get(stage, 6):
        state["dialogue"].append(
            f"[{stage}] CHAIR (Alice): We've had enough contributions here. Let's move on."
        )
        advance_stage(state)
        return state

    # If consensus already reached → advance
    if stage not in ("decide", "confirm"):
        if len(set(state["stances"].values())) == 1 and state["stances"]:
            state["dialogue"].append(
                f"[{stage}] CHAIR (Alice): It looks like we have consensus. Let's move forward."
            )
            advance_stage(state)
            return state

    # In DECIDE stage → force a decision if needed
    if stage == "decide" and not state["decision"]:
        oid = best_option(state)
        if oid:
            opt = state["options"][oid]
            state["decision"] = f"{oid}: {opt['text']}"
            state["dialogue"].append(
                f"[decide] CHAIR (Alice): Based on the votes, we'll adopt {oid} — supporters={len(opt['supporters'])}, "
                f"opponents={len(opt['opponents'])}, abstainers={len(opt['abstainers'])}."
            )
        else:
            # fallback to majority stance
            counts = Counter(state["stances"].values())
            decision = max(counts, key=counts.get)
            state["decision"] = decision
            state["dialogue"].append(
                f"[decide] CHAIR (Alice): We don’t have a clear option, so I’m calling it: decision = {decision}."
            )
        advance_stage(state, "confirm")
        return state

    # In CONFIRM stage → wrap up
    if stage == "confirm":
        state["dialogue"].append(
            f"[confirm] CHAIR (Alice): Thank you everyone. The meeting is concluded. Final decision: {state['decision']}."
        )
        return state

    # --- Otherwise, provide guidance ---
    chair_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    prompt = f"""
    You are the Chair (Alice).
    Current stage: {stage}
    Goal: {goal}
    Issue: {issue}

    Transcript so far (last 6 turns):
    {" | ".join(state['dialogue'][-6:])}

    Start with Introducing the Issue and asking one of the attendees their thoughts our questions
    Give a short chair instruction (1–2 sentences) that pushes attendees closer to the goal of this stage.
    Always be working to get the team to proceed towards the Goal for the Current Stage
    Don't repeat yourself
    Be firm, fair and direct
    """
    response = chair_llm.invoke(prompt).content

    line = f"[{stage}] CHAIR (Alice): {response}"
    state["dialogue"].append(line)
    broadcast_line(line)

    # bookkeeping
    state["last_speaker"] = "Alice"
    state["stage_turns"] += 1
    state["turn"] += 1

    return state

def summarizer_step(state: MeetingState) -> MeetingState:
    # running summary to keep context
    recent = "\n".join(state["dialogue"][-12:])
    prompt = f"Summarize briefly the last part of the meeting:\n{recent}"
    summary = summary_llm.invoke(prompt).content
    state["dialogue"].append(f"[{state['stage']}] (Summary) {summary}")
    return state



# =============================
# ====== LLM CLIENT HELPERS ===
# =============================

def llm_for_stage(stage: str) -> ChatOpenAI:
    return ChatOpenAI(model="gpt-4o-mini", temperature=TEMP_BY_STAGE.get(stage, 0.5))

summary_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

def call_structured_llm(stage: str, context: dict) -> MeetingTurn:
    """Call LLM and parse into MeetingTurn, with fallback on failure."""
    try:
        print("LLM Invoked, ",datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        llm = llm_for_stage(stage)
        structured_llm = llm.with_structured_output(MeetingTurn, method="function_calling")
        response = structured_llm.invoke(context)
        print("LLM Response, ",datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        return response
    except Exception as e:
        print("⚠️ LLM parse error:", e)
        # fallback: create a minimal safe turn
        return MeetingTurn(
            asker=context.get("agent", "Unknown"),
            responder=random.choice(context.get("agents", ["Agent"])),
            question=context.get("issue", "Clarify?"),
            message="Sorry, I didn’t quite catch that — let’s move on.",
            reaction="accept",
            next_stage=stage,  # ✅ keep flow moving
        )

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
# ======== BROADCAST HOOK =====
# =============================

def broadcast_line(line: str) -> None:
    """
    Hook to broadcast a dialogue line to the frontend (e.g., via SSE).
    Default: no-op (can be monkeypatched or replaced in web server).
    """
    pass


# =============================
# ========= AGENT STEP ========
# =============================
def agent_step(state: MeetingState, agent: str) -> MeetingState:
    stage = state["stage"]
    issue = state["issue"]

    # --- Memory + persona context ---
    stage_brief = STAGE_TEMPLATES[stage]
    persona = state["personas"].get(agent, "Neutral style.")
    last_n, open_qs, options_brief = build_memory_pack(state, N=6)
    memory_brief = f"Last lines: {last_n[-400:] if last_n else ''} | " \
                   f"Unresolved: {open_qs} | Options: {options_brief}"

    # --- Plan the speech act ---
    plan = plan_step(stage, agent, persona, stage_brief, memory_brief)

    # --- Generate candidate turn ---
    context = f"""
    Agent: {agent}
    Persona: {persona}

    Stage: {stage} → Goal: {STAGE_GOALS[stage]}
    Stage micro-brief: {stage_brief}
    Chosen speech act: {plan.speech_act}
    Objective: {plan.objective}

    Issue: {issue}
    Agents: {', '.join(state['agents'])}

    Recent dialogue (last {min(6, len(state['dialogue']))} turns):
    {last_n}

    Unresolved questions: {open_qs}
    Options on table: {options_brief}

    Behavior Rules:
    - Match your speech act and stage brief.
    - Keep it short (≤2 sentences unless 'discuss').
    - Do not impersonate the chair.
    - don't ask duplicate or similar questions
    - Build on the discussion answering questions, or adding to the discussions to progress the Stage Goal
    """

    parsed = call_structured_llm(stage, context)
    parsed = sanitize_turn(parsed, state, agent)

    # --- Log dialogue ---
    stage_tag = f"[{stage}]"
    q_line = f"{stage_tag} {parsed.asker} asks {parsed.responder}: {parsed.question}"
    a_line = f"{stage_tag} {parsed.responder}: {parsed.message}"
    r_line = f"{stage_tag} {parsed.asker} reacts: {parsed.reaction}"
    state["dialogue"].extend([q_line, a_line, r_line])
    for line in (q_line, a_line, r_line):
        print(line)
        broadcast_line(line)

    # --- Episodic memory ---
    episodic_log(state, stage, parsed.asker, "question", parsed.question)
    episodic_log(state, stage, parsed.responder, "response", parsed.message)
    episodic_log(state, stage, parsed.asker, "reaction", parsed.reaction)

    # --- Options and votes ---
    if parsed.option_proposal:
        register_option(state, parsed.option_proposal, parsed.responder)
    if parsed.option_vote:
        vote_option(state, voter=parsed.responder,
                    option_ref=parsed.option_ref,
                    vote=parsed.option_vote,
                    comment=parsed.option_comment)

    # --- Persuasion / affinity updates ---
    if parsed.reaction == "accept":
        log_interaction(state, parsed.asker, parsed.responder, +1)
        update_affinity(state, parsed.asker, parsed.responder, +0.1)
    elif parsed.reaction.startswith(("decline", "reject")):
        log_interaction(state, parsed.asker, parsed.responder, -1)
        update_affinity(state, parsed.asker, parsed.responder, -0.1)

    # --- Metrics + bookkeeping ---
    state["metrics"]["turns_per_stage"][stage] += 1
    state["metrics"]["turns_by_agent"][parsed.asker] += 1
    state["metrics"]["turns_by_agent"][parsed.responder] += 1
    state["convo_edges"].append({
        "from": parsed.asker, "to": parsed.responder,
        "stage": stage, "question": parsed.question,
        "response": parsed.message, "reaction": parsed.reaction,
    })

    state["last_speaker"] = parsed.asker
    state["last_responder"] = parsed.responder
    state["turn"] += 1
    state["stance_history"].append(dict(state["stances"]))

    return state

# =============================
# ======= GRAPH/ROUTING =======
# =============================

def build_graph(agents: list[str]):
    graph = StateGraph(MeetingState)

    # Chair node
    graph.add_node("chair", chair_step)

    # Attendees
    for agent in agents:
        graph.add_node(agent, lambda s, agent=agent: agent_step(s, agent))

    # Summarizer
    graph.add_node("summarizer", summarizer_step)

    # Flow: chair → each agent → summarizer → chair
    graph.add_edge(START, "chair")
    graph.add_edge("chair", agents[0])

    for i, agent in enumerate(agents):
        nxt = agents[i + 1] if i + 1 < len(agents) else "summarizer"
        graph.add_edge(agent, nxt)

    graph.add_conditional_edges("summarizer", route_after_summary)

    return graph.compile()


def route_after_summary(state: MeetingState) -> str:
    # After summarizer, either move to next stage (chair) or END
    if state["stage"] == "confirm" or state["decision"]:
        return END
    return "chair"


def route_next(state: MeetingState) -> str:
    if state["stage"] == "confirm" or state["decision"]:
        return END
    candidates = [a for a in state["agents"] if a != state["last_speaker"]]
    recent = state.get("recent_pairs", [])
    counts = {a: sum(1 for x in recent[-12:] if x[0] == a or x[1] == a) for a in candidates}
    return min(candidates, key=lambda a: (counts[a], state["dominance"].get(a, 1.0)))

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

def run_meeting(
    issue: str = None,
    agents: list = None,
    goals: dict = None,
    traits: dict = None,
    dominance: dict = None,
    stances: dict = None,
    personas: dict = None 
) -> dict:
    agents = agents or ["Alice", "Bob", "Charlie", "Dana"]
    goals = goals or {}
    traits = traits or {}
    dominance = dominance or {}
    stances = stances or {}

    # Ensure every agent has defaults
    personas = personas or {}
    for agent in agents:
        if agent not in goals:
            goals[agent] = {
                "cost": 0.5, "risk": 0.5, "speed": 0.5,
                "fairness": 0.5, "innovation": 0.5, "consensus": 0.5,
            }
        if agent not in traits:
            traits[agent] = {
                "interrupt": 0.2, "conflict_avoid": 0.5, "persuasion": 0.5,
            }
        if agent not in dominance:
            dominance[agent] = 1.0
        stances[agent] = "neutral"   
        
    # Build affinity
    affinity = {a: {b: 0.0 for b in agents} for a in agents}

    # Initialize meeting state
    initial_state: MeetingState = {
        "issue": issue or "How can I make product X in the UK more profitable ?",
        "stage": "introduce",
        "dialogue": [],
        "agents": agents,
        "stances": {a: "neutral" for a in agents},
        "turn": 0,
        "last_speaker": "",
        "last_responder": "",
        "decision": None,
        "chair_used": False,
        "convo_edges": [],
        "personas": personas,
        "dominance": dominance,
        "stage_turns": 0,
        "actions": [],
        "goals": goals,
        "traits": traits,
        "stances": stances,
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
        "recent_pairs": [],
        "question_seen": set(),
        "interruptions_this_stage": 0,
        "accepts_this_stage": 0,
    }

    # Simulation loop
    meeting_model = build_graph(agents)    
    state = initial_state
    
    while True:
        state = meeting_model.invoke(state, config={"recursion_limit": 100})
        if state["decision"] or state["stage"] == "confirm":
            break

    # Build summaries
    opt_summary = build_options_summary(state)
    summary = summarize_meeting(
        dialogue=state["dialogue"],
        decision=state["decision"],
        issue=state["issue"],
        actions=state["actions"],
        options_summary=opt_summary,
    )

    return {
        "decision": state["decision"],
        "dialogue": state["dialogue"],
        "summary": summary,
        "metrics": state["metrics"],
        "options_summary": opt_summary,
    }