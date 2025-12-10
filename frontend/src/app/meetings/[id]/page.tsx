'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { MeetingDetail as MeetingDetailType, SSEEvent, AgentConfig } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MeetingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const meetingId = params?.id;

  const [meeting, setMeeting] = useState<MeetingDetailType | null>(null);
  const [dialogue, setDialogue] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState('');
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [pendingLines, setPendingLines] = useState<string[]>([]);
  const [isEditingAgents, setIsEditingAgents] = useState(false);
  const [editedAgents, setEditedAgents] = useState<AgentConfig[]>([]);
  const [showAgenda, setShowAgenda] = useState(false);

  // Stage colors matching Meeting Process page
  const getStageColor = (stage: string): string => {
    const stageColors: { [key: string]: string } = {
      'introduce': 'bg-purple-50 border-l-4 border-purple-200',
      'clarify': 'bg-blue-50 border-l-4 border-blue-200',
      'discuss': 'bg-green-50 border-l-4 border-green-200',
      'options': 'bg-yellow-50 border-l-4 border-yellow-200',
      'evaluate': 'bg-orange-50 border-l-4 border-orange-200',
      'decide': 'bg-red-50 border-l-4 border-red-200',
      'confirm': 'bg-gray-50 border-l-4 border-gray-200'
    };
    return stageColors[stage] || 'bg-white';
  };

  // Extract stage from dialogue line (format: "[stage] speaker: message")
  const extractStage = (line: string): string => {
    const match = line.match(/^\[(\w+)\]/);
    return match ? match[1].toLowerCase() : '';
  };

  useEffect(() => {
    if (meetingId) {
      fetchMeeting();
    }
  }, [meetingId]);

  const fetchMeeting = async () => {
    try {
      const response = await api.get(`/api/v1/meetings/${meetingId}`);
      setMeeting(response.data);
      if (response.data.dialogue) {
        setDialogue(response.data.dialogue);
      }
    } catch (error) {
      console.error('Failed to fetch meeting:', error);
      setError('Failed to load meeting');
    }
  };

  const startSimulation = async () => {
    setIsStreaming(true);
    setIsPaused(false);
    setDialogue([]);
    setPendingLines([]);
    setError('');

    // Get token from localStorage
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('Not authenticated. Please log in again.');
      setIsStreaming(false);
      router.push('/login');
      return;
    }

    const es = new EventSource(
      `http://localhost:8000/api/v1/meetings/${meetingId}/stream?token=${encodeURIComponent(token)}`
    );
    setEventSource(es);

    es.onmessage = (event) => {
      try {
        console.log('Received SSE event:', event.data);
        const data: SSEEvent = JSON.parse(event.data);
        console.log('Parsed SSE data:', data);

        if (data.type === 'line') {
          setPendingLines((prev) => [...prev, data.line]);
        } else if (data.type === 'final') {
          setMeeting((prev) => prev ? {
            ...prev,
            decision: data.decision,
            summary: data.summary,
            options_summary: data.options_summary,
            metrics: data.metrics,
            status: 'completed',
          } : null);
          es.close();
          setEventSource(null);
          setIsStreaming(false);
        } else if (data.type === 'error') {
          setError(data.message);
          es.close();
          setEventSource(null);
          setIsStreaming(false);
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err, 'Raw data:', event.data);
      }
    };

    es.onerror = () => {
      setError('Connection lost. Please try again.');
      es.close();
      setEventSource(null);
      setIsStreaming(false);
    };
  };

  const pauseSimulation = () => {
    setIsPaused(true);
  };

  const resumeSimulation = () => {
    setIsPaused(false);
  };

  const stopSimulation = async () => {
    try {
      // Call backend stop endpoint
      await api.post(`/api/v1/meetings/${meetingId}/stop`);
      
      // Close EventSource
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      setIsStreaming(false);
      setIsPaused(false);
      setPendingLines([]);
      
      // Reload meeting data
      await fetchMeeting();
    } catch (err: any) {
      console.error('Failed to stop simulation:', err);
      setError(err.response?.data?.detail || 'Failed to stop simulation');
    }
  };

  const handleEditAgents = () => {
    if (meeting) {
      setEditedAgents([...meeting.agents]);
      setIsEditingAgents(true);
    }
  };

  const updateAgent = (index: number, field: keyof AgentConfig, value: any) => {
    const newAgents = [...editedAgents];
    if (field === 'traits') {
      newAgents[index] = { ...newAgents[index], traits: value };
    } else {
      newAgents[index] = { ...newAgents[index], [field]: value };
    }
    setEditedAgents(newAgents);
  };

  const saveAgents = async () => {
    try {
      await api.put(`/api/v1/meetings/${meetingId}`, {
        agents: editedAgents,
      });
      setIsEditingAgents(false);
      await fetchMeeting();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update agents');
    }
  };

  // Effect to display pending lines when not paused
  useEffect(() => {
    if (!isPaused && pendingLines.length > 0) {
      const timer = setTimeout(() => {
        setDialogue((prev) => [...prev, pendingLines[0]]);
        setPendingLines((prev) => prev.slice(1));
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isPaused, pendingLines]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        console.log('Cleaning up EventSource on unmount');
        eventSource.close();
        setEventSource(null);
      }
    };
  }, [eventSource]);

  // Handle navigation away from page
  const handleBackToDashboard = () => {
    if (eventSource) {
      console.log('Closing EventSource before navigation');
      eventSource.close();
      setEventSource(null);
    }
    setIsStreaming(false);
    router.push('/dashboard');
  };

  if (!meeting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
          <p className="text-sm text-gray-600 mt-1">{meeting.issue}</p>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Meeting Info */}
          <div className="lg:col-span-1 space-y-6 order-2 lg:order-1">
            <Card>
              <CardHeader>
                <CardTitle>Meeting Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Issue</h4>
                  <p className="text-sm text-gray-600">{meeting.issue}</p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Status</h4>
                  <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                    meeting.status === 'completed' ? 'bg-green-100 text-green-800' :
                    meeting.status === 'running' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {meeting.status}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">Participants</h4>
                    {!isStreaming && meeting.status !== 'running' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditAgents}
                      >
                        ✏️ Edit
                      </Button>
                    )}
                  </div>
                  {!isEditingAgents ? (
                    <ul className="space-y-1">
                      {meeting.agents.map((agent, index) => (
                        <li key={index} className="text-sm text-gray-600">
                          • {agent.name} ({agent.stance})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="space-y-3 border rounded-lg p-3 bg-gray-50">
                      {editedAgents.map((agent, index) => (
                        <div key={index} className="space-y-2 border-b pb-2 last:border-b-0">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-medium">Name</label>
                              <Input
                                value={agent.name}
                                onChange={(e) => updateAgent(index, 'name', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium">Stance</label>
                              <select
                                value={agent.stance}
                                onChange={(e) => updateAgent(index, 'stance', e.target.value)}
                                className="h-8 w-full rounded-md border border-gray-300 text-sm px-2"
                              >
                                <option value="for">For</option>
                                <option value="neutral">Neutral</option>
                                <option value="against">Against</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium">Persona</label>
                            <Textarea
                              value={agent.persona}
                              onChange={(e) => updateAgent(index, 'persona', e.target.value)}
                              className="text-sm"
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={saveAgents}
                          className="flex-1"
                        >
                          Save Changes
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsEditingAgents(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setShowAgenda(!showAgenda)}
                >
                  📋 {showAgenda ? 'Hide' : 'Show'} Agenda
                </Button>

                {(meeting.status === 'pending' || meeting.status === 'running') && !isStreaming && (
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={startSimulation}
                  >
                    {meeting.status === 'running' ? 'Resume Simulation' : 'Start Simulation'}
                  </Button>
                )}

                {isStreaming && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {!isPaused ? (
                        <Button
                          variant="secondary"
                          className="flex-1"
                          onClick={pauseSimulation}
                        >
                          ⏸ Pause
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          className="flex-1"
                          onClick={resumeSimulation}
                        >
                          ▶ Resume
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        className="flex-1"
                        onClick={stopSimulation}
                      >
                        ⏹ Stop
                      </Button>
                    </div>
                    <p className="text-xs text-center text-gray-500">
                      {isPaused ? 'Paused' : 'Streaming...'}
                    </p>
                  </div>
                )}

                {(meeting.status === 'completed' || meeting.status === 'cancelled') && !isStreaming && (
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={startSimulation}
                  >
                    🔄 Rerun Simulation
                  </Button>
                )}

                {meeting.decision && (
                  <div className="mt-4 rounded-lg bg-green-50 p-4">
                    <h4 className="font-medium text-green-900 mb-2">Decision</h4>
                    <p className="text-sm text-green-800">{meeting.decision}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Dialogue */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            {showAgenda && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Meeting Agenda</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Meeting Details</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Title:</span> {meeting.title}
                      </div>
                      <div>
                        <span className="font-medium">Issue:</span> {meeting.issue}
                      </div>
                      {meeting.context && (
                        <div>
                          <span className="font-medium">Context:</span>
                          <p className="mt-1 whitespace-pre-wrap text-gray-600">{meeting.context}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {meeting.conditions && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Meeting Conditions</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-medium">Time Pressure:</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${(meeting.conditions.time_pressure || 0.5) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {((meeting.conditions.time_pressure || 0.5) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Formality:</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${(meeting.conditions.formality || 0.5) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {((meeting.conditions.formality || 0.5) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Conflict Tolerance:</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${(meeting.conditions.conflict_tolerance || 0.5) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {((meeting.conditions.conflict_tolerance || 0.5) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Decision Threshold:</span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${(meeting.conditions.decision_threshold || 0.7) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              {((meeting.conditions.decision_threshold || 0.7) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Max Turns:</span> {meeting.conditions.max_turns || 50}
                        </div>
                        <div>
                          <span className="font-medium">Creativity Mode:</span> {meeting.conditions.creativity_mode ? '✓ Enabled' : '✗ Disabled'}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Participants</h4>
                    <div className="space-y-2">
                      {meeting.agents.map((agent, index) => (
                        <div key={index} className="text-sm border-l-4 border-blue-500 pl-3 py-1">
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-gray-600">Stance: {agent.stance}</div>
                          <div className="text-gray-600">Persona: {agent.persona}</div>
                          <div className="text-gray-600 text-xs">
                            Dominance: {agent.dominance} | 
                            Interrupt: {agent.traits?.interrupt?.toFixed(2)} | 
                            Conflict Avoid: {agent.traits?.conflict_avoid?.toFixed(2)} | 
                            Persuasion: {agent.traits?.persuasion?.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Meeting Dialogue</CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
                    {error}
                  </div>
                )}

                <div className="space-y-2 max-h-[600px] overflow-y-auto bg-gray-50 p-4 rounded-lg">
                  {dialogue.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      {meeting.status === 'pending'
                        ? 'Click "Start Simulation" to begin'
                        : 'No dialogue available'}
                    </p>
                  ) : (
                    dialogue.map((line, index) => {
                      const stage = extractStage(line);
                      const colorClass = getStageColor(stage);
                      return (
                        <div 
                          key={index} 
                          className={`text-sm text-gray-700 py-2 px-3 rounded ${colorClass}`}
                        >
                          {line}
                        </div>
                      );
                    })
                  )}
                  {isStreaming && (
                    <div className="text-center py-2">
                      <span className="inline-block animate-pulse text-gray-500">
                        ●●●
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
