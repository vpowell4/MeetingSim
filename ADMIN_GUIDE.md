npm install lucide-reactnpm install lucide-reactnpm install lucide-react# Admin Dashboard - Quick Reference Guide

## Setup Instructions

### 1. Promote Your User to Super Admin

Run this script to make your account a Super admin:

```bash
cd C:\Users\vince\OneDrive\Documents\Board_Simulator_001\backend
python promote_to_super.py
```

Follow the prompts to select your user account and promote it to Super role.

### 2. Restart Servers

Make sure both servers are running:
- Backend: Port 8000
- Frontend: Port 3000

### 3. Access Admin Dashboard

Navigate to: `http://localhost:3000/admin`

You should now see the Administration menu item in the sidebar (⚙️ icon).

---

## Role Permissions

### Super Admin
- **Full Control**: Can manage everything in their organization
- **Users**: Create, edit, delete any user; assign any role
- **Organizations**: Full CRUD operations
- **Departments**: Full CRUD operations
- **Restrictions**: Can set sharing restrictions for anyone

### Admin
- **Organization Scope**: Can manage their entire organization
- **Users**: Create, edit, delete users in their organization (except Super users)
- **Departments**: Create, edit, delete departments in their organization
- **Roles**: Can create Admin, Manager, User roles
- **Restrictions**: Can set sharing restrictions for users in their org

### Manager
- **Department Scope**: Can manage their department
- **Users**: Create, edit users in their department
- **Roles**: Can only create User roles
- **Restrictions**: Can set sharing restrictions for users in their department

### User
- **Self Only**: Can only manage their own profile and content
- **No Admin Access**: Cannot access admin dashboard

---

## Admin Dashboard Features

### Users Tab (All Roles)
- View all users within your scope
- Create new users with appropriate roles
- Edit user profiles (name, title, phone, org, dept)
- Assign roles based on your permissions
- Delete users (with appropriate permissions)
- See user details: email, title, phone, organization, department

**Badge Colors:**
- 🟣 Purple: Super
- 🔵 Blue: Admin
- 🟢 Green: Manager
- ⚪ Gray: User

### Organizations Tab (Super Only)
- Create new organizations
- Edit organization details (name, description)
- Delete organizations (if no users)
- View all organizations in the system

### Departments Tab (Super & Admin)
- Create new departments
- Edit department details (name, description)
- Delete departments (if no users)
- Link departments to organizations
- View all departments in accessible organizations

---

## User Creation Workflow

### Creating a New User:

1. Click "Create User" button
2. Fill in required fields:
   - **Email** (required, unique)
   - **Password** (required, min 8 characters)
   - **Full Name** (optional)
   - **Role** (based on your permissions)
   - **Organization** (select from dropdown)
   - **Department** (filtered by selected organization)
   - **Title** (optional, e.g., "Senior Manager")
   - **Phone** (optional)
3. Click "Create User"

### Role Restrictions:
- Super can create: Super, Admin, Manager, User
- Admin can create: Admin, Manager, User
- Manager can create: User only

---

## Editing Users

1. Click "Edit" button on any user card
2. Modify fields (note: email cannot be changed)
3. Click "Update User"

**What you can edit depends on your role:**
- Super/Admin: Can change role, org, dept, all profile fields
- Manager: Can only change profile fields (name, title, phone)
- Users: Can only edit their own profile via profile page

---

## Setting Sharing Restrictions

To restrict who a user can share content with:

1. Edit the user
2. (Future enhancement: Add sharing restriction fields to form)
3. Set allowed users, organizations, or departments

**Current API supports:**
- `allowed_share_users`: List of specific user IDs
- `allowed_share_orgs`: List of organization IDs
- `allowed_share_depts`: List of department IDs

*Note: Sharing restrictions UI will be enhanced in next update*

---

## Organization Management (Super Only)

### Create Organization:
1. Go to Organizations tab
2. Click "Create Organization"
3. Enter name and description
4. Click "Create Organization"

### Edit Organization:
1. Click "Edit" on organization card
2. Modify name or description
3. Click "Update Organization"

### Delete Organization:
- Can only delete if no users are assigned
- Must move or delete users first

---

## Department Management (Super & Admin)

### Create Department:
1. Go to Departments tab
2. Click "Create Department"
3. Select organization
4. Enter name and description
5. Click "Create Department"

### Edit Department:
1. Click "Edit" on department card
2. Modify name or description (org cannot be changed)
3. Click "Update Department"

### Delete Department:
- Can only delete if no users are assigned
- Must move or delete users first

---

## Database Structure

### Current Setup:
- **Organizations**: 1 (Default Organization)
- **Departments**: 1 (General)
- **Users**: 5 (all currently assigned to Default Organization / General)

### Tables:
- `organizations`: id, name, description, is_active
- `departments`: id, organization_id, name, description, is_active
- `users`: Extended with role, organization_id, department_id, title, phone, sharing restrictions

---

## API Endpoints

### Users
- `GET /api/v1/users` - List users (filtered by role)
- `POST /api/v1/users` - Create user
- `GET /api/v1/users/{id}` - Get user details
- `PUT /api/v1/users/{id}` - Update user
- `DELETE /api/v1/users/{id}` - Delete user
- `GET /api/v1/users/me` - Get current user
- `PUT /api/v1/users/me` - Update current user profile

### Organizations
- `GET /api/v1/organizations` - List organizations
- `POST /api/v1/organizations` - Create organization (Super only)
- `GET /api/v1/organizations/{id}` - Get organization
- `PUT /api/v1/organizations/{id}` - Update organization (Super only)
- `DELETE /api/v1/organizations/{id}` - Delete organization (Super only)

### Departments
- `GET /api/v1/departments` - List departments
- `POST /api/v1/departments` - Create department (Super/Admin)
- `GET /api/v1/departments/{id}` - Get department
- `PUT /api/v1/departments/{id}` - Update department (Super/Admin)
- `DELETE /api/v1/departments/{id}` - Delete department (Super/Admin)

---

## Troubleshooting

### "Not authorized" errors:
- Check your user role
- Verify you have permission for the action
- Super admins can only manage users in their own organization

### Cannot see admin menu:
- Ensure your user has role: super, admin, or manager
- Refresh the page after role change
- Check browser console for errors

### Cannot delete organization/department:
- Move users to another org/dept first
- Or delete the users first
- The system prevents orphaning users

### User not showing in list:
- Check role-based filtering (you can only see users in your scope)
- Super: sees org users
- Admin: sees org users
- Manager: sees dept users

---

## Best Practices

1. **Start with Organizations**: Create organizations before users
2. **Then Departments**: Create departments within organizations
3. **Finally Users**: Assign users to org/dept during creation
4. **Role Hierarchy**: Assign appropriate roles based on responsibilities
5. **Regular Review**: Periodically review user access and roles
6. **Sharing Restrictions**: Set restrictions for sensitive departments

---

## Security Notes

- Passwords must be at least 8 characters
- Email addresses must be unique
- Super admins have the highest privileges
- Managers cannot escalate their own privileges
- Users cannot delete themselves
- Organization/department deletion is protected

---

## Next Steps

After setting up the admin system:
1. Create your organization structure
2. Create departments as needed
3. Invite users and assign appropriate roles
4. Set sharing restrictions for sensitive departments
5. Test the permission system with different roles

---

For questions or issues, check the backend logs and frontend console for detailed error messages.
