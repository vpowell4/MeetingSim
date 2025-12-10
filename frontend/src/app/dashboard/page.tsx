'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { clearAuth, getStoredUser } from '@/lib/auth';
import { Meeting } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Plus, Copy, Share2, Archive, X, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function DashboardPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'active' | 'archived'>('active');
  const [shareDialogMeetingId, setShareDialogMeetingId] = useState<number | null>(null);
  const [shareEmails, setShareEmails] = useState('');
  const [shareError, setShareError] = useState('');

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      router.push('/login');
      return;
    }
    setUser(storedUser);
    fetchMeetings();
  }, []); // Remove router dependency to prevent re-renders

  useEffect(() => {
    if (user) {
      fetchMeetings();
    }
  }, [filterMode]);

  const fetchMeetings = async () => {
    try {
      setError('');
      const response = await api.get(`/api/v1/meetings?filter=${filterMode}`);
      setMeetings(response.data);
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to fetch meetings:', error);
      // If unauthorized, redirect to login
      if (error.response?.status === 401) {
        clearAuth();
        router.push('/login');
      } else {
        setError('Failed to load meetings. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  const filteredMeetings = meetings.filter(meeting => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      meeting.title.toLowerCase().includes(query) ||
      meeting.issue.toLowerCase().includes(query) ||
      meeting.decision?.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const copyMeeting = async (e: React.MouseEvent, meeting: Meeting) => {
    e.preventDefault(); // Prevent card click navigation
    try {
      // Fetch full meeting details including agents_config and conditions
      const response = await api.get(`/api/v1/meetings/${meeting.id}`);
      const fullMeeting = response.data;
      
      // Store meeting data for the new meeting form
      const copyData = {
        title: `${meeting.title} (Copy)`,
        issue: meeting.issue,
        context: meeting.context || '',
        agents: fullMeeting.agents_config || [],
        conditions: fullMeeting.conditions || {
          time_pressure: 0.5,
          formality: 0.5,
          conflict_tolerance: 0.5,
          decision_threshold: 0.7,
          max_turns: 50,
          creativity_mode: false
        }
      };
      
      localStorage.setItem('copyMeetingData', JSON.stringify(copyData));
      router.push('/meetings/new');
    } catch (error) {
      console.error('Failed to copy meeting:', error);
      setError('Failed to copy meeting. Please try again.');
    }
  };

  const deleteMeeting = async (e: React.MouseEvent, meetingId: number) => {
    e.preventDefault();
    const meeting = meetings.find(m => m.id === meetingId);
    const isArchived = meeting?.is_archived;
    
    if (isArchived) {
      if (!window.confirm('Are you sure you want to permanently delete this meeting? This cannot be undone.')) {
        return;
      }
      try {
        await api.delete(`/api/v1/meetings/${meetingId}`);
        fetchMeetings();
      } catch (error) {
        console.error('Failed to delete meeting:', error);
        setError('Failed to delete meeting. Please try again.');
      }
    } else {
      // Archive instead of delete for active meetings
      try {
        await api.post(`/api/v1/meetings/${meetingId}/archive`);
        fetchMeetings();
      } catch (error) {
        console.error('Failed to archive meeting:', error);
        setError('Failed to archive meeting. Please try again.');
      }
    }
  };

  const archiveMeeting = async (e: React.MouseEvent, meetingId: number) => {
    e.preventDefault();
    try {
      await api.post(`/api/v1/meetings/${meetingId}/archive`);
      fetchMeetings();
    } catch (error) {
      console.error('Failed to archive meeting:', error);
      setError('Failed to archive meeting. Please try again.');
    }
  };

  const restoreMeeting = async (e: React.MouseEvent, meetingId: number) => {
    e.preventDefault();
    try {
      await api.post(`/api/v1/meetings/${meetingId}/unarchive`);
      fetchMeetings();
    } catch (error) {
      console.error('Failed to restore meeting:', error);
      setError('Failed to restore meeting. Please try again.');
    }
  };

  const handleShareMeeting = async () => {
    if (!shareDialogMeetingId) return;
    
    setShareError('');
    const emails = shareEmails.split(',').map(e => e.trim()).filter(e => e);
    
    if (emails.length === 0) {
      setShareError('Please enter at least one email address');
      return;
    }

    try {
      await api.post(`/api/v1/meetings/${shareDialogMeetingId}/share`, {
        meeting_id: shareDialogMeetingId,
        user_emails: emails
      });
      
      setShareDialogMeetingId(null);
      setShareEmails('');
      setShareError('');
      fetchMeetings();
    } catch (error: any) {
      console.error('Failed to share meeting:', error);
      setShareError(error.response?.data?.detail || 'Failed to share meeting. Please try again.');
    }
  };

  if (!user) {
    return null; // Prevent flash before redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-4 sm:py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b bg-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Your Meetings</h2>
              <p className="mt-1 text-sm text-gray-600">
                Create and manage AI-powered meeting simulations
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-gray-300 bg-white">
                <button
                  onClick={() => setFilterMode('active')}
                  className={`px-3 py-2 text-sm font-medium rounded-l-lg transition-colors ${
                    filterMode === 'active'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setFilterMode('archived')}
                  className={`px-3 py-2 text-sm font-medium rounded-r-lg transition-colors ${
                    filterMode === 'archived'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Archived
                </button>
              </div>
              <div className="flex rounded-lg border border-gray-300 bg-white">
                <button
                  onClick={() => setViewMode('card')}
                  className={`px-3 py-2 text-sm font-medium rounded-l-lg transition-colors ${
                    viewMode === 'card'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  📇 Cards
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 text-sm font-medium rounded-r-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  📋 List
                </button>
              </div>
              <Link href="/meetings/new">
                <Button variant="primary" size="lg" className="flex items-center gap-1">
                  <Plus size={18} /> New Meeting
                </Button>
              </Link>
            </div>
          </div>
          <div className="mt-4">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search meetings by title, issue, or decision..."
              className="w-full"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error}
            <Button variant="ghost" size="sm" onClick={fetchMeetings} className="ml-4 flex items-center gap-1">
              <RefreshCw size={16} /> Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading meetings...</p>
          </div>
        ) : filteredMeetings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No meetings found' : 'No meetings yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery ? 'Try adjusting your search terms' : 'Get started by creating your first meeting simulation'}
              </p>
              {!searchQuery && (
                <Link href="/meetings/new">
                  <Button variant="primary">Create Meeting</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          viewMode === 'card' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredMeetings.map((meeting) => (
              <Card key={meeting.id} className="h-full transition-shadow hover:shadow-lg flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Link href={`/meetings/${meeting.id}`} className="flex-1">
                      <CardTitle className="text-lg hover:text-blue-600">{meeting.title}</CardTitle>
                    </Link>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(
                          meeting.status
                        )}`}
                      >
                        {meeting.status}
                      </span>
                      {meeting.is_shared && !meeting.is_owner && meeting.shared_by && (
                        <span className="rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                          Shared by: {meeting.shared_by}
                        </span>
                      )}
                      {meeting.is_archived && (
                        <span className="rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800">
                          Archived
                        </span>
                      )}
                    </div>
                  </div>
                  <Link href={`/meetings/${meeting.id}`}>
                    <CardDescription className="line-clamp-2">
                      {meeting.issue}
                    </CardDescription>
                  </Link>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm text-gray-500 mb-2">
                      <div>Created {new Date(meeting.created_at).toLocaleDateString()}</div>
                      {meeting.completed_at && (
                        <div>Last Run {new Date(meeting.completed_at).toLocaleDateString()}</div>
                      )}
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 mb-2">
                      <div><strong>Owner:</strong> {user?.full_name || user?.email || 'Unknown'}</div>
                      <div><strong>#Run:</strong> {meeting.run_count || 0}</div>
                    </div>
                    {meeting.decision && (
                      <div className="mt-2 text-sm bg-green-50 p-2 rounded">
                        <strong>Decision:</strong>{' '}
                        <span className="text-gray-700">{meeting.decision}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {meeting.is_archived ? (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={(e) => copyMeeting(e, meeting)}
                          className="flex-1 h-9 text-xs font-medium border-gray-300 hover:bg-gray-50"
                        >
                          Copy
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={(e) => restoreMeeting(e, meeting.id)}
                          className="flex-1 h-9 text-xs font-medium border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
                        >
                          Restore
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={(e) => deleteMeeting(e, meeting.id)}
                          className="flex-1 h-9 text-xs font-medium border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <>
                        <Link href={`/meetings/${meeting.id}`} className="flex-1">
                          <Button variant="default" className="w-full h-9 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white">
                            Edit
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          onClick={(e) => copyMeeting(e, meeting)}
                          className="flex-1 h-9 text-xs font-medium border-gray-300 hover:bg-gray-50"
                        >
                          Copy
                        </Button>
                        {meeting.is_owner !== false && (
                          <Button 
                            variant="outline" 
                            onClick={() => setShareDialogMeetingId(meeting.id)}
                            className="flex-1 h-9 text-xs font-medium border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
                          >
                            Share
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          onClick={(e) => deleteMeeting(e, meeting.id)}
                          className="flex-1 h-9 text-xs font-medium border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400"
                        >
                          Archive
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Run</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#Run</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decision</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMeetings.map((meeting) => (
                    <tr key={meeting.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={`/meetings/${meeting.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                          {meeting.title}
                        </Link>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">{meeting.issue}</div>
                        {meeting.is_shared && !meeting.is_owner && meeting.shared_by && (
                          <div className="text-xs text-blue-600 mt-1">Shared by: {meeting.shared_by}</div>
                        )}
                        {meeting.is_archived && (
                          <div className="text-xs text-gray-600 mt-1">Archived</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(meeting.status)}`}>
                          {meeting.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(meeting.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {meeting.completed_at ? new Date(meeting.completed_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {meeting.run_count || 0}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                        {meeting.decision ? (
                          <div className="bg-green-50 px-2 py-1 rounded text-xs line-clamp-2">{meeting.decision}</div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-2 justify-end">
                          {meeting.is_archived ? (
                            <>
                              <Button 
                                variant="outline" 
                                onClick={(e) => copyMeeting(e, meeting)}
                                className="h-8 text-xs px-3 font-medium border-gray-300 hover:bg-gray-50 flex items-center gap-1"
                              >
                                <Copy size={16} /> Copy
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={(e) => restoreMeeting(e, meeting.id)}
                                className="h-8 text-xs px-3 font-medium border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
                              >
                                Restore
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={(e) => deleteMeeting(e, meeting.id)}
                                className="h-8 text-xs px-3 font-medium border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                              >
                                Delete
                              </Button>
                            </>
                          ) : (
                            <>
                              <Link href={`/meetings/${meeting.id}`}>
                                <Button variant="default" className="h-8 text-xs px-3 font-medium bg-blue-600 hover:bg-blue-700 text-white">Edit</Button>
                              </Link>
                              <Button 
                                variant="outline" 
                                onClick={(e) => copyMeeting(e, meeting)}
                                className="h-8 text-xs px-3 font-medium border-gray-300 hover:bg-gray-50"
                              >
                                Copy
                              </Button>
                              {meeting.is_owner !== false && (
                                <Button 
                                  variant="outline" 
                                  onClick={() => setShareDialogMeetingId(meeting.id)}
                                  className="h-8 text-xs px-3 font-medium border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 flex items-center gap-1"
                                >
                                  <Share2 size={16} /> Share
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                onClick={(e) => deleteMeeting(e, meeting.id)}
                                className="h-8 text-xs px-3 font-medium border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400 flex items-center gap-1"
                              >
                                <Archive size={16} /> Archive
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </main>

      <Dialog open={!!shareDialogMeetingId} onOpenChange={(open) => !open && setShareDialogMeetingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Meeting</DialogTitle>
            <DialogDescription>
              Enter email addresses of users you want to share this meeting with (comma-separated)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={shareEmails}
              onChange={(e) => setShareEmails(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              className="w-full"
            />
            {shareError && (
              <div className="text-sm text-red-600">{shareError}</div>
            )}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShareDialogMeetingId(null);
                  setShareEmails('');
                  setShareError('');
                }}
                className="px-4 font-medium flex items-center gap-1"
              >
                <X size={16} /> Cancel
              </Button>
              <Button
                onClick={handleShareMeeting}
                disabled={!shareEmails.trim()}
                className="px-4 font-medium bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-300 flex items-center gap-1"
              >
                <Share2 size={16} /> Share Meeting
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
