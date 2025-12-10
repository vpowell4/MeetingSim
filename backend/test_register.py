"""Test registration endpoint"""
import sys
sys.path.insert(0, '.')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.database import Base, User
from app.utils.auth import get_password_hash

# Create test database
engine = create_engine("sqlite:///./test_db.db")
Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    # Test user creation
    password = "password123"
    hashed = get_password_hash(password)
    
    user = User(
        email="test@example.com",
        full_name="Test User",
        hashed_password=hashed
    )
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    print(f"✓ User created successfully!")
    print(f"  ID: {user.id}")
    print(f"  Email: {user.email}")
    print(f"  Name: {user.full_name}")
    print(f"  Active: {user.is_active}")
    
except Exception as e:
    print(f"✗ User creation failed: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()

