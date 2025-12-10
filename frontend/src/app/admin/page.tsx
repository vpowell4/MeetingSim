'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: 'super' | 'admin' | 'manager' | 'user';
  organization_id: number | null;
  department_id: number | null;
  title: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface Organization {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Department {
  id: number;
  organization_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

type TabType = 'users' | 'organizations' | 'departments';

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('users');
  
  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Organizations state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  
  // Departments state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  
  // Form states
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user' as User['role'],
    organization_id: '',
    department_id: '',
    title: '',
    phone: ''
  });
  
  const [orgForm, setOrgForm] = useState({
    name: '',
    description: ''
  });
  
  const [deptForm, setDeptForm] = useState({
    organization_id: '',
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      if (activeTab === 'users') fetchUsers();
      if (activeTab === 'organizations') fetchOrganizations();
      if (activeTab === 'departments') fetchDepartments();
    }
  }, [activeTab, currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/api/v1/users/me');
      const user = response.data;
      setCurrentUser(user);
      
      // Check if user has admin privileges
      if (!['super', 'admin', 'manager'].includes(user.role)) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      router.push('/login');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/v1/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await api.get('/api/v1/organizations');
      setOrganizations(response.data);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/api/v1/departments');
      setDepartments(response.data);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/users', {
        ...userForm,
        organization_id: userForm.organization_id ? parseInt(userForm.organization_id) : null,
        department_id: userForm.department_id ? parseInt(userForm.department_id) : null
      });
      setShowUserForm(false);
      resetUserForm();
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      await api.put(`/api/v1/users/${editingUser.id}`, {
        full_name: userForm.full_name,
        role: userForm.role,
        organization_id: userForm.organization_id ? parseInt(userForm.organization_id) : null,
        department_id: userForm.department_id ? parseInt(userForm.department_id) : null,
        title: userForm.title,
        phone: userForm.phone
      });
      setEditingUser(null);
      resetUserForm();
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await api.delete(`/api/v1/users/${userId}`);
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      email: user.email,
      password: '',
      full_name: user.full_name || '',
      role: user.role,
      organization_id: user.organization_id?.toString() || '',
      department_id: user.department_id?.toString() || '',
      title: user.title || '',
      phone: user.phone || ''
    });
    setShowUserForm(true);
  };

  const resetUserForm = () => {
    setUserForm({
      email: '',
      password: '',
      full_name: '',
      role: getAvailableRolesForCreate()[0]?.value as User['role'] || 'user',
      organization_id: currentUser?.organization_id?.toString() || '',
      department_id: currentUser?.department_id?.toString() || '',
      title: '',
      phone: ''
    });
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/organizations', orgForm);
      setShowOrgForm(false);
      setOrgForm({ name: '', description: '' });
      fetchOrganizations();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create organization');
    }
  };

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    
    try {
      await api.put(`/api/v1/organizations/${editingOrg.id}`, orgForm);
      setEditingOrg(null);
      setOrgForm({ name: '', description: '' });
      fetchOrganizations();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update organization');
    }
  };

  const handleDeleteOrg = async (orgId: number) => {
    if (!confirm('Are you sure? This will affect all users in this organization.')) return;
    
    try {
      await api.delete(`/api/v1/organizations/${orgId}`);
      fetchOrganizations();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete organization');
    }
  };

  const startEditOrg = (org: Organization) => {
    setEditingOrg(org);
    setOrgForm({
      name: org.name,
      description: org.description || ''
    });
    setShowOrgForm(true);
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/api/v1/departments', {
        ...deptForm,
        organization_id: parseInt(deptForm.organization_id)
      });
      setShowDeptForm(false);
      setDeptForm({ organization_id: '', name: '', description: '' });
      fetchDepartments();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create department');
    }
  };

  const handleUpdateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept) return;
    
    try {
      await api.put(`/api/v1/departments/${editingDept.id}`, {
        name: deptForm.name,
        description: deptForm.description
      });
      setEditingDept(null);
      setDeptForm({ organization_id: '', name: '', description: '' });
      fetchDepartments();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to update department');
    }
  };

  const handleDeleteDept = async (deptId: number) => {
    if (!confirm('Are you sure? This will affect all users in this department.')) return;
    
    try {
      await api.delete(`/api/v1/departments/${deptId}`);
      fetchDepartments();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to delete department');
    }
  };

  const startEditDept = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      organization_id: dept.organization_id.toString(),
      name: dept.name,
      description: dept.description || ''
    });
    setShowDeptForm(true);
  };

  const getRoleBadgeColor = (role: User['role']) => {
    switch (role) {
      case 'super': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'manager': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOrgName = (orgId: number | null) => {
    if (!orgId) return 'N/A';
    const org = organizations.find(o => o.id === orgId);
    return org?.name || 'Unknown';
  };

  const getDeptName = (deptId: number | null) => {
    if (!deptId) return 'N/A';
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || 'Unknown';
  };

  // Permission helpers
  const canCreateUserWithRole = (role: User['role']) => {
    if (currentUser?.role === 'super') return true;
    if (currentUser?.role === 'admin') return ['admin', 'manager', 'user'].includes(role);
    if (currentUser?.role === 'manager') return role === 'user';
    return false;
  };

  const canEditUser = (targetUser: User) => {
    if (!currentUser) return false;
    // Can always edit self
    if (currentUser.id === targetUser.id) return true;
    
    // Super can edit anyone in org
    if (currentUser.role === 'super') {
      return currentUser.organization_id === targetUser.organization_id;
    }
    
    // Admin can edit anyone in org
    if (currentUser.role === 'admin') {
      return currentUser.organization_id === targetUser.organization_id;
    }
    
    // Manager can edit users in their department
    if (currentUser.role === 'manager') {
      return currentUser.organization_id === targetUser.organization_id &&
             currentUser.department_id === targetUser.department_id;
    }
    
    return false;
  };

  const canDeleteUser = (targetUser: User) => {
    if (!currentUser) return false;
    // Cannot delete self
    if (currentUser.id === targetUser.id) return false;
    
    // Super can delete anyone in org
    if (currentUser.role === 'super') {
      return currentUser.organization_id === targetUser.organization_id;
    }
    
    // Admin can delete anyone except Super and other Admins in org
    if (currentUser.role === 'admin') {
      return currentUser.organization_id === targetUser.organization_id &&
             !['super', 'admin'].includes(targetUser.role);
    }
    
    // Manager can delete only Users in their department
    if (currentUser.role === 'manager') {
      return currentUser.organization_id === targetUser.organization_id &&
             currentUser.department_id === targetUser.department_id &&
             targetUser.role === 'user';
    }
    
    return false;
  };

  const getAvailableRolesForCreate = () => {
    if (currentUser?.role === 'super') {
      return [
        { value: 'user', label: 'User' },
        { value: 'manager', label: 'Manager' },
        { value: 'admin', label: 'Admin' },
        { value: 'super', label: 'Super' }
      ];
    }
    if (currentUser?.role === 'admin') {
      return [
        { value: 'user', label: 'User' },
        { value: 'manager', label: 'Manager' },
        { value: 'admin', label: 'Admin' }
      ];
    }
    if (currentUser?.role === 'manager') {
      return [
        { value: 'user', label: 'User' }
      ];
    }
    return [];
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Administration</h1>
            <p className="text-gray-600 mt-2">
              Manage users, organizations, and departments
            </p>
            
            {/* Permission Scope Info */}
            {currentUser.role === 'super' && (
              <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">ℹ️</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900 mb-1">Your Admin Scope</h3>
                    <div className="text-sm text-purple-800 space-y-1">
                      <p>• Full organization control - manage all users, organizations, and departments</p>
                      <p>• Create/edit/delete any role including other Super admins</p>
                      <p>• No sharing restrictions</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {currentUser.role === 'admin' && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">ℹ️</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-1">Your Admin Scope</h3>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p>• Organization-wide management - manage all users and departments in your org</p>
                      <p>• Create/edit Admin, Manager, and User roles</p>
                      <p>• Cannot manage Super admins or other organizations</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {currentUser.role === 'manager' && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">ℹ️</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900 mb-1">Your Admin Scope</h3>
                    <div className="text-sm text-green-800 space-y-1">
                      <p>• Department-level management - manage users in your department only</p>
                      <p>• Create/edit User roles only</p>
                      <p>• Cannot manage Admins, Managers, or other departments</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Users
            </button>
            {currentUser.role === 'super' && (
              <button
                onClick={() => setActiveTab('organizations')}
                className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === 'organizations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Organizations
              </button>
            )}
            {['super', 'admin'].includes(currentUser.role) && (
              <button
                onClick={() => setActiveTab('departments')}
                className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                  activeTab === 'departments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Departments
              </button>
            )}
          </div>

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-semibold">Users</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {currentUser.role === 'super' && 'Viewing all users in your organization'}
                    {currentUser.role === 'admin' && 'Viewing all users in your organization'}
                    {currentUser.role === 'manager' && 'Viewing users in your department'}
                  </p>
                </div>
                {!showUserForm && getAvailableRolesForCreate().length > 0 && (
                  <Button
                    onClick={() => {
                      setEditingUser(null);
                      resetUserForm();
                      setShowUserForm(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    + Create User
                  </Button>
                )}
              </div>

              {showUserForm && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>{editingUser ? 'Edit User' : 'Create New User'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Email</label>
                          <Input
                            type="email"
                            value={userForm.email}
                            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                            required
                            disabled={!!editingUser}
                          />
                        </div>
                        {!editingUser && (
                          <div>
                            <label className="block text-sm font-medium mb-1">Password</label>
                            <Input
                              type="password"
                              value={userForm.password}
                              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                              required={!editingUser}
                              minLength={8}
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium mb-1">Full Name</label>
                          <Input
                            value={userForm.full_name}
                            onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Role</label>
                          <select
                            value={userForm.role}
                            onChange={(e) => setUserForm({ ...userForm, role: e.target.value as User['role'] })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            disabled={(editingUser !== null) && !canCreateUserWithRole(userForm.role)}
                          >
                            {getAvailableRolesForCreate().map(role => (
                              <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                          </select>
                          {editingUser && (
                            <p className="text-xs text-gray-500 mt-1">
                              Role changes restricted by your permission level
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Organization</label>
                          <select
                            value={userForm.organization_id}
                            onChange={(e) => setUserForm({ ...userForm, organization_id: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          >
                            <option value="">Select Organization</option>
                            {organizations.map(org => (
                              <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Department</label>
                          <select
                            value={userForm.department_id}
                            onChange={(e) => setUserForm({ ...userForm, department_id: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          >
                            <option value="">Select Department</option>
                            {departments
                              .filter(d => d.organization_id === parseInt(userForm.organization_id))
                              .map(dept => (
                                <option key={dept.id} value={dept.id}>{dept.name}</option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Title</label>
                          <Input
                            value={userForm.title}
                            onChange={(e) => setUserForm({ ...userForm, title: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Phone</label>
                          <Input
                            value={userForm.phone}
                            onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                          {editingUser ? 'Update User' : 'Create User'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowUserForm(false);
                            setEditingUser(null);
                            resetUserForm();
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Role Hierarchy</h4>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-purple-100 text-purple-800 font-medium">SUPER</span>
                    <span className="text-gray-600">Full org control</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">ADMIN</span>
                    <span className="text-gray-600">Org management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-green-100 text-green-800 font-medium">MANAGER</span>
                    <span className="text-gray-600">Dept management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-gray-100 text-gray-800 font-medium">USER</span>
                    <span className="text-gray-600">Self-service only</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {users.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <p className="text-gray-500">No users found in your scope</p>
                    </CardContent>
                  </Card>
                ) : (
                  users.map(user => {
                    const roleColors = {
                      super: 'bg-purple-50 border-purple-200',
                      admin: 'bg-blue-50 border-blue-200',
                      manager: 'bg-green-50 border-green-200',
                      user: 'bg-gray-50 border-gray-200'
                    };
                    const cardColor = roleColors[user.role as keyof typeof roleColors] || 'bg-gray-50 border-gray-200';
                    
                    return (
                  <Card key={user.id} className={cardColor}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{user.full_name || user.email}</h3>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${getRoleBadgeColor(user.role)}`}>
                              {user.role.toUpperCase()}
                            </span>
                            {!user.is_active && (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                                INACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><span className="font-medium">Email:</span> {user.email}</p>
                            {user.title && <p><span className="font-medium">Title:</span> {user.title}</p>}
                            {user.phone && <p><span className="font-medium">Phone:</span> {user.phone}</p>}
                            <p><span className="font-medium">Organization:</span> {getOrgName(user.organization_id)}</p>
                            <p><span className="font-medium">Department:</span> {getDeptName(user.department_id)}</p>
                            <p><span className="font-medium">Created:</span> {new Date(user.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {canEditUser(user) && (
                            <Button
                              variant="outline"
                              onClick={() => startEditUser(user)}
                              className="h-9"
                            >
                              Edit
                            </Button>
                          )}
                          {canDeleteUser(user) && (
                            <Button
                              variant="outline"
                              onClick={() => handleDeleteUser(user.id)}
                              className="h-9 text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </Button>
                          )}
                          {user.id === currentUser.id && (
                            <span className="text-xs text-gray-500 flex items-center px-2">
                              (You)
                            </span>
                          )}
                          {!canEditUser(user) && !canDeleteUser(user) && user.id !== currentUser.id && (
                            <span className="text-xs text-gray-400 flex items-center px-2">
                              No permissions
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Organizations Tab */}
          {activeTab === 'organizations' && currentUser.role === 'super' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-semibold">Organizations</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Super admins only - manage all organizations
                  </p>
                </div>
                {!showOrgForm && (
                  <Button
                    onClick={() => {
                      setEditingOrg(null);
                      setOrgForm({ name: '', description: '' });
                      setShowOrgForm(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    + Create Organization
                  </Button>
                )}
              </div>

              {showOrgForm && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>{editingOrg ? 'Edit Organization' : 'Create New Organization'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={editingOrg ? handleUpdateOrg : handleCreateOrg} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <Input
                          value={orgForm.name}
                          onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                          value={orgForm.description}
                          onChange={(e) => setOrgForm({ ...orgForm, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                          {editingOrg ? 'Update Organization' : 'Create Organization'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowOrgForm(false);
                            setEditingOrg(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4">
                {organizations.map(org => (
                  <Card key={org.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg mb-2">{org.name}</h3>
                          {org.description && (
                            <p className="text-sm text-gray-600 mb-2">{org.description}</p>
                          )}
                          <p className="text-sm text-gray-500">
                            Created: {new Date(org.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => startEditOrg(org)}
                            className="h-9"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleDeleteOrg(org.id)}
                            className="h-9 text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Departments Tab */}
          {activeTab === 'departments' && ['super', 'admin'].includes(currentUser.role) && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-semibold">Departments</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {currentUser.role === 'super' && 'Manage departments across all organizations'}
                    {currentUser.role === 'admin' && 'Manage departments in your organization'}
                  </p>
                </div>
                {!showDeptForm && (
                  <Button
                    onClick={() => {
                      setEditingDept(null);
                      setDeptForm({ organization_id: '', name: '', description: '' });
                      setShowDeptForm(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    + Create Department
                  </Button>
                )}
              </div>

              {showDeptForm && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>{editingDept ? 'Edit Department' : 'Create New Department'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={editingDept ? handleUpdateDept : handleCreateDept} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Organization</label>
                        <select
                          value={deptForm.organization_id}
                          onChange={(e) => setDeptForm({ ...deptForm, organization_id: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          required
                          disabled={!!editingDept}
                        >
                          <option value="">Select Organization</option>
                          {organizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <Input
                          value={deptForm.name}
                          onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea
                          value={deptForm.description}
                          onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                          {editingDept ? 'Update Department' : 'Create Department'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowDeptForm(false);
                            setEditingDept(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4">
                {departments.map(dept => (
                  <Card key={dept.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg mb-2">{dept.name}</h3>
                          <p className="text-sm text-gray-600 mb-2">
                            Organization: {getOrgName(dept.organization_id)}
                          </p>
                          {dept.description && (
                            <p className="text-sm text-gray-600 mb-2">{dept.description}</p>
                          )}
                          <p className="text-sm text-gray-500">
                            Created: {new Date(dept.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => startEditDept(dept)}
                            className="h-9"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleDeleteDept(dept.id)}
                            className="h-9 text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
