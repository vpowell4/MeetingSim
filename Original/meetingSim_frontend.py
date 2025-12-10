# meeting_ui.py
import streamlit as st
from typing import List, Dict
from meetingSim import MeetingState, summarize_meeting, visualize_conversation, agent_step
from langgraph.graph import StateGraph, END
import random

# --- Streamlit App ---
st.set_page_config(page_title="AI Meeting Simulator", layout="wide")

st.title("🤖 AI Meeting Simulator")

# --- Sidebar inputs ---
st.sidebar.header("Meeting Setup")

issue = st.sidebar.text_input("Main Issue", "Should we adopt the new policy?")
extra_issues = st.sidebar.text_area("Additional Agenda Items (one per line)", "").splitlines()

participants: List[str] = st.sidebar.text_area(
    "Participants (comma separated)", "Alice, Bob, Charlie, Dana"
).split(",")

participants = [p.strip() for p in participants if p.strip()]

# Dominance sliders
dominance: Dict[str, float] = {p: 1.0 for p in participants}
for p in participants:
    dominance[p] = st.sidebar.slider(f"Dominance: {p}", 0.5, 2.0, 1.0, 0.1)

# Initial stances
stances: Dict[str, str] = {}
for p in participants:
    stances[p] = st.sidebar.selectbox(
        f"Initial stance for {p}",
        ["for", "against", "neutral"],
        index=2
    )

# --- Helper: build LangGraph dynamically ---
def build_graph(participants: List[str]):
    graph = StateGraph(MeetingState)

    def make_node(agent: str):
        def node_fn(state: MeetingState) -> MeetingState:
            return agent_step(state, agent)
        return node_fn

    for agent in participants:
        graph.add_node(agent, make_node(agent))

    graph.set_entry_point(participants[0])  # first person = chair

    def route_next(state: MeetingState) -> str:
        if state["stage"] == "confirm" and not state["issues"]:
            return END
        if state["decision"]:  # terminate once decision is made
            return END
        candidates = [a for a in state["agents"] if a != state["last_speaker"]]
        total = sum(state["dominance"][c] for c in candidates)
        r = random.uniform(0, total)
        upto = 0
        for c in candidates:
            if upto + state["dominance"][c] >= r:
                return c
            upto += state["dominance"][c]
        return random.choice(candidates)

    for agent in participants:
        graph.add_conditional_edges(agent, route_next)

    return graph.compile()

# --- Run button ---
if st.sidebar.button("Run Meeting Simulation 🚀"):
    # Build dynamic builder
    builder = build_graph(participants)

    # Initial state
    state: MeetingState = {
        "issue": issue,
        "stage": "introduce",
        "dialogue": [],
        "agents": participants,
        "stances": stances,
        "turn": 0,
        "last_speaker": "",
        "last_responder": "",
        "decision": None,
        "chair_used": False,
        "convo_edges": [],
        "issues": extra_issues,
        "dominance": dominance,
        "stage_turns": 0,
        "actions": [],
    }

    # Run simulation
    while True:
        state = builder.invoke(state, config={"recursion_limit": 100})
        if state["decision"]:
            break

    st.success(f"✅ Final Decision: **{state['decision']}**")

    # Tabs for results
    tab1, tab2, tab3 = st.tabs(["Dialogue", "Summary", "Conversation Graph"])

    with tab1:
        st.subheader("📝 Dialogue")
        for line in state["dialogue"]:
            st.markdown(line)

    with tab2:
        st.subheader("📋 Meeting Summary")
        summary = summarize_meeting(
            dialogue=state["dialogue"],
            decision=state["decision"],
            issue=state["issue"],
            actions=state["actions"],
        )
        st.write(summary)

    with tab3:
        st.subheader("🔗 Conversation Graph")
        visualize_conversation(state)
        st.pyplot()
