'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AgentConfig } from '@/types/api';

interface AgentProfile {
  id: number;
  name: string;
  role: string;
  persona: string;
  stance: 'for' | 'neutral' | 'against';
  dominance: number;
  traits: {
    interrupt: number;
    conflict_avoid: number;
    persuasion: number;
  };
}

export default function NewMeetingPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [issue, setIssue] = useState('');
  const [context, setContext] = useState('');
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [conditions, setConditions] = useState({
    time_pressure: 0.5,
    formality: 0.5,
    conflict_tolerance: 0.5,
    decision_threshold: 0.7,
    max_turns: 50,
    creativity_mode: false
  });
  const [agents, setAgents] = useState<AgentConfig[]>([
    {
      name: 'Alice',
      stance: 'neutral',
      dominance: 1.2,
      persona: 'CEO and chairperson, focused on strategic growth',
      traits: { interrupt: 0.1, conflict_avoid: 0.3, persuasion: 0.8 },
      context: ''
    },
    {
      name: 'Bob',
      stance: 'neutral',
      dominance: 1.0,
      persona: 'CFO, analytical and data-driven',
      traits: { interrupt: 0.2, conflict_avoid: 0.5, persuasion: 0.7 },
      context: ''
    },
    {
      name: 'Carol',
      stance: 'neutral',
      dominance: 1.0,
      persona: 'CTO, innovative and tech-focused',
      traits: { interrupt: 0.3, conflict_avoid: 0.4, persuasion: 0.6 },
      context: ''
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const response = await api.get('/api/v1/agent-library');
        setProfiles(response.data);
      } catch (err) {
        console.error('Failed to load profiles:', err);
      }
    };
    fetchProfiles();

    // Check for copied meeting data
    const copyDataStr = localStorage.getItem('copyMeetingData');
    if (copyDataStr) {
      try {
        const copyData = JSON.parse(copyDataStr);
        setTitle(copyData.title || '');
        setIssue(copyData.issue || '');
        setContext(copyData.context || '');
        if (copyData.agents && copyData.agents.length > 0) {
          setAgents(copyData.agents);
        }
        if (copyData.conditions) {
          setConditions(copyData.conditions);
        }
        // Clear the localStorage after loading
        localStorage.removeItem('copyMeetingData');
      } catch (err) {
        console.error('Failed to load copied meeting data:', err);
      }
    }
  }, []);

  const loadProfile = (profile: AgentProfile, index: number) => {
    const newAgents = [...agents];
    newAgents[index] = {
      name: profile.name,
      stance: profile.stance,
      dominance: profile.dominance,
      persona: profile.persona,
      traits: profile.traits,
      context: agents[index].context || ''
    };
    setAgents(newAgents);
  };

  const updateAgent = (index: number, field: keyof AgentConfig, value: any) => {
    const newAgents = [...agents];
    if (field === 'traits') {
      newAgents[index] = { ...newAgents[index], traits: value };
    } else {
      newAgents[index] = { ...newAgents[index], [field]: value };
    }
    setAgents(newAgents);
  };

  const addAgent = () => {
    setAgents([
      ...agents,
      {
        name: `Person${agents.length + 1}`,
        stance: 'neutral',
        dominance: 1.0,
        persona: 'Board member with unique perspective',
        traits: { interrupt: 0.2, conflict_avoid: 0.5, persuasion: 0.5 },
        context: ''
      }
    ]);
  };

  const removeAgent = (index: number) => {
    if (agents.length > 2) {
      setAgents(agents.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/v1/meetings', {
        title,
        issue,
        context: context || undefined,
        agents,
        conditions
      });
      router.push(`/meetings/${response.data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create meeting');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">New Meeting</h1>
          <p className="text-sm text-gray-600 mt-1">Configure your meeting simulation</p>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-4 sm:py-8 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Meeting Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meeting Title
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q4 Strategy Discussion"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue to Discuss
                </label>
                <Textarea
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="e.g., Should we expand into European markets?"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meeting Context (Optional)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Add background information or data relevant to the entire meeting
                </p>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., Previous quarter showed 15% decline in UK sales. Market research indicates strong demand in Germany and France...\n\nOr paste/upload content here."
                  rows={5}
                />
                <div className="mt-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
                    <span>📎 Upload File</span>
                    <input
                      type="file"
                      accept=".txt,.md,.doc,.docx,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const text = evt.target?.result as string;
                            setContext(prev => prev ? prev + '\n\n' + text : text);
                          };
                          if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
                            reader.readAsText(file);
                          } else {
                            alert('Please use .txt or .md files for now. PDF and Word support coming soon.');
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                  <span className="ml-2 text-xs text-gray-500">
                    Supports .txt and .md files
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <details open>
            <summary className="cursor-pointer list-none">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <span className="mr-2">▼</span>
                    Meeting Conditions
                  </CardTitle>
                </CardHeader>
              </Card>
            </summary>
            <Card className="mt-2">
              <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Time Pressure: {conditions.time_pressure.toFixed(1)}
                  </label>
                  <p className="text-xs text-gray-500 mb-1">Urgency level (0=relaxed, 1=critical)</p>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={conditions.time_pressure}
                    onChange={(e) => setConditions({...conditions, time_pressure: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Formality: {conditions.formality.toFixed(1)}
                  </label>
                  <p className="text-xs text-gray-500 mb-1">Meeting tone (0=casual, 1=formal)</p>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={conditions.formality}
                    onChange={(e) => setConditions({...conditions, formality: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Conflict Tolerance: {conditions.conflict_tolerance.toFixed(1)}
                  </label>
                  <p className="text-xs text-gray-500 mb-1">Debate intensity (0=harmony, 1=debate)</p>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={conditions.conflict_tolerance}
                    onChange={(e) => setConditions({...conditions, conflict_tolerance: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Decision Threshold: {conditions.decision_threshold.toFixed(1)}
                  </label>
                  <p className="text-xs text-gray-500 mb-1">Consensus needed (0.5=majority, 1.0=unanimous)</p>
                  <input
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.05"
                    value={conditions.decision_threshold}
                    onChange={(e) => setConditions({...conditions, decision_threshold: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Max Turns: {conditions.max_turns}
                </label>
                <p className="text-xs text-gray-500 mb-1">Maximum discussion rounds</p>
                <input
                  type="range"
                  min="10"
                  max="200"
                  step="10"
                  value={conditions.max_turns}
                  onChange={(e) => setConditions({...conditions, max_turns: parseInt(e.target.value)})}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="creativity"
                  checked={conditions.creativity_mode}
                  onChange={(e) => setConditions({...conditions, creativity_mode: e.target.checked})}
                  className="rounded border-gray-300"
                />
                <label htmlFor="creativity" className="text-sm font-medium text-gray-700">
                  Enable Creativity Mode
                  <span className="block text-xs text-gray-500 font-normal">
                    Encourage brainstorming and innovative thinking
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>
          </details>

          <details open>
            <summary className="cursor-pointer list-none">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <span className="mr-2">▼</span>
                      Participants ({agents.length})
                    </CardTitle>
                    <Button type="button" variant="secondary" onClick={addAgent}>
                      + Add Person
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            </summary>
            <Card className="mt-2">
              <CardContent className="pt-6 space-y-4">
              {agents.map((agent, index) => (
                <details key={index} open className="border rounded-lg">
                  <summary className="cursor-pointer p-4 hover:bg-gray-50 list-none">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">▼</span>
                        <h3 className="font-medium">Person {index + 1}: {agent.name}</h3>
                      </div>
                      {agents.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAgent(index);
                          }}
                        >
                          ✕ Remove
                        </Button>
                      )}
                    </div>
                  </summary>
                  
                  <div className="p-4 pt-0 space-y-3">

                  {profiles.length > 0 && (
                    <div>
                      <label className="text-xs font-medium">Load from Library</label>
                      <select
                        onChange={(e) => {
                          const profileId = parseInt(e.target.value);
                          const profile = profiles.find(p => p.id === profileId);
                          if (profile) loadProfile(profile, index);
                          e.target.value = '';
                        }}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        defaultValue=""
                      >
                        <option value="">Select a person...</option>
                        {profiles.map(profile => (
                          <option key={profile.id} value={profile.id}>
                            {profile.name} - {profile.role}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium">Stance</label>
                    <select
                      value={agent.stance}
                      onChange={(e) => updateAgent(index, 'stance', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    >
                      <option value="for">For</option>
                      <option value="neutral">Neutral</option>
                      <option value="against">Against</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium">Context (Optional)</label>
                    <p className="text-xs text-gray-500 mb-1">
                      Add background info specific to this person
                    </p>
                    <Textarea
                      value={agent.context || ''}
                      onChange={(e) => updateAgent(index, 'context', e.target.value)}
                      placeholder="e.g., Has 10 years experience in European markets...\n\nOr paste/upload content here."
                      rows={4}
                    />
                    <div className="mt-2">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-2 py-1.5 border border-gray-300 rounded-md text-xs hover:bg-gray-50">
                        <span>📎 Upload File</span>
                        <input
                          type="file"
                          accept=".txt,.md,.doc,.docx,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                const text = evt.target?.result as string;
                                const currentContext = agent.context || '';
                                updateAgent(index, 'context', currentContext ? currentContext + '\n\n' + text : text);
                              };
                              if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
                                reader.readAsText(file);
                              } else {
                                alert('Please use .txt or .md files for now. PDF and Word support coming soon.');
                              }
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      <span className="ml-2 text-xs text-gray-500">
                        .txt or .md files
                      </span>
                    </div>
                  </div>
                  </div>
                </details>
              ))}
            </CardContent>
          </Card>
          </details>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/dashboard')}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Creating...' : 'Create Meeting'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
