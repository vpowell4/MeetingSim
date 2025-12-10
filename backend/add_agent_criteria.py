"""
Migration script to add criteria column to agent_profiles table
"""
import sqlite3
import os
import json

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), "meeting_simulator.db")

def add_criteria_column():
    """Add criteria JSON column to agent_profiles table"""
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found at {DB_PATH}")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(agent_profiles)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "criteria" in columns:
            print("✅ criteria column already exists")
            conn.close()
            return
        
        # Add criteria column
        print("Adding criteria column...")
        cursor.execute("""
            ALTER TABLE agent_profiles 
            ADD COLUMN criteria TEXT
        """)
        
        # Set default criteria for existing records
        default_criteria = json.dumps({
            "cost": 0.5,
            "risk": 0.5,
            "speed": 0.5,
            "fairness": 0.5,
            "innovation": 0.5,
            "consensus": 0.5
        })
        
        cursor.execute("""
            UPDATE agent_profiles 
            SET criteria = ? 
            WHERE criteria IS NULL
        """, (default_criteria,))
        
        conn.commit()
        print("✅ Successfully added criteria column")
        print(f"✅ Updated {cursor.rowcount} existing records with default criteria")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    add_criteria_column()
