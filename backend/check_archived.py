"""Check archived items in the database"""
import sqlite3

def check_archived():
    conn = sqlite3.connect('meeting_simulator.db')
    cursor = conn.cursor()
    
    try:
        # Check archived meetings
        cursor.execute("SELECT id, title, is_archived FROM meetings")
        meetings = cursor.fetchall()
        
        print("\n📋 MEETINGS:")
        print("-" * 80)
        for meeting_id, title, is_archived in meetings:
            status = "🗄️ ARCHIVED" if is_archived else "✅ ACTIVE"
            print(f"{status} | ID: {meeting_id} | {title}")
        
        archived_count = sum(1 for _, _, is_archived in meetings if is_archived)
        active_count = len(meetings) - archived_count
        print(f"\nTotal: {len(meetings)} meetings ({active_count} active, {archived_count} archived)")
        
        # Check agent profiles
        cursor.execute("SELECT id, name, is_archived FROM agent_profiles")
        agents = cursor.fetchall()
        
        print("\n👤 AGENT PROFILES:")
        print("-" * 80)
        for agent_id, name, is_archived in agents:
            status = "🗄️ ARCHIVED" if is_archived else "✅ ACTIVE"
            print(f"{status} | ID: {agent_id} | {name}")
        
        # Check meeting shares
        cursor.execute("""
            SELECT ms.id, m.title, u.email, ms.is_archived 
            FROM meeting_shares ms
            JOIN meetings m ON ms.meeting_id = m.id
            JOIN users u ON ms.shared_with_user_id = u.id
        """)
        shares = cursor.fetchall()
        
        if shares:
            print("\n🔗 SHARED MEETINGS:")
            print("-" * 80)
            for share_id, title, shared_with, is_archived in shares:
                status = "🗄️ ARCHIVED" if is_archived else "✅ ACTIVE"
                print(f"{status} | Share ID: {share_id} | Meeting: {title} | Shared with: {shared_with}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_archived()
