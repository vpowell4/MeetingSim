from app.db.session import SessionLocal
from app.models.database import Meeting, User

db = SessionLocal()

user = db.query(User).first()
if user:
    print(f'User ID: {user.id}, Email: {user.email}')
    
    meetings = db.query(Meeting).filter(Meeting.user_id == user.id).all()
    print(f'\nMeetings for user {user.email}:')
    for m in meetings:
        print(f'  ID: {m.id}, Title: {m.title}, is_archived: {m.is_archived}')
    
    active = [m for m in meetings if not m.is_archived]
    archived = [m for m in meetings if m.is_archived]
    
    print(f'\nTotal: {len(meetings)} meetings')
    print(f'Active: {len(active)}')
    print(f'Archived: {len(archived)}')

db.close()
