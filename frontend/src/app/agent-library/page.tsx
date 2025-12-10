'use client';

import { useEffect, useState } from 'react';
import { Copy, Share2, Edit2, Trash2, Archive, Eye, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface AgentProfile {
  id: number;
  name: string;
  role: string;
  persona: string;
  default_stance: string;
  default_dominance: number;
  traits: {
    interrupt: number;
    conflict_avoid: number;
    persuasion: number;
    assertiveness?: number;
    cooperation?: number;
    analytical?: number;
    emotional?: number;
    risk_tolerance?: number;
    creativity?: number;
    detail_oriented?: number;
    big_picture?: number;
  };
  goals?: {
    goals: Array<{
      text: string;
      importance: number;
      perspectives: Array<{
        agent: string;
        importance: number;
      }>;
    }>;
  };
  criteria?: {
    cost: number;
    risk: number;
    speed: number;
    fairness: number;
    innovation: number;
    consensus: number;
  };
  is_archived?: boolean;
}

export default function AgentLibraryPage() {
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [shareProfile, setShareProfile] = useState<AgentProfile | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
    // Copy profile as JSON to clipboard
    const handleCopy = async (profile: AgentProfile) => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(profile, null, 2));
        setCopySuccess(`Copied "${profile.name}" to clipboard!`);
        setTimeout(() => setCopySuccess(null), 2000);
      } catch {
        setCopySuccess('Failed to copy');
        setTimeout(() => setCopySuccess(null), 2000);
      }
    };

    // Share modal logic
    const handleShare = (profile: AgentProfile) => {
      setShareProfile(profile);
      setShowShareModal(true);
    };

    const closeShareModal = () => {
      setShowShareModal(false);
      setShareProfile(null);
    };
  const router = useRouter();
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'active' | 'archived'>('active');
  
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    persona: '',
    default_stance: 'neutral',
    default_dominance: 1.0,
    traits: {
      interrupt: 0.2,
      conflict_avoid: 0.5,
      persuasion: 0.5,
      assertiveness: 0.5,
      cooperation: 0.5,
      analytical: 0.5,
      emotional: 0.5,
      risk_tolerance: 0.5,
      creativity: 0.5,
      detail_oriented: 0.5,
      big_picture: 0.5
    },
    goals: {
      goals: [] as Array<{
        text: string;
        importance: number;
        perspectives: Array<{ agent: string; importance: number }>;
      }>
    },
    criteria: {
      cost: 0.5,
      risk: 0.5,
      speed: 0.5,
      fairness: 0.5,
      innovation: 0.5,
      consensus: 0.5
    }
  });

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.push('/login');
      return;
    }
    fetchProfiles();
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [filterMode]);

  const fetchProfiles = async () => {
    try {
      const response = await api.get(`/api/v1/agent-library?filter=${filterMode}`);
      setProfiles(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        await api.put(`/api/v1/agent-library/${editingId}`, formData);
      } else {
        await api.post('/api/v1/agent-library', formData);
      }
      
      resetForm();
      fetchProfiles();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save profile');
    }
  };

  const handleEdit = (profile: AgentProfile) => {
    setFormData({
      name: profile.name,
      role: profile.role || '',
      persona: profile.persona,
      default_stance: profile.default_stance,
      default_dominance: profile.default_dominance,
      traits: {
        interrupt: profile.traits.interrupt,
        conflict_avoid: profile.traits.conflict_avoid,
        persuasion: profile.traits.persuasion,
        assertiveness: profile.traits.assertiveness || 0.5,
        cooperation: profile.traits.cooperation || 0.5,
        analytical: profile.traits.analytical || 0.5,
        emotional: profile.traits.emotional || 0.5,
        risk_tolerance: profile.traits.risk_tolerance || 0.5,
        creativity: profile.traits.creativity || 0.5,
        detail_oriented: profile.traits.detail_oriented || 0.5,
        big_picture: profile.traits.big_picture || 0.5
      },
      goals: profile.goals || { goals: [] },
      criteria: profile.criteria || {
        cost: 0.5,
        risk: 0.5,
        speed: 0.5,
        fairness: 0.5,
        innovation: 0.5,
        consensus: 0.5
      }
    });
    setEditingId(profile.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      role: '',
      persona: '',
      default_stance: 'neutral',
      default_dominance: 1.0,
      traits: {
        interrupt: 0.2,
        conflict_avoid: 0.5,
        persuasion: 0.5,
        assertiveness: 0.5,
        cooperation: 0.5,
        analytical: 0.5,
        emotional: 0.5,
        risk_tolerance: 0.5,
        creativity: 0.5,
        detail_oriented: 0.5,
        big_picture: 0.5
      },
      goals: { goals: [] },
      criteria: {
        cost: 0.5,
        risk: 0.5,
        speed: 0.5,
        fairness: 0.5,
        innovation: 0.5,
        consensus: 0.5
      }
    });
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const handleDelete = async (id: number) => {
    const profile = profiles.find(p => p.id === id);
    const isArchived = profile?.is_archived;
    
    if (isArchived) {
      if (!window.confirm('Are you sure you want to permanently delete this profile? This cannot be undone.')) {
        return;
      }
      try {
        await api.delete(`/api/v1/agent-library/${id}`);
        fetchProfiles();
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to delete profile');
      }
    } else {
      try {
        await api.post(`/api/v1/agent-library/${id}/archive`);
        fetchProfiles();
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to archive profile');
      }
    }
  };

  const handleRestore = async (id: number) => {
    try {
      await api.post(`/api/v1/agent-library/${id}/unarchive`);
      fetchProfiles();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to restore profile');
    }
  };

  const filteredProfiles = profiles.filter(profile => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      profile.name.toLowerCase().includes(query) ||
      profile.role?.toLowerCase().includes(query) ||
      profile.persona.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-4 sm:py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b bg-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Agent Library</h1>
              <p className="text-sm text-gray-600 mt-1">Create and manage reusable agent profiles</p>
            </div>
            <div className="flex gap-2">
              {!showForm && (
                <>
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
                </>
              )}
              {!showForm && (
                <Button variant="primary" size="lg" onClick={() => setShowForm(true)}>
                  + New Profile
                </Button>
              )}
            </div>
          </div>
          {!showForm && (
            <div className="mt-4">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agents by name, role, or persona..."
                className="w-full"
              />
            </div>
          )}
        </div>
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingId ? 'Edit Profile' : 'New Profile'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Role</label>
                    <Input
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      placeholder="e.g., CEO, CFO, CTO"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Persona *</label>
                  <Textarea
                    value={formData.persona}
                    onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                    rows={3}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Default Stance</label>
                  <select
                    value={formData.default_stance}
                    onChange={(e) => setFormData({ ...formData, default_stance: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="for">For</option>
                    <option value="neutral">Neutral</option>
                    <option value="against">Against</option>
                  </select>
                </div>

                {/* Behavioral Traits */}
                <div className="border-t pt-4 mt-4">
                  <label className="block text-sm font-medium mb-3">Behavioral Traits</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Dominance: {formData.default_dominance.toFixed(1)}
                      </label>
                      <input
                        type="range"
                        min="0.1"
                        max="3.0"
                        step="0.1"
                        value={formData.default_dominance}
                        onChange={(e) => setFormData({ ...formData, default_dominance: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Submissive</span>
                        <span>Dominant</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Interrupt: {formData.traits.interrupt.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.traits.interrupt}
                        onChange={(e) => setFormData({
                          ...formData,
                          traits: { ...formData.traits, interrupt: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Conflict Avoidance: {formData.traits.conflict_avoid.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.traits.conflict_avoid}
                        onChange={(e) => setFormData({
                          ...formData,
                          traits: { ...formData.traits, conflict_avoid: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Persuasion: {formData.traits.persuasion.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.traits.persuasion}
                        onChange={(e) => setFormData({
                          ...formData,
                          traits: { ...formData.traits, persuasion: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Assertiveness: {formData.traits.assertiveness.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.traits.assertiveness}
                        onChange={(e) => setFormData({
                          ...formData,
                          traits: { ...formData.traits, assertiveness: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Passive</span>
                        <span>Assertive</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Cooperation: {formData.traits.cooperation.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.traits.cooperation}
                        onChange={(e) => setFormData({
                          ...formData,
                          traits: { ...formData.traits, cooperation: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Competitive</span>
                        <span>Cooperative</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Analytical: {formData.traits.analytical.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.traits.analytical}
                        onChange={(e) => setFormData({
                          ...formData,
                          traits: { ...formData.traits, analytical: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Intuitive</span>
                        <span>Analytical</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Emotional: {formData.traits.emotional.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.traits.emotional}
                        onChange={(e) => setFormData({
                          ...formData,
                          traits: { ...formData.traits, emotional: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Rational</span>
                        <span>Emotional</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Risk Tolerance: {formData.traits.risk_tolerance.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.traits.risk_tolerance}
                        onChange={(e) => setFormData({
                          ...formData,
                          traits: { ...formData.traits, risk_tolerance: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Risk Averse</span>
                        <span>Risk Seeking</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Creativity: {formData.traits.creativity.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.traits.creativity}
                        onChange={(e) => setFormData({
                          ...formData,
                          traits: { ...formData.traits, creativity: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Traditional</span>
                        <span>Creative</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Detail Oriented: {formData.traits.detail_oriented.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.traits.detail_oriented}
                        onChange={(e) => setFormData({
                          ...formData,
                          traits: { ...formData.traits, detail_oriented: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Big Picture: {formData.traits.big_picture.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.traits.big_picture}
                        onChange={(e) => setFormData({
                          ...formData,
                          traits: { ...formData.traits, big_picture: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decision Criteria Preferences */}
                <div className="border-t pt-4 mt-4">
                  <label className="block text-sm font-medium mb-3">Decision Criteria Preferences</label>
                  <p className="text-xs text-gray-600 mb-3">How important is each factor to this agent?</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Cost: {formData.criteria.cost.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.criteria.cost}
                        onChange={(e) => setFormData({
                          ...formData,
                          criteria: { ...formData.criteria, cost: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Risk: {formData.criteria.risk.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.criteria.risk}
                        onChange={(e) => setFormData({
                          ...formData,
                          criteria: { ...formData.criteria, risk: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Speed: {formData.criteria.speed.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.criteria.speed}
                        onChange={(e) => setFormData({
                          ...formData,
                          criteria: { ...formData.criteria, speed: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Fairness: {formData.criteria.fairness.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.criteria.fairness}
                        onChange={(e) => setFormData({
                          ...formData,
                          criteria: { ...formData.criteria, fairness: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Innovation: {formData.criteria.innovation.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.criteria.innovation}
                        onChange={(e) => setFormData({
                          ...formData,
                          criteria: { ...formData.criteria, innovation: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Consensus: {formData.criteria.consensus.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={formData.criteria.consensus}
                        onChange={(e) => setFormData({
                          ...formData,
                          criteria: { ...formData.criteria, consensus: parseFloat(e.target.value) }
                        })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Goals Section */}
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium">Goals & Perspectives</label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newGoals = [...formData.goals.goals];
                        newGoals.push({ text: '', importance: 50, perspectives: [] });
                        setFormData({ ...formData, goals: { goals: newGoals } });
                      }}
                      className="text-xs"
                    >
                      + Add Goal
                    </Button>
                  </div>

                  {formData.goals.goals.map((goal, goalIndex) => (
                    <div key={goalIndex} className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium mb-1">Goal Text</label>
                          <Input
                            value={goal.text}
                            onChange={(e) => {
                              const newGoals = [...formData.goals.goals];
                              newGoals[goalIndex].text = e.target.value;
                              setFormData({ ...formData, goals: { goals: newGoals } });
                            }}
                            placeholder="Enter goal description"
                            className="text-sm"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs font-medium mb-1">
                            Importance: {goal.importance}
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            value={goal.importance}
                            onChange={(e) => {
                              const newGoals = [...formData.goals.goals];
                              newGoals[goalIndex].importance = parseInt(e.target.value);
                              setFormData({ ...formData, goals: { goals: newGoals } });
                            }}
                            className="w-full"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newGoals = formData.goals.goals.filter((_, i) => i !== goalIndex);
                            setFormData({ ...formData, goals: { goals: newGoals } });
                          }}
                          className="text-red-600 hover:bg-red-50 mt-5"
                        >
                          ✕
                        </Button>
                      </div>

                      {/* Perspectives */}
                      <div className="ml-4 mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-gray-600">
                            Other Perspectives ({goal.perspectives.length}/5)
                          </label>
                          {goal.perspectives.length < 5 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newGoals = [...formData.goals.goals];
                                newGoals[goalIndex].perspectives.push({ agent: '', importance: 50 });
                                setFormData({ ...formData, goals: { goals: newGoals } });
                              }}
                              className="text-xs"
                            >
                              + Add Perspective
                            </Button>
                          )}
                        </div>

                        {goal.perspectives.map((perspective, perspIndex) => (
                          <div key={perspIndex} className="flex items-center gap-2 mb-2">
                            <Input
                              value={perspective.agent}
                              onChange={(e) => {
                                const newGoals = [...formData.goals.goals];
                                newGoals[goalIndex].perspectives[perspIndex].agent = e.target.value;
                                setFormData({ ...formData, goals: { goals: newGoals } });
                              }}
                              placeholder="Agent name"
                              className="text-xs flex-1"
                            />
                            <div className="w-32 flex items-center gap-2">
                              <span className="text-xs text-gray-600">{perspective.importance}</span>
                              <input
                                type="range"
                                min="1"
                                max="100"
                                value={perspective.importance}
                                onChange={(e) => {
                                  const newGoals = [...formData.goals.goals];
                                  newGoals[goalIndex].perspectives[perspIndex].importance = parseInt(e.target.value);
                                  setFormData({ ...formData, goals: { goals: newGoals } });
                                }}
                                className="flex-1"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newGoals = [...formData.goals.goals];
                                newGoals[goalIndex].perspectives = newGoals[goalIndex].perspectives.filter((_, i) => i !== perspIndex);
                                setFormData({ ...formData, goals: { goals: newGoals } });
                              }}
                              className="text-red-600 hover:bg-red-50 text-xs"
                            >
                              ✕
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button type="submit" variant="primary" className="flex-1">
                    {editingId ? 'Update' : 'Create'} Profile
                  </Button>
                  <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading profiles...</p>
          </div>
        ) : profiles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No agent profiles yet
              </h3>
              <p className="text-gray-600 mb-6">
                Create reusable agent profiles to quickly set up meetings
              </p>
              <Button variant="primary" onClick={() => setShowForm(true)}>
                Create First Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          viewMode === 'card' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProfiles.map((profile) => (
              <Card key={profile.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{profile.name}</CardTitle>
                      {profile.role && (
                        <p className="text-sm text-gray-600">{profile.role}</p>
                      )}
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                      profile.default_stance === 'for' ? 'bg-green-100 text-green-800' :
                      profile.default_stance === 'against' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {profile.default_stance}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <p className="flex-1 text-sm text-gray-700 mb-4 line-clamp-3">
                    {profile.persona}
                  </p>
                  <div className="flex gap-2">
                    {profile.is_archived ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => handleRestore(profile.id)}
                          className="flex-1 h-9 text-xs font-medium border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 px-3 flex items-center gap-1"
                        >
                          <Undo2 size={16} /> Restore
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDelete(profile.id)}
                          className="flex-1 h-9 text-xs font-medium border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 px-3 flex items-center gap-1"
                        >
                          <Trash2 size={16} /> Delete
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="default"
                          onClick={() => handleEdit(profile)}
                          className="flex-1 h-9 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 flex items-center gap-1"
                        >
                          <Edit2 size={16} /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleCopy(profile)}
                          title="Copy profile JSON"
                          className="flex-1 h-9 text-xs font-medium border-gray-300 text-gray-700 hover:bg-gray-50 px-3 flex items-center gap-1"
                        >
                          <Copy size={16} /> Copy
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleShare(profile)}
                          title="Share profile"
                          className="flex-1 h-9 text-xs font-medium border-gray-300 text-gray-700 hover:bg-gray-50 px-3 flex items-center gap-1"
                        >
                          <Share2 size={16} /> Share
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDelete(profile.id)}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Persona</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dominance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProfiles.map((profile) => (
                    <tr key={profile.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{profile.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {profile.role || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          profile.default_stance === 'for' ? 'bg-green-100 text-green-800' :
                          profile.default_stance === 'against' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {profile.default_stance}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-md">
                        <div className="line-clamp-2">{profile.persona}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {profile.default_dominance}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex gap-2 justify-end">
                          {profile.is_archived ? (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => handleRestore(profile.id)}
                                className="h-8 text-xs px-3 font-medium border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 flex items-center gap-1"
                              >
                                <Undo2 size={16} />
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleDelete(profile.id)}
                                className="h-8 text-xs px-3 font-medium border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 flex items-center gap-1"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="default"
                                onClick={() => handleEdit(profile)}
                                className="h-8 text-xs px-3 font-medium bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                              >
                                <Edit2 size={16} />
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleCopy(profile)}
                                title="Copy profile JSON"
                                className="h-8 text-xs px-3 font-medium border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                              >
                                <Copy size={16} />
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleShare(profile)}
                                title="Share profile"
                                className="h-8 text-xs px-3 font-medium border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                              >
                                <Share2 size={16} />
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => handleDelete(profile.id)}
                                className="h-8 text-xs px-3 font-medium border-orange-300 text-orange-700 hover:bg-orange-50 hover:border-orange-400 flex items-center gap-1"
                              >
                                <Archive size={16} />
                              </Button>
                                  // If you have a view button, add it like this:
                                  // <Button variant="outline" onClick={() => handleView(profile)} className="... flex items-center gap-1"><Eye size={16} /> View</Button>
                                  {/* Copy success toast */}
                                  {copySuccess && (
                                    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded shadow-lg animate-fade-in">
                                      {copySuccess}
                                    </div>
                                  )}

                                  {/* Share Modal */}
                                  {showShareModal && shareProfile && (
                                    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                                      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                                          <h2 className="text-lg font-semibold text-gray-900">Share Agent Profile</h2>
                                          <button onClick={closeShareModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
                                        </div>
                                        <div className="px-6 py-6">
                                          <p className="text-sm text-gray-700 mb-2">Share this agent profile with others by copying the JSON below or sending it by email.</p>
                                          <Textarea
                                            value={JSON.stringify(shareProfile, null, 2)}
                                            readOnly
                                            rows={10}
                                            className="w-full font-mono text-xs mb-3"
                                          />
                                          <div className="flex gap-2">
                                            <Button
                                              variant="primary"
                                              onClick={async () => {
                                                await navigator.clipboard.writeText(JSON.stringify(shareProfile, null, 2));
                                                setCopySuccess('Copied profile JSON!');
                                                setTimeout(() => setCopySuccess(null), 2000);
                                              }}
                                              className="flex-1"
                                            >
                                              <Copy size={16} className="mr-1" /> Copy JSON
                                            </Button>
                                            <Button
                                              variant="outline"
                                              onClick={() => {
                                                window.open(`mailto:?subject=Agent Profile: ${encodeURIComponent(shareProfile.name)}&body=${encodeURIComponent(JSON.stringify(shareProfile, null, 2))}`);
                                              }}
                                              className="flex-1"
                                            >
                                              <Share2 size={16} className="mr-1" /> Email
                                            </Button>
                                          </div>
                                        </div>
                                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                                          <Button onClick={closeShareModal} className="w-full">Close</Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
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
