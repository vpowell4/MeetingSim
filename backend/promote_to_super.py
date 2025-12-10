"""Script to promote a user to Super admin role"""
import sqlite3
from pathlib import Path

def promote_to_super():
    db_path = Path(__file__).parent / "meeting_simulator.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get all users
        cursor.execute("SELECT id, email, role FROM users")
        users = cursor.fetchall()
        
        print("📋 Current Users:")
        print("-" * 80)
        for user_id, email, role in users:
            print(f"ID: {user_id} | Email: {email} | Role: {role}")
        
        # Prompt for user to promote
        print("\n" + "=" * 80)
        user_id = input("\nEnter user ID to promote to Super admin: ")
        
        if not user_id.isdigit():
            print("❌ Invalid user ID")
            return
        
        user_id = int(user_id)
        
        # Check if user exists
        cursor.execute("SELECT email, role FROM users WHERE id = ?", (user_id,))
        result = cursor.fetchone()
        
        if not result:
            print(f"❌ User with ID {user_id} not found")
            return
        
        email, current_role = result
        
        # Confirm
        print(f"\n⚠️  You are about to promote:")
        print(f"   Email: {email}")
        print(f"   Current Role: {current_role}")
        print(f"   New Role: super")
        
        confirm = input("\nProceed? (yes/no): ")
        
        if confirm.lower() != 'yes':
            print("❌ Cancelled")
            return
        
        # Update role (use uppercase to match enum)
        cursor.execute("UPDATE users SET role = 'SUPER' WHERE id = ?", (user_id,))
        conn.commit()
        
        print(f"\n✅ Successfully promoted {email} to Super admin!")
        
        # Show updated users
        cursor.execute("SELECT id, email, role FROM users")
        users = cursor.fetchall()
        
        print("\n📋 Updated Users:")
        print("-" * 80)
        for uid, em, ro in users:
            marker = " ← SUPER" if uid == user_id else ""
            print(f"ID: {uid} | Email: {em} | Role: {ro}{marker}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    promote_to_super()
