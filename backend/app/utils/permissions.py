"""Authorization and permission checking utilities"""
from typing import Optional, List
from app.models.database import User, UserRole
from fastapi import HTTPException, status


class PermissionChecker:
    """Helper class for role-based permission checking"""
    
    @staticmethod
    def can_manage_users(user: User) -> bool:
        """Check if user can create/manage other users"""
        return user.role in [UserRole.SUPER, UserRole.ADMIN, UserRole.MANAGER]
    
    @staticmethod
    def can_edit_user(current_user: User, target_user: User) -> bool:
        """
        Check if current_user can edit target_user
        - Super: can edit anyone in their organization
        - Admin: can edit anyone in their organization
        - Manager: can edit anyone in their department
        - User: can only edit themselves
        """
        # Users can always edit themselves
        if current_user.id == target_user.id:
            return True
        
        # Super can edit anyone in same organization
        if current_user.role == UserRole.SUPER:
            return current_user.organization_id == target_user.organization_id
        
        # Admin can edit anyone in same organization
        if current_user.role == UserRole.ADMIN:
            return current_user.organization_id == target_user.organization_id
        
        # Manager can edit anyone in same department
        if current_user.role == UserRole.MANAGER:
            return (current_user.organization_id == target_user.organization_id and
                    current_user.department_id == target_user.department_id)
        
        return False
    
    @staticmethod
    def can_delete_user(current_user: User, target_user: User) -> bool:
        """
        Check if current_user can delete target_user
        - Super: can delete anyone in their organization (except themselves)
        - Admin: can delete anyone in their organization (except themselves)
        - Manager: can delete users in their department (except themselves)
        - User: cannot delete anyone
        """
        # Cannot delete yourself
        if current_user.id == target_user.id:
            return False
        
        # Super can delete anyone in same organization
        if current_user.role == UserRole.SUPER:
            return current_user.organization_id == target_user.organization_id
        
        # Admin can delete anyone in same organization (except Super users)
        if current_user.role == UserRole.ADMIN:
            return (current_user.organization_id == target_user.organization_id and
                    target_user.role not in [UserRole.SUPER, UserRole.ADMIN])
        
        # Manager can delete users in same department
        if current_user.role == UserRole.MANAGER:
            return (current_user.organization_id == target_user.organization_id and
                    current_user.department_id == target_user.department_id and
                    target_user.role == UserRole.USER)
        
        return False
    
    @staticmethod
    def can_create_user_with_role(current_user: User, new_role: UserRole) -> bool:
        """
        Check if current_user can create a user with new_role
        - Super: can create any role in their organization
        - Admin: can create Admin, Manager, User in their organization
        - Manager: can create User in their department
        - User: cannot create users
        """
        if current_user.role == UserRole.SUPER:
            return True
        
        if current_user.role == UserRole.ADMIN:
            return new_role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER]
        
        if current_user.role == UserRole.MANAGER:
            return new_role == UserRole.USER
        
        return False
    
    @staticmethod
    def can_share_with_user(sharer: User, sharee: User) -> bool:
        """
        Check if sharer can share content with sharee based on restrictions
        - If sharer has no restrictions, can share with anyone
        - If sharer has restrictions set by admin/manager, must comply
        """
        # Check user restrictions
        if sharer.allowed_share_users is not None:
            if sharee.id not in sharer.allowed_share_users:
                return False
        
        # Check organization restrictions
        if sharer.allowed_share_orgs is not None:
            if sharee.organization_id not in sharer.allowed_share_orgs:
                return False
        
        # Check department restrictions
        if sharer.allowed_share_depts is not None:
            if sharee.department_id not in sharer.allowed_share_depts:
                return False
        
        return True
    
    @staticmethod
    def can_set_sharing_restrictions(current_user: User, target_user: User) -> bool:
        """
        Check if current_user can set sharing restrictions for target_user
        - Super: can set restrictions for anyone in their organization
        - Admin: can set restrictions for anyone in their organization
        - Manager: can set restrictions for users in their department
        - User: cannot set restrictions
        """
        # Super can set restrictions for anyone in organization
        if current_user.role == UserRole.SUPER:
            return current_user.organization_id == target_user.organization_id
        
        # Admin can set restrictions for anyone in organization (except Super)
        if current_user.role == UserRole.ADMIN:
            return (current_user.organization_id == target_user.organization_id and
                    target_user.role != UserRole.SUPER)
        
        # Manager can set restrictions for users in department
        if current_user.role == UserRole.MANAGER:
            return (current_user.organization_id == target_user.organization_id and
                    current_user.department_id == target_user.department_id and
                    target_user.role == UserRole.USER)
        
        return False
    
    @staticmethod
    def can_manage_organization(current_user: User) -> bool:
        """Only Super users can manage organizations"""
        return current_user.role == UserRole.SUPER
    
    @staticmethod
    def can_manage_department(current_user: User, org_id: int) -> bool:
        """
        Check if user can manage departments
        - Super: can manage departments in their organization
        - Admin: can manage departments in their organization
        """
        if current_user.role in [UserRole.SUPER, UserRole.ADMIN]:
            return current_user.organization_id == org_id
        return False
    
    @staticmethod
    def owns_resource(user: User, resource_user_id: int) -> bool:
        """Check if user owns the resource"""
        return user.id == resource_user_id
    
    @staticmethod
    def can_delete_resource(current_user: User, owner_user: User) -> bool:
        """
        Check if current_user can delete a resource owned by owner_user
        - Owner: can delete their own resources
        - Super/Admin: can delete resources of anyone in their organization
        - Manager: can delete resources of anyone in their department
        """
        # Owner can delete
        if current_user.id == owner_user.id:
            return True
        
        # Super can delete resources in organization
        if current_user.role == UserRole.SUPER:
            return current_user.organization_id == owner_user.organization_id
        
        # Admin can delete resources in organization
        if current_user.role == UserRole.ADMIN:
            return current_user.organization_id == owner_user.organization_id
        
        # Manager can delete resources in department
        if current_user.role == UserRole.MANAGER:
            return (current_user.organization_id == owner_user.organization_id and
                    current_user.department_id == owner_user.department_id)
        
        return False


def require_permission(has_permission: bool, message: str = "Not authorized"):
    """Helper to raise HTTP exception if permission check fails"""
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message
        )


def require_role(user: User, required_roles: List[UserRole], message: str = "Insufficient permissions"):
    """Helper to check if user has one of the required roles"""
    if user.role not in required_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message
        )
