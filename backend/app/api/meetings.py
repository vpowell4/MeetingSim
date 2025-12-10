"""Meeting API endpoints with SSE streaming"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import json
import asyncio
from datetime import datetime
import logging

from app.db.session import get_db
from app.models.database import User, Meeting, MeetingMinutes
from app.models.schemas import (
    MeetingCreate, MeetingResponse, MeetingDetail,
    DialogueLine, MeetingFinal, AgentConfig
)
from app.utils.auth import get_current_active_user
from app.core.simulator import run_meeting
from app.core.simulator_streaming import run_meeting_streaming

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
def create_meeting(
    meeting_data: MeetingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new meeting simulation"""
    # Create meeting record
    db_meeting = Meeting(
        user_id=current_user.id,
        title=meeting_data.title,
        issue=meeting_data.issue,
        context=meeting_data.context,
        agents_config=[agent.model_dump() for agent in meeting_data.agents],
        conditions=meeting_data.conditions.model_dump() if meeting_data.conditions else None,
        status="pending"
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    
    return db_meeting


@router.get("", response_model=List[MeetingResponse])
def get_meetings(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all meetings for current user"""
    meetings = (
        db.query(Meeting)
        .filter(Meeting.user_id == current_user.id)
        .order_by(Meeting.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return meetings


@router.get("/{meeting_id}", response_model=MeetingDetail)
def get_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get meeting details"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    if meeting.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this meeting"
        )
    
    return {
        **meeting.__dict__,
        "dialogue": meeting.dialogue or [],
        "agents": meeting.agents_config or [],
        "conditions": meeting.conditions,
        "context": meeting.context
    }


@router.put("/{meeting_id}", response_model=MeetingDetail)
def update_meeting(
    meeting_id: int,
    meeting_update: MeetingCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update meeting configuration (agents, title, issue)"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    if meeting.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this meeting"
        )
    
    # Don't allow updating while running
    if meeting.status == "running":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update meeting while it's running"
        )
    
    # Update fields if provided
    if meeting_update.title:
        meeting.title = meeting_update.title
    if meeting_update.issue:
        meeting.issue = meeting_update.issue
    if meeting_update.agents:
        meeting.agents_config = [agent.model_dump() for agent in meeting_update.agents]
    
    db.commit()
    db.refresh(meeting)
    
    return {
        **meeting.__dict__,
        "dialogue": meeting.dialogue or [],
        "agents": meeting.agents_config or []
    }


@router.get("/{meeting_id}/stream")
async def stream_meeting(
    meeting_id: int,
    token: str,
    db: Session = Depends(get_db)
):
    """Stream meeting simulation in real-time using SSE"""
    # Authenticate user from token query parameter (EventSource doesn't support headers)
    from app.utils.auth import get_user_from_token
    current_user = get_user_from_token(token, db)
    
    # Get meeting
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    if meeting.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this meeting"
        )
    
    # Allow rerunning completed meetings by resetting dialogue and status
    if meeting.status == "completed" or meeting.status == "cancelled":
        meeting.dialogue = []
        meeting.decision = None
        meeting.summary = None
        meeting.status = "pending"
        meeting.completed_at = None
        db.commit()
    
    async def event_generator():
        """Generate SSE events for meeting simulation"""
        try:
            # Update meeting status to running
            meeting.status = "running"
            db.commit()
            
            # Prepare agents configuration
            agents_list = [agent['name'] for agent in meeting.agents_config]
            personas_dict = {agent['name']: agent['persona'] for agent in meeting.agents_config}
            stances_dict = {agent['name']: agent['stance'] for agent in meeting.agents_config}
            dominance_dict = {agent['name']: agent['dominance'] for agent in meeting.agents_config}
            traits_dict = {agent['name']: agent['traits'] for agent in meeting.agents_config}
            goals_dict = {}  # Using default goals for now
            
            # Create cancellation flag (shared dict for thread safety)
            cancel_flag = {"cancelled": False}
            
            # Store cancel_flag in meeting for stop endpoint access
            if not hasattr(stream_meeting, 'active_simulations'):
                stream_meeting.active_simulations = {}
            stream_meeting.active_simulations[meeting_id] = cancel_flag
            
            dialogue_lines = []
            final_result = None
            
            # Stream simulation results in real-time
            for event in run_meeting_streaming(
                meeting.issue,
                agents_list,
                goals_dict,
                traits_dict,
                dominance_dict,
                stances_dict,
                personas_dict,
                cancel_flag
            ):
                # Check if client disconnected
                if cancel_flag["cancelled"]:
                    break
                    
                try:
                    if event["type"] == "dialogue":
                        line = event["line"]
                        dialogue_lines.append(line)
                        event_data = DialogueLine(line=line)
                        yield f"data: {event_data.model_dump_json()}\n\n"
                        await asyncio.sleep(0.01)  # Small delay to prevent overwhelming
                    elif event["type"] == "final":
                        final_result = event
                        final_data = MeetingFinal(
                            decision=event.get("decision"),
                            summary=event.get("summary", "Meeting completed."),
                            options_summary=event.get("options_summary", ""),
                            metrics=event.get("metrics", {})
                        )
                        yield f"data: {final_data.model_dump_json()}\n\n"
                except (GeneratorExit, ConnectionError, BrokenPipeError):
                    # Client disconnected - cancel the simulation
                    logger.info(f"Client disconnected from meeting {meeting_id} stream")
                    cancel_flag["cancelled"] = True
                    break
            
            # Update meeting in database
            meeting.dialogue = dialogue_lines
            if final_result:
                meeting.decision = final_result.get("decision")
                meeting.summary = final_result.get("summary")
                meeting.options_summary = final_result.get("options_summary")
                meeting.metrics = final_result.get("metrics")
                meeting.status = "cancelled" if final_result.get("cancelled") else "completed"
            else:
                meeting.status = "cancelled"
            
            meeting.completed_at = datetime.utcnow()
            db.commit()
            
            # Create meeting minutes if completed successfully
            if meeting.status == "completed" and final_result:
                minutes = MeetingMinutes(
                    meeting_id=meeting.id,
                    user_id=meeting.user_id,
                    title=meeting.title,
                    issue=meeting.issue,
                    decision=meeting.decision,
                    summary=meeting.summary,
                    full_transcript=meeting.dialogue,
                    participants=[agent['name'] for agent in meeting.agents_config],
                    options_discussed=meeting.options_summary,
                    metrics=meeting.metrics,
                    meeting_date=meeting.completed_at
                )
                db.add(minutes)
                db.commit()
            
            # Clean up
            if meeting_id in stream_meeting.active_simulations:
                del stream_meeting.active_simulations[meeting_id]
            
        except (ConnectionError, BrokenPipeError) as e:
            logger.info(f"Connection closed for meeting {meeting_id}: {e}")
            meeting.status = "cancelled"
            db.commit()
            if meeting_id in getattr(stream_meeting, 'active_simulations', {}):
                del stream_meeting.active_simulations[meeting_id]
        except Exception as e:
            logger.error(f"Error in meeting simulation: {e}", exc_info=True)
            meeting.status = "failed"
            db.commit()
            
            try:
                error_event = {"type": "error", "message": str(e)}
                yield f"data: {json.dumps(error_event)}\n\n"
            except:
                pass  # Client already disconnected
            
            # Clean up
            if meeting_id in getattr(stream_meeting, 'active_simulations', {}):
                del stream_meeting.active_simulations[meeting_id]
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a meeting"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    if meeting.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this meeting"
        )
    
    db.delete(meeting)
    db.commit()
    
    return None


@router.post("/{meeting_id}/stop")
def stop_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Stop a running meeting simulation"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    if meeting.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to stop this meeting"
        )
    
    # Set cancellation flag if simulation is active
    if hasattr(stream_meeting, 'active_simulations') and meeting_id in stream_meeting.active_simulations:
        stream_meeting.active_simulations[meeting_id]["cancelled"] = True
        return {"message": "Meeting simulation stopped"}
    else:
        # If not currently streaming, just update status
        meeting.status = "cancelled"
        db.commit()
        return {"message": "Meeting marked as cancelled"}
