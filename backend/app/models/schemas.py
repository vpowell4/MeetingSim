"""Pydantic schemas for API requests/responses"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ============ Enum Schemas ============

class UserRoleEnum(str, Enum):
    SUPER = "super"
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"


# ============ Organization Schemas ============

class OrganizationBase(BaseModel):
    name: str
    description: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class OrganizationResponse(OrganizationBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============ Department Schemas ============

class DepartmentBase(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentCreate(DepartmentBase):
    organization_id: int


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class DepartmentResponse(DepartmentBase):
    id: int
    organization_id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============ User Schemas ============

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=72)
    role: Optional[UserRoleEnum] = UserRoleEnum.USER
    organization_id: Optional[int] = None
    department_id: Optional[int] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    
    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password strength"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if len(v.encode('utf-8')) > 72:
            raise ValueError('Password is too long (max 72 bytes)')
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    organization_id: Optional[int] = None
    department_id: Optional[int] = None


class UserAdminUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRoleEnum] = None
    organization_id: Optional[int] = None
    department_id: Optional[int] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    allowed_share_users: Optional[List[int]] = None
    allowed_share_orgs: Optional[List[int]] = None
    allowed_share_depts: Optional[List[int]] = None


class UserResponse(UserBase):
    id: int
    role: UserRoleEnum
    organization_id: Optional[int] = None
    department_id: Optional[int] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserDetailResponse(UserResponse):
    allowed_share_users: Optional[List[int]] = None
    allowed_share_orgs: Optional[List[int]] = None
    allowed_share_depts: Optional[List[int]] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ============ Meeting Schemas ============

class AgentConfig(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    stance: str = Field(default="neutral", pattern="^(for|against|neutral)$")
    dominance: float = Field(default=1.0, ge=0.1, le=3.0)
    persona: str = Field(..., min_length=10, max_length=500)
    traits: Dict[str, float] = Field(
        default_factory=lambda: {
            "interrupt": 0.2,
            "conflict_avoid": 0.5,
            "persuasion": 0.5
        }
    )
    
    @field_validator('traits')
    @classmethod
    def validate_traits(cls, v):
        required = {'interrupt', 'conflict_avoid', 'persuasion'}
        if not required.issubset(v.keys()):
            raise ValueError(f"Traits must include: {required}")
        for key, val in v.items():
            if not 0 <= val <= 1:
                raise ValueError(f"Trait {key} must be between 0 and 1")
        return v


class MeetingConditions(BaseModel):
    """Environmental conditions and parameters that control meeting behavior"""
    time_pressure: float = Field(default=0.5, ge=0.0, le=1.0, description="Urgency/deadline pressure (0=relaxed, 1=critical)")
    formality: float = Field(default=0.5, ge=0.0, le=1.0, description="Meeting formality level (0=casual, 1=formal)")
    conflict_tolerance: float = Field(default=0.5, ge=0.0, le=1.0, description="Acceptable conflict level (0=harmony, 1=debate)")
    decision_threshold: float = Field(default=0.7, ge=0.5, le=1.0, description="Consensus needed to decide (0.5=majority, 1.0=unanimous)")
    max_turns: int = Field(default=50, ge=10, le=200, description="Maximum discussion turns")
    creativity_mode: bool = Field(default=False, description="Enable brainstorming/creative thinking")


class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=200)
    issue: str = Field(..., min_length=10, max_length=1000)
    context: Optional[str] = Field(None, max_length=10000, description="Additional context or background information")
    agents: List[AgentConfig] = Field(..., min_items=2, max_items=10)
    conditions: Optional[MeetingConditions] = Field(default_factory=MeetingConditions)
    
    @field_validator('agents')
    @classmethod
    def validate_agent_names(cls, v):
        names = [a.name for a in v]
        if len(names) != len(set(names)):
            raise ValueError("Agent names must be unique")
        if "Alice" not in names:
            raise ValueError("Alice (chair) must be included in agents")
        return v


class MeetingStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class MeetingResponse(BaseModel):
    id: int
    user_id: int
    title: str
    issue: str
    context: Optional[str] = None
    status: str
    decision: Optional[str] = None
    summary: Optional[str] = None
    run_count: int = 0
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class MeetingDetail(MeetingResponse):
    dialogue: List[str] = []
    options_summary: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    agents: List[Dict[str, Any]] = []
    conditions: Optional[Dict[str, Any]] = None


class DialogueLine(BaseModel):
    type: str = "line"
    line: str


class MeetingFinal(BaseModel):
    type: str = "final"
    decision: Optional[str]
    summary: str
    options_summary: str
    metrics: Dict[str, Any]


# ============ People Profile Schemas ============

class AgentProfileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    persona: str = Field(..., min_length=10, max_length=500)
    default_stance: str = Field(default="neutral", pattern="^(for|against|neutral)$")
    default_dominance: float = Field(default=1.0, ge=0.1, le=3.0)
    traits: Dict[str, float] = Field(
        default_factory=lambda: {
            "interrupt": 0.2,
            "conflict_avoid": 0.5,
            "persuasion": 0.5,
            "assertiveness": 0.5,
            "cooperation": 0.5,
            "analytical": 0.5,
            "emotional": 0.5,
            "risk_tolerance": 0.5,
            "creativity": 0.5,
            "detail_oriented": 0.5,
            "big_picture": 0.5
        }
    )
    goals: Optional[Dict[str, List[Dict]]] = None  # {"goals": [{"text": "...", "importance": 80, "perspectives": [...]}]}
    criteria: Optional[Dict[str, float]] = Field(
        default_factory=lambda: {
            "cost": 0.5,
            "risk": 0.5,
            "speed": 0.5,
            "fairness": 0.5,
            "innovation": 0.5,
            "consensus": 0.5
        }
    )


class AgentProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    persona: Optional[str] = Field(None, min_length=10, max_length=500)
    default_stance: Optional[str] = Field(None, pattern="^(for|against|neutral)$")
    default_dominance: Optional[float] = Field(None, ge=0.1, le=3.0)
    traits: Optional[Dict[str, float]] = None
    goals: Optional[Dict[str, List[Dict]]] = None
    criteria: Optional[Dict[str, float]] = None


class AgentProfileResponse(BaseModel):
    id: int
    user_id: int
    name: str
    role: Optional[str]
    persona: str
    default_stance: str
    default_dominance: float
    traits: Dict[str, float]
    goals: Optional[Dict[str, List[Dict]]] = None
    criteria: Optional[Dict[str, float]] = None
    created_at: datetime
    updated_at: Optional[datetime]
    is_archived: bool = False
    
    class Config:
        from_attributes = True


# ============ Meeting Share Schemas ============

class MeetingShareCreate(BaseModel):
    meeting_id: int
    user_emails: List[str] = Field(..., min_items=1)


class MeetingShareResponse(BaseModel):
    id: int
    meeting_id: int
    shared_with_user_id: int
    shared_with_email: Optional[str] = None
    shared_with_name: Optional[str] = None
    is_archived: bool
    shared_at: datetime
    
    class Config:
        from_attributes = True


class MeetingResponseWithSharing(MeetingResponse):
    is_shared: bool = False  # True if viewing a shared meeting
    is_owner: bool = True    # True if current user owns the meeting
    shared_by: Optional[str] = None  # Email of owner if shared
    is_archived: bool = False  # True if user archived this shared meeting
    
    class Config:
        from_attributes = True
