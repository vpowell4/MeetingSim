"""Minutes Library API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.db.session import get_db
from app.models.database import User, MeetingMinutes
from app.utils.auth import get_current_active_user
from pydantic import BaseModel


router = APIRouter()


# Schemas
class MinutesResponse(BaseModel):
    id: int
    meeting_id: int
    title: str
    issue: str
    decision: Optional[str]
    summary: Optional[str]
    participants: List[str]
    meeting_date: datetime
    created_at: datetime
    is_archived: bool = False
    
    class Config:
        from_attributes = True


class MinutesDetail(MinutesResponse):
    full_transcript: Optional[List[str]] = []
    key_points: Optional[List[str]] = []
    action_items: Optional[List[str]] = []
    options_discussed: Optional[str]
    metrics: Optional[dict]


@router.get("", response_model=List[MinutesResponse])
def get_all_minutes(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None, description="Search in title or issue"),
    filter: str = Query("active", description="Filter by status: active, archived"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all meeting minutes for current user"""
    query = db.query(MeetingMinutes).filter(MeetingMinutes.user_id == current_user.id)
    
    if filter == "active":
        query = query.filter(MeetingMinutes.is_archived == False)
    elif filter == "archived":
        query = query.filter(MeetingMinutes.is_archived == True)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (MeetingMinutes.title.ilike(search_filter)) |
            (MeetingMinutes.issue.ilike(search_filter))
        )
    
    minutes = (
        query
        .order_by(MeetingMinutes.meeting_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return minutes


@router.get("/{minutes_id}", response_model=MinutesDetail)
def get_minutes(
    minutes_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get specific meeting minutes"""
    minutes = db.query(MeetingMinutes).filter(
        MeetingMinutes.id == minutes_id,
        MeetingMinutes.user_id == current_user.id
    ).first()
    
    if not minutes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Minutes not found"
        )
    
    return minutes


@router.delete("/{minutes_id}")
def delete_minutes(
    minutes_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete meeting minutes"""
    minutes = db.query(MeetingMinutes).filter(
        MeetingMinutes.id == minutes_id,
        MeetingMinutes.user_id == current_user.id
    ).first()
    
    if not minutes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Minutes not found"
        )
    
    db.delete(minutes)
    db.commit()
    
    return {"message": "Minutes deleted successfully"}


@router.post("/{minutes_id}/archive", status_code=status.HTTP_200_OK)
def archive_minutes(
    minutes_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Archive meeting minutes"""
    minutes = db.query(MeetingMinutes).filter(
        MeetingMinutes.id == minutes_id,
        MeetingMinutes.user_id == current_user.id
    ).first()
    
    if not minutes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Minutes not found"
        )
    
    minutes.is_archived = True
    db.commit()
    
    return {"message": "Minutes archived successfully"}


@router.post("/{minutes_id}/unarchive", status_code=status.HTTP_200_OK)
def unarchive_minutes(
    minutes_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unarchive meeting minutes"""
    minutes = db.query(MeetingMinutes).filter(
        MeetingMinutes.id == minutes_id,
        MeetingMinutes.user_id == current_user.id
    ).first()
    
    if not minutes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Minutes not found"
        )
    
    minutes.is_archived = False
    db.commit()
    
    return {"message": "Minutes restored successfully"}
