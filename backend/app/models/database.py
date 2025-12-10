"""SQLAlchemy database models"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base
import enum


class UserRole(str, enum.Enum):
    SUPER = "super"
    ADMIN = "admin"
    MANAGER = "manager"
    USER = "user"


class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    departments = relationship("Department", back_populates="organization", cascade="all, delete-orphan")
    users = relationship("User", back_populates="organization")


class Department(Base):
    __tablename__ = "departments"
    
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="departments")
    users = relationship("User", back_populates="department")


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    
    # Profile fields
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    title = Column(String(255), nullable=True)  # Job title
    phone = Column(String(50), nullable=True)
    
    # Sharing restrictions (for admins/managers)
    allowed_share_users = Column(JSON, nullable=True)  # List of user IDs or null for all
    allowed_share_orgs = Column(JSON, nullable=True)  # List of org IDs or null for all
    allowed_share_depts = Column(JSON, nullable=True)  # List of dept IDs or null for all
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    department = relationship("Department", back_populates="users")
    meetings = relationship("Meeting", back_populates="user", cascade="all, delete-orphan")
    agent_profiles = relationship("AgentProfile", back_populates="user", cascade="all, delete-orphan")
    shared_meetings = relationship("MeetingShare", foreign_keys="[MeetingShare.shared_with_user_id]")


class AgentProfile(Base):
    __tablename__ = "agent_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(100), nullable=True)
    persona = Column(Text, nullable=False)
    default_stance = Column(String(20), default="neutral")
    default_dominance = Column(Integer, default=1.0)
    traits = Column(JSON, nullable=False)  # {"interrupt": 0.2, "conflict_avoid": 0.5, "persuasion": 0.5, ...}
    goals = Column(JSON, nullable=True)  # {"goals": [{"text": "...", "importance": 80, "perspectives": [{"agent": "...", "importance": 60}]}]}
    criteria = Column(JSON, nullable=True)  # {"cost": 0.5, "risk": 0.5, "speed": 0.5, "fairness": 0.5, "innovation": 0.5, "consensus": 0.5}
    is_archived = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="agent_profiles")


class Meeting(Base):
    __tablename__ = "meetings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    issue = Column(Text, nullable=False)
    context = Column(Text, nullable=True)
    status = Column(String(50), default="pending", index=True)
    
    # Meeting configuration (stored as JSON)
    agents_config = Column(JSON, nullable=False)
    conditions = Column(JSON, nullable=True)  # Meeting conditions/parameters
    
    # Results
    decision = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    dialogue = Column(JSON, nullable=True)  # List of strings
    options_summary = Column(Text, nullable=True)
    metrics = Column(JSON, nullable=True)
    run_count = Column(Integer, default=0, nullable=False)  # Number of times meeting has been run
    is_archived = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="meetings")
    shared_with = relationship("MeetingShare", back_populates="meeting", cascade="all, delete-orphan")


class MeetingShare(Base):
    __tablename__ = "meeting_shares"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    shared_with_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_archived = Column(Boolean, default=False)  # Recipient can archive in their workspace
    shared_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    meeting = relationship("Meeting", back_populates="shared_with")
    user = relationship("User", foreign_keys=[shared_with_user_id])


class MeetingMinutes(Base):
    __tablename__ = "meeting_minutes"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    issue = Column(Text, nullable=False)
    decision = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    full_transcript = Column(JSON, nullable=True)  # List of dialogue lines
    participants = Column(JSON, nullable=False)  # List of participant names
    key_points = Column(JSON, nullable=True)  # List of key discussion points
    action_items = Column(JSON, nullable=True)  # List of action items
    options_discussed = Column(Text, nullable=True)
    metrics = Column(JSON, nullable=True)
    is_archived = Column(Boolean, default=False)
    
    # Timestamps
    meeting_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    meeting = relationship("Meeting", foreign_keys=[meeting_id])
