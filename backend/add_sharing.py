"""Add meeting sharing functionality to database"""
import sqlite3
import os

# Database path
db_path = os.path.join(os.path.dirname(__file__), "meeting_simulator.db")

def add_sharing_tables():
    """Add meeting_shares table for sharing functionality"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Create meeting_shares table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS meeting_shares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                meeting_id INTEGER NOT NULL,
                shared_with_user_id INTEGER NOT NULL,
                is_archived BOOLEAN DEFAULT 0 NOT NULL,
                shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
                FOREIGN KEY (shared_with_user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(meeting_id, shared_with_user_id)
            )
        """)
        
        conn.commit()
        print("✅ meeting_shares table created successfully")
        
        # Show statistics
        cursor.execute("SELECT COUNT(*) FROM meetings")
        meeting_count = cursor.fetchone()[0]
        print(f"✅ Database has {meeting_count} meetings ready for sharing")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    add_sharing_tables()
