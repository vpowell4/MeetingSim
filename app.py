# app.py
from fastapi import FastAPI, Body
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import os
import asyncio
import json
import meetingSim
from meetingSim import run_meeting

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

# Active SSE subscribers (each is an asyncio.Queue)
subscribers: list[asyncio.Queue] = []


def broadcast_line(line: str) -> None:
    """Push a new line to all active subscribers."""
    for queue in list(subscribers):  # iterate over copy
        try:
            queue.put_nowait(line)
        except asyncio.QueueFull:
            # If the queue is full, drop the line instead of blocking
            pass


# Patch meetingSim’s broadcast hook so that simulation lines are streamed out
meetingSim.broadcast_line = broadcast_line


@app.on_event("startup")
async def startup_event():
    host = os.getenv("HOST", "127.0.0.1")
    port = os.getenv("PORT", "8000")
    print(f"\n🚀 Meeting Simulator running at: http://{host}:{port}\n")


@app.get("/")
def index():
    return FileResponse("static/index.html")


# @app.post("/run")
# def run_meeting_api(payload: dict = Body(...)):
#     """
#     Run the simulation in blocking mode and return all results in one JSON.
#     """
#     issue = payload.get("issue")
#     agents = payload.get("agents", ["Alice", "Bob", "Charlie", "Dana"])
#     stances = payload.get("stances", {})
#     goals = payload.get("goals", {})
#     traits = payload.get("traits", {})
#     dominance = payload.get("dominance", {})

#     return run_meeting(
#         issue=issue,
#         agents=agents,
#         stances=stances,
#         goals=goals,
#         traits=traits,
#         dominance=dominance,
#     )

@app.get("/run/stream")
async def run_meeting_stream(
    issue: str,
    agents: str,
    stances: str = "{}",
    goals: str = "{}",
    traits: str = "{}",
    dominance: str = "{}",
    personas: str = "{}"
):
    """
    Run the meeting simulation and stream dialogue lines via Server-Sent Events (SSE).
    """
    agents_list = agents.split(",") if agents else ["Alice", "Bob", "Charlie", "Dana"]

    stances = json.loads(stances)
    goals = json.loads(goals)
    traits = json.loads(traits)
    dominance = json.loads(dominance)
    personas = json.loads(personas)

    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()
        subscribers.append(queue)

        try:
            loop = asyncio.get_event_loop()
            future = loop.run_in_executor(
                None,
                lambda: run_meeting(
                    issue=issue,
                    agents=agents_list,
                    stances=stances,
                    goals=goals,
                    traits=traits,
                    dominance=dominance,
                    personas=personas
                ),
            )

            # Stream dialogue lines
            while True:
                if future.done() and queue.empty():
                    break

                try:
                    line = await asyncio.wait_for(queue.get(), timeout=0.5)
                    yield f"data: {json.dumps({'type': 'line', 'line': line})}\n\n"
                except asyncio.TimeoutError:
                    if future.done():
                        break
                    continue

            # After meeting is done, send summary + metrics
            state = await future
            end_payload = {
                "type": "final",
                "decision": state["decision"],
                "summary": state["summary"],
                "metrics": state["metrics"],
                "options_summary": state["options_summary"],
            }
            yield f"data: {json.dumps(end_payload)}\n\n"

        finally:
            if queue in subscribers:
                subscribers.remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
