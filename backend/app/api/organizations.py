"""Organization management API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.database import User, Organization, UserRole
from app.models.schemas import OrganizationCreate, OrganizationUpdate, OrganizationResponse
from app.utils.auth import get_current_active_user
from app.utils.permissions import PermissionChecker, require_permission

router = APIRouter()


@router.get("", response_model=List[OrganizationResponse])
def get_organizations(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all organizations (Super only) or current user's organization"""
    if current_user.role == UserRole.SUPER:
        orgs = db.query(Organization).all()
    else:
        if not current_user.organization_id:
            return []
        orgs = db.query(Organization).filter(Organization.id == current_user.organization_id).all()
    return orgs


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
def create_organization(
    org_data: OrganizationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new organization (Super only)"""
    require_permission(
        PermissionChecker.can_manage_organization(current_user),
        "Only Super users can create organizations"
    )
    
    # Check for duplicate name
    existing = db.query(Organization).filter(Organization.name == org_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organization with name '{org_data.name}' already exists"
        )
    
    db_org = Organization(
        name=org_data.name,
        description=org_data.description
    )
    db.add(db_org)
    db.commit()
    db.refresh(db_org)
    
    return db_org


@router.get("/{org_id}", response_model=OrganizationResponse)
def get_organization(
    org_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get organization details"""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Check permission
    if current_user.role != UserRole.SUPER and current_user.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this organization"
        )
    
    return org


@router.put("/{org_id}", response_model=OrganizationResponse)
def update_organization(
    org_id: int,
    org_update: OrganizationUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update organization (Super only)"""
    require_permission(
        PermissionChecker.can_manage_organization(current_user),
        "Only Super users can update organizations"
    )
    
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Check for duplicate name if changing name
    if org_update.name and org_update.name != org.name:
        existing = db.query(Organization).filter(Organization.name == org_update.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Organization with name '{org_update.name}' already exists"
            )
    
    # Update fields
    if org_update.name is not None:
        org.name = org_update.name
    if org_update.description is not None:
        org.description = org_update.description
    if org_update.is_active is not None:
        org.is_active = org_update.is_active
    
    db.commit()
    db.refresh(org)
    
    return org


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(
    org_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete organization (Super only)"""
    require_permission(
        PermissionChecker.can_manage_organization(current_user),
        "Only Super users can delete organizations"
    )
    
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Check if there are users in the organization
    user_count = db.query(User).filter(User.organization_id == org_id).count()
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete organization with {user_count} users. Move or delete users first."
        )
    
    db.delete(org)
    db.commit()
    
    return None
