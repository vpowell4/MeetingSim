// API types
export interface User {
  id: number;
  email: string;
  full_name?: string;
  role: 'super' | 'admin' | 'manager' | 'user';
  organization_id?: number;
  department_id?: number;
  title?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AgentConfig {
  name: string;
  stance: 'for' | 'against' | 'neutral';
  dominance: number;
  persona: string;
  traits: {
    interrupt: number;
    conflict_avoid: number;
    persuasion: number;
  };
  context?: string;
}

export interface Meeting {
  id: number;
  user_id: number;
  title: string;
  issue: string;
  context?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  decision?: string;
  summary?: string;
  run_count?: number;
  created_at: string;
  completed_at?: string;
  is_shared?: boolean;
  is_owner?: boolean;
  shared_by?: string;
  is_archived?: boolean;
}

export interface MeetingShare {
  id: number;
  meeting_id: number;
  shared_with_user_id: number;
  shared_with_email?: string;
  shared_with_name?: string;
  is_archived: boolean;
  shared_at: string;
}

export interface MeetingConditions {
  time_pressure: number;
  formality: number;
  conflict_tolerance: number;
  decision_threshold: number;
  max_turns: number;
  creativity_mode: boolean;
}

export interface MeetingDetail extends Meeting {
  dialogue: string[];
  options_summary?: string;
  metrics?: Record<string, any>;
  agents: AgentConfig[];
  conditions?: MeetingConditions;
}

export interface MeetingCreate {
  title: string;
  issue: string;
  agents: AgentConfig[];
}

export interface DialogueLine {
  type: 'line';
  line: string;
}

export interface MeetingFinal {
  type: 'final';
  decision?: string;
  summary: string;
  options_summary: string;
  metrics: Record<string, any>;
}

export type SSEEvent = DialogueLine | MeetingFinal | { type: 'error'; message: string };
