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
from app.models.database import User, Meeting, MeetingMinutes, MeetingShare
from app.models.schemas import (
    MeetingCreate, MeetingResponse, MeetingDetail,
    DialogueLine, MeetingFinal, AgentConfig,
    MeetingShareCreate, MeetingShareResponse, MeetingResponseWithSharing
)
from app.utils.auth import get_current_active_user
from app.utils.permissions import PermissionChecker
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


@router.get("", response_model=List[MeetingResponseWithSharing])
def get_meetings(
    skip: int = 0,
    limit: int = 100,
    filter: str = "active",  # active, archived, all
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all meetings for current user (owned + shared)"""
    # Get owned meetings with filter
    owned_query = db.query(Meeting).filter(Meeting.user_id == current_user.id)
    
    if filter == "archived":
        owned_query = owned_query.filter(Meeting.is_archived == True)
    elif filter == "active":
        owned_query = owned_query.filter(Meeting.is_archived == False)
    
    owned_meetings = owned_query.all()
    
    # Get shared meetings
    shared_query = (
        db.query(Meeting, MeetingShare, User)
        .join(MeetingShare, Meeting.id == MeetingShare.meeting_id)
        .join(User, Meeting.user_id == User.id)
        .filter(MeetingShare.shared_with_user_id == current_user.id)
    )
    
    shared_results = shared_query.all()
    
    # Build response list
    meetings_response = []
    
    # Add owned meetings
    for meeting in owned_meetings:
        meetings_response.append({
            **meeting.__dict__,
            "is_shared": False,
            "is_owner": True,
            "shared_by": None,
            "is_archived": meeting.is_archived
        })
    
    # Add shared meetings
    for meeting, share, owner in shared_results:
        # Apply filter for shared meetings
        if filter == "archived" and not share.is_archived:
            continue
        if filter == "active" and share.is_archived:
            continue
            
        meetings_response.append({
            **meeting.__dict__,
            "is_shared": True,
            "is_owner": False,
            "shared_by": owner.email,
            "is_archived": share.is_archived
        })
    
    # Sort by created_at desc
    meetings_response.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
    
    # Apply pagination
    return meetings_response[skip:skip+limit]


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
    
    # Check if user owns the meeting OR has shared access
    is_owner = meeting.user_id == current_user.id
    
    if not is_owner:
        # Check if meeting is shared with this user
        share = db.query(MeetingShare).filter(
            MeetingShare.meeting_id == meeting_id,
            MeetingShare.shared_with_user_id == current_user.id
        ).first()
        
        if not share:
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
    
    # Check if user owns the meeting OR has shared access
    is_owner = meeting.user_id == current_user.id
    
    if not is_owner:
        # Check if meeting is shared with this user
        share = db.query(MeetingShare).filter(
            MeetingShare.meeting_id == meeting_id,
            MeetingShare.shared_with_user_id == current_user.id
        ).first()
        
        if not share:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this meeting"
            )
        
        # Shared users cannot re-run meetings, only view
        if meeting.status == "completed" or meeting.status == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the owner can re-run a meeting"
            )
    
    # Allow rerunning completed meetings (owner only)
    if is_owner and (meeting.status == "completed" or meeting.status == "cancelled"):
        meeting.dialogue = []
        meeting.decision = None
        meeting.summary = None
        meeting.status = "pending"
        meeting.completed_at = None
        db.commit()
    
    async def event_generator():
        """Generate SSE events for meeting simulation"""
        try:
            # Update meeting status to running and increment run count
            meeting.status = "running"
            meeting.run_count = (meeting.run_count or 0) + 1
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
                try:
                    logger.info(f"Creating minutes for meeting {meeting_id}")
                    minutes = MeetingMinutes(
                        meeting_id=meeting.id,
                        user_id=meeting.user_id,
                        title=meeting.title,
                        issue=meeting.issue,
                        decision=meeting.decision or "No decision recorded",
                        summary=meeting.summary or "Meeting completed without summary",
                        full_transcript=meeting.dialogue or [],
                        participants=[agent['name'] for agent in meeting.agents_config],
                        options_discussed=meeting.options_summary or "No options recorded",
                        metrics=meeting.metrics or {},
                        meeting_date=meeting.completed_at
                    )
                    db.add(minutes)
                    db.commit()
                    db.refresh(minutes)
                    logger.info(f"Successfully created minutes with ID {minutes.id} for meeting {meeting_id}")
                except Exception as e:
                    logger.error(f"Failed to create minutes for meeting {meeting_id}: {e}", exc_info=True)
                    # Don't fail the meeting completion if minutes creation fails
                    db.rollback()
            else:
                logger.warning(f"Minutes not created for meeting {meeting_id}: status={meeting.status}, final_result={'present' if final_result else 'missing'}")
            
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


# ============ Sharing Endpoints ============

@router.post("/{meeting_id}/share", response_model=List[MeetingShareResponse])
def share_meeting(
    meeting_id: int,
    share_data: MeetingShareCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Share a meeting with other users by email"""
    # Verify meeting exists and user owns it
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    if meeting.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to share this meeting"
        )
    
    # Find users by email and create shares
    shares_created = []
    for email in share_data.user_emails:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            continue  # Skip invalid emails
        
        if user.id == current_user.id:
            continue  # Skip sharing with self
        
        # Check sharing restrictions
        if not PermissionChecker.can_share_with_user(current_user, user):
            continue  # Skip users that violate sharing restrictions
        
        # Check if already shared
        existing = db.query(MeetingShare).filter(
            MeetingShare.meeting_id == meeting_id,
            MeetingShare.shared_with_user_id == user.id
        ).first()
        
        if existing:
            continue  # Already shared
        
        # Create share
        share = MeetingShare(
            meeting_id=meeting_id,
            shared_with_user_id=user.id
        )
        db.add(share)
        db.flush()
        
        shares_created.append({
            **share.__dict__,
            "shared_with_email": user.email,
            "shared_with_name": user.full_name
        })
    
    db.commit()
    return shares_created


@router.get("/{meeting_id}/shares", response_model=List[MeetingShareResponse])
def get_meeting_shares(
    meeting_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get list of users a meeting is shared with"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    if meeting.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view shares for this meeting"
        )
    
    shares = (
        db.query(MeetingShare, User)
        .join(User, MeetingShare.shared_with_user_id == User.id)
        .filter(MeetingShare.meeting_id == meeting_id)
        .all()
    )
    
    return [
        {
            **share.__dict__,
            "shared_with_email": user.email,
            "shared_with_name": user.full_name
        }
        for share, user in shares
    ]


@router.delete("/{meeting_id}/share/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def unshare_meeting(
    meeting_id: int,
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Remove sharing access for a user"""
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    if meeting.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify shares for this meeting"
        )
    
    share = db.query(MeetingShare).filter(
        MeetingShare.meeting_id == meeting_id,
        MeetingShare.shared_with_user_id == user_id
    ).first()
    
    if share:
        db.delete(share)
        db.commit()
    
    return None


@router.post("/{meeting_id}/archive", status_code=status.HTTP_200_OK)
def archive_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Archive a meeting (owned or shared) in current user's workspace"""
    # Check if it's an owned meeting
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.user_id == current_user.id
    ).first()
    
    if meeting:
        # Archive owned meeting
        meeting.is_archived = True
        db.commit()
        return {"message": "Meeting archived"}
    
    # Check if it's a shared meeting
    share = db.query(MeetingShare).filter(
        MeetingShare.meeting_id == meeting_id,
        MeetingShare.shared_with_user_id == current_user.id
    ).first()
    
    if share:
        # Archive shared meeting
        share.is_archived = True
        db.commit()
        return {"message": "Meeting archived"}
    
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Meeting not found"
    )


@router.post("/{meeting_id}/unarchive", status_code=status.HTTP_200_OK)
def unarchive_meeting(
    meeting_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unarchive a meeting (owned or shared) in current user's workspace"""
    # Check if it's an owned meeting
    meeting = db.query(Meeting).filter(
        Meeting.id == meeting_id,
        Meeting.user_id == current_user.id
    ).first()
    
    if meeting:
        # Unarchive owned meeting
        meeting.is_archived = False
        db.commit()
        return {"message": "Meeting restored"}
    
    # Check if it's a shared meeting
    share = db.query(MeetingShare).filter(
        MeetingShare.meeting_id == meeting_id,
        MeetingShare.shared_with_user_id == current_user.id
    ).first()
    
    if share:
        # Unarchive shared meeting
        share.is_archived = False
        db.commit()
        return {"message": "Meeting restored"}
    
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Meeting not found"
    )
