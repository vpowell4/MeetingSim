"""SQLAlchemy database models"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    meetings = relationship("Meeting", back_populates="user", cascade="all, delete-orphan")
    agent_profiles = relationship("AgentProfile", back_populates="user", cascade="all, delete-orphan")


class AgentProfile(Base):
    __tablename__ = "agent_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(String(100), nullable=True)
    persona = Column(Text, nullable=False)
    default_stance = Column(String(20), default="neutral")
    default_dominance = Column(Integer, default=1.0)
    traits = Column(JSON, nullable=False)  # {"interrupt": 0.2, "conflict_avoid": 0.5, "persuasion": 0.5}
    
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
    conditions = Column(JSON, nullable=True)  # Meeting conditions/parameters
    
    # Results
    decision = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    dialogue = Column(JSON, nullable=True)  # List of strings
    options_summary = Column(Text, nullable=True)
    metrics = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="meetings")


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
    
    # Timestamps
    meeting_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    meeting = relationship("Meeting", foreign_keys=[meeting_id])
