'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Plus, Eye, Undo2, Trash2, Archive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Minutes {
  id: number;
  meeting_id: number;
  title: string;
  issue: string;
  decision: string | null;
  summary: string | null;
  participants: string[];
  meeting_date: string;
  created_at: string;
  is_archived?: boolean;
}

export default function MinutesLibraryPage() {
  const router = useRouter();
  const [minutes, setMinutes] = useState<Minutes[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [filterMode, setFilterMode] = useState<'active' | 'archived'>('active');

  useEffect(() => {
    fetchMinutes();
  }, []);

  useEffect(() => {
    fetchMinutes();
  }, [filterMode]);

  const fetchMinutes = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/v1/minutes?filter=${filterMode}`);
      setMinutes(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load minutes');
    } finally {
      setLoading(false);
    }
  };

  const filteredMinutes = minutes.filter(minute => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      minute.title.toLowerCase().includes(query) ||
      minute.issue.toLowerCase().includes(query) ||
      minute.decision?.toLowerCase().includes(query)
    );
  });

  const handleDelete = async (id: number) => {
    const minute = minutes.find(m => m.id === id);
    const isArchived = minute?.is_archived;
    
    if (isArchived) {
      if (!window.confirm('Are you sure you want to permanently delete these minutes? This cannot be undone.')) {
        return;
      }
      try {
        await api.delete(`/api/v1/minutes/${id}`);
        fetchMinutes();
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to delete minutes');
      }
    } else {
      try {
        await api.post(`/api/v1/minutes/${id}/archive`);
        fetchMinutes();
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to archive minutes');
      }
    }
  };

  const handleRestore = async (id: number) => {
    try {
      await api.post(`/api/v1/minutes/${id}/unarchive`);
      fetchMinutes();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to restore minutes');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-4 sm:py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b bg-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Minutes Library</h1>
              <p className="text-sm text-gray-600 mt-1">View and manage meeting minutes</p>
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
            </div>
          </div>
          <div className="mt-4">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search minutes by title or issue..."
              className="w-full"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading minutes...</p>
          </div>
        ) : filteredMinutes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No minutes found' : 'No minutes yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery ? 'Try adjusting your search terms' : 'Meeting minutes are automatically created when meetings conclude'}
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => router.push('/meetings/new')}
                  variant="primary"
                >
                  Create New Meeting
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          viewMode === 'card' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredMinutes.map((minute) => (
              <Card
                key={minute.id}
                className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col"
              >
                <CardHeader>
                  <CardTitle className="text-lg">{minute.title}</CardTitle>
                  <p className="text-xs text-gray-500">
                    {formatDate(minute.meeting_date)}
                  </p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Issue:</p>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {minute.issue}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700">Participants:</p>
                      <p className="text-sm text-gray-600">
                        {minute.participants.join(', ')}
                      </p>
                    </div>

                    {minute.decision && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Decision:</p>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {minute.decision}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    {minute.is_archived ? (
                      <>
                        <Button
                          onClick={() => router.push(`/minutes/${minute.id}`)}
                          variant="default"
                          className="flex-1 h-9 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 flex items-center gap-1"
                        >
                          <Eye size={16} /> View
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(minute.id);
                          }}
                          variant="outline"
                          className="flex-1 h-9 text-xs font-medium border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 px-3 flex items-center gap-1"
                        >
                          <Undo2 size={16} /> Restore
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(minute.id);
                          }}
                          variant="outline"
                          className="flex-1 h-9 text-xs font-medium border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 px-3 flex items-center gap-1"
                        >
                          <Trash2 size={16} /> Delete
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={() => router.push(`/minutes/${minute.id}`)}
                          variant="default"
                          className="flex-1 h-9 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 flex items-center gap-1"
                        >
                          <Eye size={16} /> View
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(minute.id);
                          }}
                          variant="outline"
                          className="flex-1 h-9 text-xs font-medium border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400 px-3 flex items-center gap-1"
                        >
                          <Archive size={16} /> Archive
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decision</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMinutes.map((minute) => (
                    <tr key={minute.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer" onClick={() => router.push(`/minutes/${minute.id}`)}>
                          {minute.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">{minute.issue}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(minute.meeting_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {minute.participants.join(', ')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                        {minute.decision ? (
                          <div className="line-clamp-2">{minute.decision}</div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-2 justify-end">
                          {minute.is_archived ? (
                            <>
                              <Button
                                onClick={() => router.push(`/minutes/${minute.id}`)}
                                variant="default"
                                className="h-8 text-xs px-3 font-medium bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                View
                              <Button
                                onClick={() => router.push('/meetings/new')}
                                variant="primary"
                                className="flex items-center gap-2"
                              >
                                <Plus size={18} /> New Minutes
                              </Button>
                                className="h-8 text-xs px-3 font-medium border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
                              >
                                Restore
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(minute.id);
                                }}
                                variant="outline"
                                className="h-8 text-xs px-3 font-medium border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                              >
                                Delete
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                onClick={() => router.push(`/minutes/${minute.id}`)}
                                variant="default"
                                className="h-8 text-xs px-3 font-medium bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                View
                              </Button>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(minute.id);
                                }}
                                variant="outline"
                                className="h-8 text-xs px-3 font-medium border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400"
                              >
                                Archive
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
    </div>
  );
}
