"""
Real-time streaming version of the meeting simulator - without LangGraph
"""
from collections import Counter
import uuid
from .simulator import (
    MeetingState, build_options_summary, summarize_meeting, _CANCELLATION_FLAGS,
    chair_step, agent_step, summarizer_step
)


def run_meeting_streaming(
    issue: str = None,
    agents: list = None,
    goals: dict = None,
    traits: dict = None,
    dominance: dict = None,
    stances: dict = None,
    personas: dict = None,
    cancel_flag: dict = None  # {"cancelled": False}
):
    """Generator version that yields dialogue lines in real-time - simple loop without LangGraph"""
    agents = agents or ["Alice", "Bob", "Charlie", "Dana"]
    goals = goals or {}
    traits = traits or {}
    dominance = dominance or {}
    stances = stances or {}
    cancel_flag = cancel_flag or {"cancelled": False}
    
    # Register cancellation flag with unique ID
    cancel_id = str(uuid.uuid4())
    _CANCELLATION_FLAGS[cancel_id] = cancel_flag

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
        "_cancel_id": cancel_id,  # Add cancel ID to state
    }

    # Simulation loop with yielding - direct control without LangGraph
    state = initial_state
    previous_dialogue_len = 0
    
    while not cancel_flag["cancelled"]:
        # Check for cancellation before each step
        if cancel_flag["cancelled"]:
            state["decision"] = "Meeting cancelled by user"
            state["stage"] = "confirm"
            break
        
        # Run chair step
        state = chair_step(state)
        
        # Yield any new dialogue
        if len(state["dialogue"]) > previous_dialogue_len:
            for line in state["dialogue"][previous_dialogue_len:]:
                yield {"type": "dialogue", "line": line}
            previous_dialogue_len = len(state["dialogue"])
        
        # Check if meeting should end
        if state.get("decision") or state.get("stage") == "confirm":
            break
        
        # Run each agent step
        for agent in agents:
            if cancel_flag["cancelled"]:
                state["decision"] = "Meeting cancelled by user"
                state["stage"] = "confirm"
                break
                
            state = agent_step(state, agent)
            
            # Yield any new dialogue after each agent
            if len(state["dialogue"]) > previous_dialogue_len:
                for line in state["dialogue"][previous_dialogue_len:]:
                    yield {"type": "dialogue", "line": line}
                previous_dialogue_len = len(state["dialogue"])
            
            # Check if meeting should end
            if state.get("decision") or state.get("stage") == "confirm":
                break
        
        # If cancelled during agent loop, exit
        if cancel_flag["cancelled"] or state.get("decision") or state.get("stage") == "confirm":
            break
        
        # Run summarizer step
        state = summarizer_step(state)
        
        # Yield any new dialogue
        if len(state["dialogue"]) > previous_dialogue_len:
            for line in state["dialogue"][previous_dialogue_len:]:
                yield {"type": "dialogue", "line": line}
            previous_dialogue_len = len(state["dialogue"])
        
        # Check if meeting should end after summarizer
        if state.get("decision") or state.get("stage") == "confirm":
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
    
    # Clean up cancellation flag
    if cancel_id in _CANCELLATION_FLAGS:
        del _CANCELLATION_FLAGS[cancel_id]
    
    # Yield final result
    yield {
        "type": "final",
        "decision": state["decision"],
        "summary": summary,
        "options_summary": opt_summary,
        "metrics": state["metrics"],
        "cancelled": cancel_flag["cancelled"]
    }
