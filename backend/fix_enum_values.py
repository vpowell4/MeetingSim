"""Fix UserRole enum values in database - convert lowercase to uppercase"""
import sqlite3
import os

# Get the database path
db_path = os.path.join(os.path.dirname(__file__), "meeting_simulator.db")

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Fixing UserRole enum values...")

# Update all role values from lowercase to uppercase
cursor.execute("""
    UPDATE users 
    SET role = UPPER(role)
    WHERE role IN ('super', 'admin', 'manager', 'user')
""")

updated_count = cursor.rowcount
print(f"Updated {updated_count} user records")

# Commit changes
conn.commit()

# Verify the changes
cursor.execute("SELECT id, email, role FROM users")
users = cursor.fetchall()

print("\nCurrent users:")
for user_id, email, role in users:
    print(f"  ID: {user_id}, Email: {email}, Role: {role}")

conn.close()
print("\nDone! Enum values fixed.")
