"""Add goals column to agent_profiles table"""
import sqlite3
from pathlib import Path

def main():
    db_path = Path(__file__).parent / "meeting_simulator.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Adding goals column to agent_profiles table...")
        
        # Add goals column
        cursor.execute("""
            ALTER TABLE agent_profiles 
            ADD COLUMN goals TEXT
        """)
        
        conn.commit()
        print("✅ Successfully added goals column")
        
        # Verify the change
        cursor.execute("PRAGMA table_info(agent_profiles)")
        columns = cursor.fetchall()
        print("\nAgent profiles table structure:")
        for col in columns:
            print(f"  {col[1]}: {col[2]}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()
