"""User API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.database import User, UserRole
from app.models.schemas import (
    UserResponse, UserDetailResponse, UserProfileUpdate, 
    UserAdminUpdate, UserCreate
)
from app.utils.auth import get_current_active_user, get_password_hash
from app.utils.permissions import PermissionChecker, require_permission

router = APIRouter()


@router.get("/me", response_model=UserDetailResponse)
def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user_profile(
    profile_update: UserProfileUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile"""
    if profile_update.full_name is not None:
        current_user.full_name = profile_update.full_name
    if profile_update.title is not None:
        current_user.title = profile_update.title
    if profile_update.phone is not None:
        current_user.phone = profile_update.phone
    
    # Only allow changing org/dept if Super/Admin
    if profile_update.organization_id is not None:
        if current_user.role not in [UserRole.SUPER, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to change organization"
            )
        current_user.organization_id = profile_update.organization_id
    
    if profile_update.department_id is not None:
        if current_user.role not in [UserRole.SUPER, UserRole.ADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to change department"
            )
        current_user.department_id = profile_update.department_id
    
    db.commit()
    db.refresh(current_user)
    
    return current_user


@router.get("", response_model=List[UserResponse])
def get_users(
    organization_id: int = None,
    department_id: int = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get users - filtered by permissions:
    - Super: all users in their organization (or all if no org filter)
    - Admin: all users in their organization
    - Manager: all users in their department
    - User: only themselves
    """
    query = db.query(User)
    
    if current_user.role == UserRole.SUPER:
        if organization_id:
            query = query.filter(User.organization_id == organization_id)
        elif current_user.organization_id:
            query = query.filter(User.organization_id == current_user.organization_id)
    elif current_user.role == UserRole.ADMIN:
        query = query.filter(User.organization_id == current_user.organization_id)
        if organization_id and organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view users from other organizations"
            )
    elif current_user.role == UserRole.MANAGER:
        query = query.filter(
            User.organization_id == current_user.organization_id,
            User.department_id == current_user.department_id
        )
        if department_id and department_id != current_user.department_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view users from other departments"
            )
    else:  # USER
        query = query.filter(User.id == current_user.id)
    
    if department_id:
        query = query.filter(User.department_id == department_id)
    
    return query.all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new user (Super/Admin/Manager only)"""
    require_permission(
        PermissionChecker.can_manage_users(current_user),
        "Not authorized to create users"
    )
    
    # Check role permission
    require_permission(
        PermissionChecker.can_create_user_with_role(current_user, user_data.role),
        f"Not authorized to create users with role {user_data.role}"
    )
    
    # Check if email already exists
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Set organization/department based on creator's context
    org_id = user_data.organization_id or current_user.organization_id
    dept_id = user_data.department_id or current_user.department_id
    
    # Manager can only create users in their department
    if current_user.role == UserRole.MANAGER:
        org_id = current_user.organization_id
        dept_id = current_user.department_id
    
    db_user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role,
        organization_id=org_id,
        department_id=dept_id,
        title=user_data.title,
        phone=user_data.phone
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


@router.get("/{user_id}", response_model=UserDetailResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user can view this user
    if current_user.id != user_id:
        if current_user.role == UserRole.USER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this user"
            )
        elif current_user.role == UserRole.MANAGER:
            if (user.organization_id != current_user.organization_id or
                user.department_id != current_user.department_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this user"
                )
        elif current_user.role == UserRole.ADMIN:
            if user.organization_id != current_user.organization_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this user"
                )
    
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserAdminUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user (requires appropriate permissions)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check edit permission
    require_permission(
        PermissionChecker.can_edit_user(current_user, user),
        "Not authorized to edit this user"
    )
    
    # Update fields
    if user_update.full_name is not None:
        user.full_name = user_update.full_name
    if user_update.title is not None:
        user.title = user_update.title
    if user_update.phone is not None:
        user.phone = user_update.phone
    
    # Only Super/Admin can change role, org, dept
    if current_user.role in [UserRole.SUPER, UserRole.ADMIN]:
        if user_update.role is not None:
            user.role = user_update.role
        if user_update.organization_id is not None:
            user.organization_id = user_update.organization_id
        if user_update.department_id is not None:
            user.department_id = user_update.department_id
        if user_update.is_active is not None:
            user.is_active = user_update.is_active
    
    # Only those who can set restrictions can update these fields
    if PermissionChecker.can_set_sharing_restrictions(current_user, user):
        if user_update.allowed_share_users is not None:
            user.allowed_share_users = user_update.allowed_share_users
        if user_update.allowed_share_orgs is not None:
            user.allowed_share_orgs = user_update.allowed_share_orgs
        if user_update.allowed_share_depts is not None:
            user.allowed_share_depts = user_update.allowed_share_depts
    
    db.commit()
    db.refresh(user)
    
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete user (requires appropriate permissions)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check delete permission
    require_permission(
        PermissionChecker.can_delete_user(current_user, user),
        "Not authorized to delete this user"
    )
    
    db.delete(user)
    db.commit()
    
    return None
