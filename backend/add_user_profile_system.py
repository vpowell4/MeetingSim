"""Migration script to add user profile and security system"""
import sqlite3
from pathlib import Path

def migrate():
    db_path = Path(__file__).parent / "meeting_simulator.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Create organizations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS organizations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
            )
        """)
        print("✅ Created organizations table")
        
        # Create departments table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS departments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                organization_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (organization_id) REFERENCES organizations(id)
            )
        """)
        print("✅ Created departments table")
        
        # Add new columns to users table
        new_columns = [
            ("role", "VARCHAR(20) DEFAULT 'user'"),
            ("organization_id", "INTEGER"),
            ("department_id", "INTEGER"),
            ("title", "VARCHAR(255)"),
            ("phone", "VARCHAR(50)"),
            ("allowed_share_users", "TEXT"),
            ("allowed_share_orgs", "TEXT"),
            ("allowed_share_depts", "TEXT")
        ]
        
        # Check which columns already exist
        cursor.execute("PRAGMA table_info(users)")
        existing_columns = {row[1] for row in cursor.fetchall()}
        
        for column_name, column_def in new_columns:
            if column_name not in existing_columns:
                try:
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {column_name} {column_def}")
                    print(f"✅ Added {column_name} column to users table")
                except sqlite3.OperationalError as e:
                    print(f"⚠️  Column {column_name} might already exist: {e}")
            else:
                print(f"ℹ️  Column {column_name} already exists")
        
        # Create a default organization if none exists
        cursor.execute("SELECT COUNT(*) FROM organizations")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO organizations (name, description, is_active)
                VALUES ('Default Organization', 'Default organization for existing users', 1)
            """)
            print("✅ Created default organization")
            
            # Get the default org ID
            cursor.execute("SELECT id FROM organizations WHERE name = 'Default Organization'")
            default_org_id = cursor.fetchone()[0]
            
            # Create a default department
            cursor.execute("""
                INSERT INTO departments (organization_id, name, description, is_active)
                VALUES (?, 'General', 'General department', 1)
            """, (default_org_id,))
            print("✅ Created default department")
            
            # Get the default dept ID
            cursor.execute("SELECT id FROM departments WHERE name = 'General'")
            default_dept_id = cursor.fetchone()[0]
            
            # Update existing users to be in default org/dept with user role
            cursor.execute("""
                UPDATE users 
                SET organization_id = ?, department_id = ?, role = 'user'
                WHERE organization_id IS NULL
            """, (default_org_id, default_dept_id))
            print("✅ Updated existing users with default organization and department")
        
        conn.commit()
        print("\n✅ Migration completed successfully!")
        
        # Show current state
        cursor.execute("SELECT COUNT(*) FROM organizations")
        org_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM departments")
        dept_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        
        print(f"\n📊 Current state:")
        print(f"   Organizations: {org_count}")
        print(f"   Departments: {dept_count}")
        print(f"   Users: {user_count}")
        
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
