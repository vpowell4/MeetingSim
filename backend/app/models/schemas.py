"""Pydantic schemas for API requests/responses"""
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ============ User Schemas ============

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=72)
    
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


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


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
            "persuasion": 0.5
        }
    )


class AgentProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[str] = Field(None, max_length=100)
    persona: Optional[str] = Field(None, min_length=10, max_length=500)
    default_stance: Optional[str] = Field(None, pattern="^(for|against|neutral)$")
    default_dominance: Optional[float] = Field(None, ge=0.1, le=3.0)
    traits: Optional[Dict[str, float]] = None


class AgentProfileResponse(BaseModel):
    id: int
    user_id: int
    name: str
    role: Optional[str]
    persona: str
    default_stance: str
    default_dominance: float
    traits: Dict[str, float]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True
