import streamlit as st
from collections import deque
import meeting_sim   # your full engine file
from meeting_sim import run_meeting

# ───────────────────────────────────────────────
# STREAMLIT CONFIG
# ───────────────────────────────────────────────
st.set_page_config(page_title="AI Meeting Simulator", layout="wide")
st.title("🧠 AI-Driven Meeting Simulator")

st.sidebar.header("Configuration")
issue = st.sidebar.text_area(
    "🗂️ Issue to Discuss",
    "How can we make Product X more profitable in the UK?"
)

agents_text = st.sidebar.text_input("👥 Participants (comma-separated)", "Alice,Bob,Charlie,Dana")
agents = [a.strip() for a in agents_text.split(",") if a.strip()]

# Personas
st.sidebar.markdown("### 🧍‍♂️ Personas")
personas = {}
for a in agents:
    personas[a] = st.sidebar.text_area(
        f"{a}'s persona",
        f"{a} is a thoughtful and concise participant."
    )

run_button = st.sidebar.button("🚀 Run Simulation")

# ───────────────────────────────────────────────
# SESSION STATE INIT
# ───────────────────────────────────────────────
if "dialogue_queue" not in st.session_state:
    st.session_state.dialogue_queue = deque(maxlen=300)
if "transcript" not in st.session_state:
    st.session_state.transcript = ""

dialogue_placeholder = st.empty()
progress_placeholder = st.empty()
summary_placeholder = st.empty()
metrics_placeholder = st.empty()

# ───────────────────────────────────────────────
# HOOK: STREAM LINES TO UI
# ───────────────────────────────────────────────
def stream_to_ui(line: str):
    # keep last 10 lines only
    st.session_state.transcript += line + "\n"
    lines = st.session_state.transcript.strip().split("\n")[-10:]
    display_text = "\n".join(lines)

    # fixed-height scrollable text area
    dialogue_placeholder.text_area(
        "📡 Live Dialogue (last 10 lines)",
        value=display_text,
        height=250,   # roughly 10 lines high
        disabled=True
    )

# Monkey-patch meeting_sim broadcast_line
meeting_sim.broadcast_line = stream_to_ui

# ───────────────────────────────────────────────
# RUN SIMULATION
# ───────────────────────────────────────────────
if run_button:
    st.session_state.transcript = ""
    st.session_state.dialogue_queue.clear()
    dialogue_placeholder.text_area("📡 Live Dialogue", "", height=450)

    st.info("Running simulation... this may take a few minutes depending on LLM calls.")
    progress_placeholder.progress(0.05, text="Initializing meeting...")

    # Run the simulation
    result = run_meeting(issue=issue, agents=agents, personas=personas)

    # Show results
    st.success("✅ Meeting complete!")

    st.subheader("📜 Final Decision")
    st.info(result["decision"] or "No decision reached.")

    st.subheader("🧾 Summary")
    summary_placeholder.write(result["summary"])

    st.subheader("📊 Options Evaluated")
    st.text(result["options_summary"])

    st.subheader("📈 Metrics")
    metrics_placeholder.json({
        "turns_per_stage": dict(result["metrics"]["turns_per_stage"]),
        "turns_by_agent": dict(result["metrics"]["turns_by_agent"]),
        "actions_raised": result["metrics"]["actions_raised"],
        "options_proposed": result["metrics"]["options_proposed"],
        "votes_cast": result["metrics"]["votes_cast"]
    })

else:
    st.markdown("""
    👋 **Welcome!**
    - Enter your issue and list participants on the left.  
    - Edit personas to shape how each AI behaves.  
    - Press **Run Simulation** to watch the meeting unfold live.  
    - Dialogue will stream into the live window above.
    """)

st.markdown("---")
st.caption("Built with Streamlit · LangGraph · OpenAI · © 2025")
