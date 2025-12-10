'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface MinutesDetail {
  id: number;
  meeting_id: number;
  title: string;
  issue: string;
  decision: string | null;
  summary: string | null;
  full_transcript: string[];
  participants: string[];
  key_points: string[] | null;
  action_items: string[] | null;
  options_discussed: string | null;
  metrics: any;
  meeting_date: string;
  created_at: string;
}

export default function MinutesDetailPage() {
  const router = useRouter();
  const params = useParams();
  const minutesId = params.id as string;
  
  const [minutes, setMinutes] = useState<MinutesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [metricsExpanded, setMetricsExpanded] = useState(false);

  useEffect(() => {
    fetchMinutes();
  }, [minutesId]);

  const fetchMinutes = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/v1/minutes/${minutesId}`);
      setMinutes(response.data);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load minutes');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportAsText = () => {
    if (!minutes) return;

    let metricsText = '';
    if (minutes.metrics) {
      metricsText = '\n\nMETRICS\n-------\n';
      
      if (minutes.metrics.turns_per_stage) {
        metricsText += '\nTurns per Stage:\n';
        Object.entries(minutes.metrics.turns_per_stage).forEach(([stage, turns]) => {
          metricsText += `  ${stage}: ${turns}\n`;
        });
      }
      
      if (minutes.metrics.turns_by_agent) {
        metricsText += '\nParticipation by Person:\n';
        Object.entries(minutes.metrics.turns_by_agent).forEach(([agent, turns]) => {
          metricsText += `  ${agent}: ${turns} turns\n`;
        });
      }
      
      if (minutes.metrics.options_proposed !== undefined) {
        metricsText += `\nOptions Proposed: ${minutes.metrics.options_proposed}`;
      }
      if (minutes.metrics.votes_cast !== undefined) {
        metricsText += `\nVotes Cast: ${minutes.metrics.votes_cast}`;
      }
      if (minutes.metrics.actions_raised !== undefined) {
        metricsText += `\nActions Raised: ${minutes.metrics.actions_raised}`;
      }
      if (minutes.metrics.interruptions !== undefined) {
        metricsText += `\nInterruptions: ${minutes.metrics.interruptions}`;
      }
    }

    const text = `
MEETING MINUTES
===============

Title: ${minutes.title}
Date: ${formatDate(minutes.meeting_date)}
Participants: ${minutes.participants.join(', ')}

ISSUE
-----
${minutes.issue}

DECISION
--------
${minutes.decision || 'No decision recorded'}

SUMMARY
-------
${minutes.summary || 'No summary available'}

${minutes.options_discussed ? `OPTIONS DISCUSSED\n-----------------\n${minutes.options_discussed}\n` : ''}

FULL TRANSCRIPT
---------------
${minutes.full_transcript?.join('\n\n') || 'No transcript available'}
${metricsText}
`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minutes-${minutes.title.replace(/[^a-z0-9]/gi, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading minutes...</p>
      </div>
    );
  }

  if (error || !minutes) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error || 'Minutes not found'}
          </div>
          <Button onClick={() => router.push('/minutes')} className="mt-4">
            Back to Minutes Library
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{minutes.title}</h1>
              <p className="text-sm text-gray-600 mt-1">
                {formatDate(minutes.meeting_date)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportAsText} variant="secondary">
                📥 Export
              </Button>
              <Button onClick={() => router.push('/minutes')} variant="secondary">
                ← Back
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Meeting Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-1">Participants</h3>
              <p className="text-gray-700">{minutes.participants.join(', ')}</p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-1">Issue</h3>
              <p className="text-gray-700">{minutes.issue}</p>
            </div>
          </CardContent>
        </Card>

        {minutes.decision && (
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{minutes.decision}</p>
            </CardContent>
          </Card>
        )}

        {minutes.summary && (
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-gray-700 whitespace-pre-wrap">
                {minutes.summary.split('\n').map((line, index) => {
                  const trimmed = line.trim();
                  if (!trimmed) return <br key={index} />;
                  
                  // Number each minute point
                  if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                    return (
                      <div key={index} className="mb-2">
                        {index + 1}. {trimmed.substring(1).trim()}
                      </div>
                    );
                  }
                  return <div key={index} className="mb-2">{trimmed}</div>;
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {minutes.options_discussed && (
          <Card>
            <CardHeader>
              <CardTitle>Options Discussed</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                {minutes.options_discussed.split('\n').map((option, index) => {
                  const trimmed = option.trim();
                  if (!trimmed) return null;
                  
                  // Remove existing bullet/dash if present
                  const cleanOption = trimmed.replace(/^[-•*]\s*/, '');
                  return <li key={index}>{cleanOption}</li>;
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        {minutes.action_items && minutes.action_items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Action Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                {minutes.action_items.map((action, index) => (
                  <li key={index}>{action}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        {minutes.full_transcript && minutes.full_transcript.length > 0 && (
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setTranscriptExpanded(!transcriptExpanded)}>
              <div className="flex items-center justify-between">
                <CardTitle>Full Transcript</CardTitle>
                <span className="text-2xl">{transcriptExpanded ? '▼' : '▶'}</span>
              </div>
            </CardHeader>
            {transcriptExpanded && (
              <CardContent>
                <div className="space-y-2">
                  {minutes.full_transcript.map((line, index) => (
                    <p key={index} className="text-sm text-gray-700">
                      {line}
                    </p>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {minutes.metrics && (
          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setMetricsExpanded(!metricsExpanded)}>
              <div className="flex items-center justify-between">
                <CardTitle>Meeting Metrics</CardTitle>
                <span className="text-2xl">{metricsExpanded ? '▼' : '▶'}</span>
              </div>
            </CardHeader>
            {metricsExpanded && (
              <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Turns per Stage */}
                {minutes.metrics.turns_per_stage && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 text-sm">Turns per Stage</h4>
                    {Object.entries(minutes.metrics.turns_per_stage).map(([stage, turns]) => (
                      <div key={stage} className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="capitalize text-gray-700">{stage}</span>
                          <span className="font-medium text-gray-900">{turns as number}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, ((turns as number) / 15) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Turns by Agent */}
                {minutes.metrics.turns_by_agent && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 text-sm">Participation by Person</h4>
                    {Object.entries(minutes.metrics.turns_by_agent).map(([agent, turns]) => (
                      <div key={agent} className="space-y-1">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-700">{agent}</span>
                          <span className="font-medium text-gray-900">{turns as number}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, ((turns as number) / 20) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Summary Stats */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 text-sm">Summary Statistics</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {minutes.metrics.options_proposed !== undefined && (
                      <div className="bg-purple-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-purple-700">
                          {minutes.metrics.options_proposed}
                        </div>
                        <div className="text-xs text-purple-600 mt-1">Options Proposed</div>
                      </div>
                    )}
                    {minutes.metrics.votes_cast !== undefined && (
                      <div className="bg-indigo-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-indigo-700">
                          {minutes.metrics.votes_cast}
                        </div>
                        <div className="text-xs text-indigo-600 mt-1">Votes Cast</div>
                      </div>
                    )}
                    {minutes.metrics.actions_raised !== undefined && (
                      <div className="bg-orange-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-orange-700">
                          {minutes.metrics.actions_raised}
                        </div>
                        <div className="text-xs text-orange-600 mt-1">Actions Raised</div>
                      </div>
                    )}
                    {minutes.metrics.interruptions !== undefined && (
                      <div className="bg-red-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-700">
                          {minutes.metrics.interruptions}
                        </div>
                        <div className="text-xs text-red-600 mt-1">Interruptions</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </CardContent>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
