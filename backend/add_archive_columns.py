"""Add is_archived column to meetings, agent_profiles, and meeting_minutes tables"""
import sqlite3

def add_archive_columns():
    conn = sqlite3.connect('meeting_simulator.db')
    cursor = conn.cursor()
    
    try:
        # Add is_archived to meetings table
        try:
            cursor.execute('ALTER TABLE meetings ADD COLUMN is_archived INTEGER DEFAULT 0')
            print("✅ Added is_archived column to meetings table")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("⚠️  is_archived column already exists in meetings table")
            else:
                raise
        
        # Add is_archived to agent_profiles table
        try:
            cursor.execute('ALTER TABLE agent_profiles ADD COLUMN is_archived INTEGER DEFAULT 0')
            print("✅ Added is_archived column to agent_profiles table")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("⚠️  is_archived column already exists in agent_profiles table")
            else:
                raise
        
        # Add is_archived to meeting_minutes table
        try:
            cursor.execute('ALTER TABLE meeting_minutes ADD COLUMN is_archived INTEGER DEFAULT 0')
            print("✅ Added is_archived column to meeting_minutes table")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("⚠️  is_archived column already exists in meeting_minutes table")
            else:
                raise
        
        conn.commit()
        
        # Verify the changes
        cursor.execute("SELECT COUNT(*) FROM meetings")
        meeting_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM agent_profiles")
        agent_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM meeting_minutes")
        minutes_count = cursor.fetchone()[0]
        
        print(f"\n📊 Database status:")
        print(f"   Meetings: {meeting_count}")
        print(f"   Agent Profiles: {agent_count}")
        print(f"   Minutes: {minutes_count}")
        print("\n✅ Archive system ready - all items are now active/archived instead of deleted")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    add_archive_columns()
