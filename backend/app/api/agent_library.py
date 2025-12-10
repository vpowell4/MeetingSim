"""People Library API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.database import User, AgentProfile
from app.models.schemas import AgentProfileCreate, AgentProfileUpdate, AgentProfileResponse
from app.utils.auth import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[AgentProfileResponse])
def get_agent_profiles(
    filter: str = Query("active", description="Filter by status: active, archived"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all people profiles for current user"""
    query = db.query(AgentProfile).filter(AgentProfile.user_id == current_user.id)
    
    if filter == "active":
        query = query.filter(AgentProfile.is_archived == False)
    elif filter == "archived":
        query = query.filter(AgentProfile.is_archived == True)
    
    profiles = query.order_by(AgentProfile.name).all()
    return profiles


@router.post("", response_model=AgentProfileResponse, status_code=status.HTTP_201_CREATED)
def create_agent_profile(
    profile_data: AgentProfileCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new people profile"""
    # Check for duplicate name
    existing = db.query(AgentProfile).filter(
        AgentProfile.user_id == current_user.id,
        AgentProfile.name == profile_data.name
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Person profile with name '{profile_data.name}' already exists"
        )
    
    db_profile = AgentProfile(
        user_id=current_user.id,
        name=profile_data.name,
        role=profile_data.role,
        persona=profile_data.persona,
        default_stance=profile_data.default_stance,
        default_dominance=profile_data.default_dominance,
        traits=profile_data.traits,
        goals=profile_data.goals,
        criteria=profile_data.criteria
    )
    db.add(db_profile)
    db.commit()
    db.refresh(db_profile)
    
    return db_profile


@router.get("/{profile_id}", response_model=AgentProfileResponse)
def get_agent_profile(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific person profile"""
    profile = db.query(AgentProfile).filter(AgentProfile.id == profile_id).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    if profile.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this profile"
        )
    
    return profile


@router.put("/{profile_id}", response_model=AgentProfileResponse)
def update_agent_profile(
    profile_id: int,
    profile_update: AgentProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update a person profile"""
    profile = db.query(AgentProfile).filter(AgentProfile.id == profile_id).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    if profile.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this profile"
        )
    
    # Check for duplicate name if changing name
    if profile_update.name and profile_update.name != profile.name:
        existing = db.query(AgentProfile).filter(
            AgentProfile.user_id == current_user.id,
            AgentProfile.name == profile_update.name
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Person profile with name '{profile_update.name}' already exists"
            )
    
    # Update fields
    if profile_update.name is not None:
        profile.name = profile_update.name
    if profile_update.role is not None:
        profile.role = profile_update.role
    if profile_update.persona is not None:
        profile.persona = profile_update.persona
    if profile_update.default_stance is not None:
        profile.default_stance = profile_update.default_stance
    if profile_update.default_dominance is not None:
        profile.default_dominance = profile_update.default_dominance
    if profile_update.traits is not None:
        profile.traits = profile_update.traits
    if profile_update.goals is not None:
        profile.goals = profile_update.goals
    if profile_update.criteria is not None:
        profile.criteria = profile_update.criteria
    
    db.commit()
    db.refresh(profile)
    
    return profile


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agent_profile(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a person profile"""
    profile = db.query(AgentProfile).filter(AgentProfile.id == profile_id).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    if profile.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this profile"
        )
    
    db.delete(profile)
    db.commit()
    
    return None


@router.post("/{profile_id}/archive", status_code=status.HTTP_200_OK)
def archive_agent_profile(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Archive an agent profile"""
    profile = db.query(AgentProfile).filter(AgentProfile.id == profile_id).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    if profile.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to archive this profile"
        )
    
    profile.is_archived = True
    db.commit()
    
    return {"message": "Agent profile archived successfully"}


@router.post("/{profile_id}/unarchive", status_code=status.HTTP_200_OK)
def unarchive_agent_profile(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Unarchive an agent profile"""
    profile = db.query(AgentProfile).filter(AgentProfile.id == profile_id).first()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent profile not found"
        )
    
    if profile.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to unarchive this profile"
        )
    
    profile.is_archived = False
    db.commit()
    
    return {"message": "Agent profile restored successfully"}
