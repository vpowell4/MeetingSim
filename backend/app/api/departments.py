"""Department management API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.models.database import User, Department, Organization, UserRole
from app.models.schemas import DepartmentCreate, DepartmentUpdate, DepartmentResponse
from app.utils.auth import get_current_active_user
from app.utils.permissions import PermissionChecker, require_permission

router = APIRouter()


@router.get("", response_model=List[DepartmentResponse])
def get_departments(
    organization_id: int = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get departments filtered by organization"""
    query = db.query(Department)
    
    if organization_id:
        query = query.filter(Department.organization_id == organization_id)
    elif current_user.organization_id:
        # Non-super users can only see departments in their organization
        if current_user.role != UserRole.SUPER:
            query = query.filter(Department.organization_id == current_user.organization_id)
    
    return query.all()


@router.post("", response_model=DepartmentResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    dept_data: DepartmentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new department (Super/Admin only)"""
    require_permission(
        PermissionChecker.can_manage_department(current_user, dept_data.organization_id),
        "Not authorized to create departments in this organization"
    )
    
    # Verify organization exists
    org = db.query(Organization).filter(Organization.id == dept_data.organization_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Check for duplicate name in organization
    existing = db.query(Department).filter(
        Department.organization_id == dept_data.organization_id,
        Department.name == dept_data.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Department with name '{dept_data.name}' already exists in this organization"
        )
    
    db_dept = Department(
        organization_id=dept_data.organization_id,
        name=dept_data.name,
        description=dept_data.description
    )
    db.add(db_dept)
    db.commit()
    db.refresh(db_dept)
    
    return db_dept


@router.get("/{dept_id}", response_model=DepartmentResponse)
def get_department(
    dept_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get department details"""
    dept = db.query(Department).filter(Department.id == dept_id).first()
    
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    
    # Check permission
    if current_user.role != UserRole.SUPER:
        if current_user.organization_id != dept.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this department"
            )
    
    return dept


@router.put("/{dept_id}", response_model=DepartmentResponse)
def update_department(
    dept_id: int,
    dept_update: DepartmentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update department (Super/Admin only)"""
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    
    require_permission(
        PermissionChecker.can_manage_department(current_user, dept.organization_id),
        "Not authorized to update this department"
    )
    
    # Check for duplicate name if changing name
    if dept_update.name and dept_update.name != dept.name:
        existing = db.query(Department).filter(
            Department.organization_id == dept.organization_id,
            Department.name == dept_update.name
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Department with name '{dept_update.name}' already exists in this organization"
            )
    
    # Update fields
    if dept_update.name is not None:
        dept.name = dept_update.name
    if dept_update.description is not None:
        dept.description = dept_update.description
    if dept_update.is_active is not None:
        dept.is_active = dept_update.is_active
    
    db.commit()
    db.refresh(dept)
    
    return dept


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    dept_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete department (Super/Admin only)"""
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    
    require_permission(
        PermissionChecker.can_manage_department(current_user, dept.organization_id),
        "Not authorized to delete this department"
    )
    
    # Check if there are users in the department
    user_count = db.query(User).filter(User.department_id == dept_id).count()
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete department with {user_count} users. Move or delete users first."
        )
    
    db.delete(dept)
    db.commit()
    
    return None
