"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoButton } from "@/components/ui/info-button";

export default function MeetingProcessPage() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([
    "overview"
  ]));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const isExpanded = (section: string) => expandedSections.has(section);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Meeting Process & Architecture
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Understanding how AI-powered meetings work: stages, roles, interactions, and governance
          </p>
        </div>

        {/* Overview */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('overview')}
          >
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{isExpanded('overview') ? '▼' : '▶'}</span>
              <span className="text-2xl">🎯</span> System Overview
            </CardTitle>
          </CardHeader>
          {isExpanded('overview') && (
          <CardContent className="space-y-4">
            <p className="text-gray-700 leading-relaxed">
              The Meeting Simulator uses AI agents powered by <strong>OpenAI GPT-4o-mini</strong> and orchestrated 
              through <strong>LangChain</strong> and <strong>LangGraph</strong> to simulate realistic board meetings. 
              Each meeting progresses through structured stages with intelligent agents that have unique personas, 
              goals, and behavioral traits.
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-sm text-blue-900">
                <strong>Key Innovation:</strong> Meetings are not scripted - agents make real-time decisions 
                based on context, personality, relationships, and meeting conditions. Each simulation is unique.
              </p>
            </div>
          </CardContent>
          )}
        </Card>

        {/* Meeting Stages */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('stages')}
          >
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{isExpanded('stages') ? '▼' : '▶'}</span>
              <span className="text-2xl">📊</span> Seven Meeting Stages
            </CardTitle>
          </CardHeader>
          {isExpanded('stages') && (
          <CardContent>
            <div className="space-y-6">
              {[
                {
                  stage: "1. Introduce",
                  goal: "Raise initial opinions and concerns about the issue",
                  brief: "Be concise (≤2 sentences). Raise 1–2 distinct concerns or hopes.",
                  speechActs: ["concern", "hope"],
                  description: "Participants share their first reactions and establish initial positions. The Chair (Alice) introduces the issue and invites each person to express their thoughts.",
                  color: "bg-purple-50 border-purple-200"
                },
                {
                  stage: "2. Clarify",
                  goal: "Clarify misunderstandings or ambiguous points",
                  brief: "Ask 1 pointed question or resolve a single ambiguity. Avoid restating prior questions.",
                  speechActs: ["question"],
                  description: "Participants ask clarifying questions to ensure everyone understands the issue and each other's positions. Duplicate questions are avoided.",
                  color: "bg-blue-50 border-blue-200"
                },
                {
                  stage: "3. Discuss",
                  goal: "Debate the pros and cons openly",
                  brief: "Offer 1 pro and 1 con. If responding to a prior point, briefly STEELMAN it first.",
                  speechActs: ["argument", "counterargument", "steelman"],
                  description: "Deep debate phase where people present arguments and counterarguments. Steelmanning (strengthening opposing views before countering) encourages good-faith discussion.",
                  color: "bg-green-50 border-green-200"
                },
                {
                  stage: "4. Options",
                  goal: "Generate possible options for action",
                  brief: "Propose 1 concrete option with a short label; include 1 specific implementation detail.",
                  speechActs: ["propose_option"],
                  description: "Participants propose concrete solutions with implementation details. Each option is registered with a unique ID (O1, O2, etc.) and evaluated on criteria like cost, risk, speed, fairness, innovation, and consensus.",
                  color: "bg-yellow-50 border-yellow-200"
                },
                {
                  stage: "5. Evaluate",
                  goal: "Evaluate the strengths and weaknesses of the options",
                  brief: "Compare 2 options with 2 criteria (cost, risk, speed, fairness). If group is one-sided, play devil's advocate once.",
                  speechActs: ["compare", "weigh", "devils_advocate"],
                  description: "Options are analyzed using multiple criteria. Agents automatically vote based on their goals and affinity with proposers. Devil's advocate role prevents groupthink.",
                  color: "bg-orange-50 border-orange-200"
                },
                {
                  stage: "6. Decide",
                  goal: "Make a decision, aiming for consensus or majority",
                  brief: "State a preference and 1 justification; if undecided, ask for 1 missing fact.",
                  speechActs: ["recommend", "commit", "ask_missing_fact"],
                  description: "Final voting and decision-making. The Chair selects the option with highest net support (supporters - opponents). If no clear option exists, falls back to majority stance.",
                  color: "bg-red-50 border-red-200"
                },
                {
                  stage: "7. Confirm",
                  goal: "Confirm the decision and wrap up the discussion",
                  brief: "Restate the decision and 1 action item; check for final objections (yes/no).",
                  speechActs: ["summarize", "check-consent"],
                  description: "The Chair formally announces the decision, summarizes action items, and checks for final objections. Meeting minutes are automatically generated.",
                  color: "bg-gray-50 border-gray-200"
                }
              ].map((item, idx) => (
                <div key={idx} className={`border-2 rounded-lg p-4 ${item.color}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{item.stage}</h3>
                    <InfoButton content={`Speech acts: ${item.speechActs.join(", ")}`} />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    🎯 Goal: {item.goal}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Micro-brief:</strong> {item.brief}
                  </p>
                  <p className="text-sm text-gray-700">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded">
              <p className="text-sm text-indigo-900">
                <strong>Stage Advancement:</strong> Each stage has a maximum turn limit (e.g., 6 for Introduce, 8 for Discuss). 
                The Chair advances stages when sufficient contributions are made or consensus is reached early.
              </p>
            </div>
          </CardContent>
          )}
        </Card>

        {/* Roles & Participants */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('roles')}
          >
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{isExpanded('roles') ? '▼' : '▶'}</span>
              <span className="text-2xl">👥</span> Roles & Participants
            </CardTitle>
          </CardHeader>
          {isExpanded('roles') && (
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <h3 className="text-lg font-bold text-blue-900 mb-2">👑 Chair (Alice)</h3>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• <strong>Introduces</strong> the meeting issue</li>
                  <li>• <strong>Guides</strong> the conversation through stages</li>
                  <li>• <strong>Manages</strong> stage transitions and time limits</li>
                  <li>• <strong>Enforces</strong> consensus when reached early</li>
                  <li>• <strong>Makes</strong> final decisions in the Decide stage</li>
                  <li>• <strong>Confirms</strong> decisions and closes meetings</li>
                  <li>• <strong>Prevents</strong> spam (e.g., too many accepts without debate)</li>
                </ul>
              </div>

              <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                <h3 className="text-lg font-bold text-green-900 mb-2">💼 Participants</h3>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• <strong>Ask questions</strong> and respond to others</li>
                  <li>• <strong>Present arguments</strong> based on their persona</li>
                  <li>• <strong>Propose options</strong> with implementation details</li>
                  <li>• <strong>Vote</strong> on options (support/oppose/abstain)</li>
                  <li>• <strong>React</strong> to others (accept/reject+propose/decline)</li>
                  <li>• <strong>Build relationships</strong> through affinity changes</li>
                  <li>• <strong>Persuade</strong> others based on traits and dominance</li>
                </ul>
              </div>
            </div>

            <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
              <h3 className="text-lg font-bold text-purple-900 mb-3">🔄 Interaction Flow</h3>
              <div className="text-sm text-gray-700 space-y-2">
                <p><strong>Question → Response → Reaction</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-4">
                  <li><strong>Asker</strong> asks a question directed at <strong>Responder</strong></li>
                  <li><strong>Responder</strong> provides an answer or statement</li>
                  <li><strong>Asker</strong> reacts: <em>accept</em> (agree), <em>reject+propose</em> (counter), or <em>decline</em> (disagree)</li>
                  <li>Interactions are logged and affect <strong>affinity</strong> (relationship strength)</li>
                </ol>
              </div>
            </div>
          </CardContent>
          )}
        </Card>

        {/* Person Configuration */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('configuration')}
          >
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{isExpanded('configuration') ? '▼' : '▶'}</span>
              <span className="text-2xl">🧑‍💼</span> Person Configuration
            </CardTitle>
          </CardHeader>
          {isExpanded('configuration') && (
          <CardContent>
            <p className="text-gray-700 mb-4">
              Each participant is configured with multiple parameters that control their behavior:
            </p>
            
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-bold text-gray-900">Persona</h4>
                <p className="text-sm text-gray-600">
                  Free-text description of personality and style (e.g., "Finance-minded; cost/risk focused; skeptical but pragmatic")
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-bold text-gray-900">Stance</h4>
                <p className="text-sm text-gray-600">
                  Initial position: <strong>for</strong>, <strong>against</strong>, or <strong>neutral</strong>. 
                  Can change through persuasion during the meeting.
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-bold text-gray-900">Dominance (0.1 - 3.0)</h4>
                <p className="text-sm text-gray-600">
                  Speaking weight and persuasiveness. Higher dominance = more influence on others. Default: 1.0
                </p>
              </div>

              <div className="border-l-4 border-orange-500 pl-4">
                <h4 className="font-bold text-gray-900">Traits (0.0 - 1.0 each)</h4>
                <ul className="text-sm text-gray-600 space-y-1 mt-1">
                  <li>• <strong>Interrupt:</strong> Tendency to interrupt or speak frequently (0 = passive, 1 = aggressive)</li>
                  <li>• <strong>Conflict Avoid:</strong> Discomfort with disagreement (0 = confrontational, 1 = harmonious)</li>
                  <li>• <strong>Persuasion:</strong> Ability to change others' minds (0 = ineffective, 1 = highly persuasive)</li>
                </ul>
              </div>

              <div className="border-l-4 border-red-500 pl-4">
                <h4 className="font-bold text-gray-900">Goals (0.0 - 1.0 each)</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Priorities that influence voting and option evaluation:
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>• <strong>Cost:</strong> Budget consciousness</div>
                  <div>• <strong>Risk:</strong> Safety and caution</div>
                  <div>• <strong>Speed:</strong> Implementation urgency</div>
                  <div>• <strong>Fairness:</strong> Equity concerns</div>
                  <div>• <strong>Innovation:</strong> Novelty preference</div>
                  <div>• <strong>Consensus:</strong> Group harmony</div>
                </div>
              </div>
            </div>
          </CardContent>
          )}
        </Card>

        {/* Meeting Conditions */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('conditions')}
          >
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{isExpanded('conditions') ? '▼' : '▶'}</span>
              <span className="text-2xl">⚙️</span> Meeting Conditions
            </CardTitle>
          </CardHeader>
          {isExpanded('conditions') && (
          <CardContent>
            <p className="text-gray-700 mb-4">
              Environmental parameters that shape the overall meeting behavior:
            </p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">⏰ Time Pressure (0.0 - 1.0)</h4>
                <p className="text-sm text-gray-600">
                  <strong>0.0:</strong> Relaxed, thorough discussion<br />
                  <strong>1.0:</strong> Critical urgency, quick decisions
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Affects stage turn limits and decision thresholds
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">🎩 Formality (0.0 - 1.0)</h4>
                <p className="text-sm text-gray-600">
                  <strong>0.0:</strong> Casual, informal discussion<br />
                  <strong>1.0:</strong> Formal, structured proceedings
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Influences language style and interaction patterns
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">⚔️ Conflict Tolerance (0.0 - 1.0)</h4>
                <p className="text-sm text-gray-600">
                  <strong>0.0:</strong> Harmony-seeking, avoid conflict<br />
                  <strong>1.0:</strong> Robust debate encouraged
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Controls debate intensity and devil's advocate frequency
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-teal-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">✅ Decision Threshold (0.5 - 1.0)</h4>
                <p className="text-sm text-gray-600">
                  <strong>0.5:</strong> Simple majority required<br />
                  <strong>1.0:</strong> Unanimous consensus needed
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Determines minimum agreement level to decide
                </p>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">🔄 Max Turns (10 - 200)</h4>
                <p className="text-sm text-gray-600">
                  Maximum dialogue exchanges before forced conclusion
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Prevents infinite loops and ensures meetings conclude
                </p>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-2">💡 Creativity Mode (boolean)</h4>
                <p className="text-sm text-gray-600">
                  Enables brainstorming and out-of-the-box thinking
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Increases temperature in Options and Evaluate stages
                </p>
              </div>
            </div>
          </CardContent>
          )}
        </Card>

        {/* Meeting Governance */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('governance')}
          >
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{isExpanded('governance') ? '▼' : '▶'}</span>
              <span className="text-2xl">⚖️</span> Meeting Governance
            </CardTitle>
          </CardHeader>
          {isExpanded('governance') && (
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                <h4 className="font-semibold text-gray-900 mb-1">Quality Control</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Novelty Check:</strong> New contributions must differ from recent dialogue</li>
                  <li>• <strong>Stage Fit:</strong> Responses must match stage objectives</li>
                  <li>• <strong>Duplicate Prevention:</strong> Questions are tracked to avoid repetition</li>
                  <li>• <strong>Spam Control:</strong> Too many accepts without debate triggers counterpoint request</li>
                </ul>
              </div>

              <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                <h4 className="font-semibold text-gray-900 mb-1">Stage Control</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Turn Limits:</strong> Each stage has max turns (Introduce: 6, Discuss: 8, etc.)</li>
                  <li>• <strong>Early Consensus:</strong> Chair advances if all participants align on same stance</li>
                  <li>• <strong>Forced Decision:</strong> After max global turns (50 default), Chair forces conclusion</li>
                  <li>• <strong>Sequential Flow:</strong> Stages progress linearly from Introduce → Confirm</li>
                </ul>
              </div>

              <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded">
                <h4 className="font-semibold text-gray-900 mb-1">Persuasion Mechanics</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Persuasion probability calculated from multiple factors:
                </p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Speaker Persuasion Trait:</strong> +35% weight</li>
                  <li>• <strong>Speaker Dominance:</strong> +25% weight (capped at 1.5)</li>
                  <li>• <strong>Goal Alignment:</strong> +20% weight (shared priorities)</li>
                  <li>• <strong>Affinity:</strong> +25% weight (relationship strength -1.0 to +1.0)</li>
                  <li>• <strong>Listener Conflict Avoidance:</strong> -20% weight (reduces resistance)</li>
                  <li>• <strong>Base Rate:</strong> 15% minimum persuasion chance</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  When persuaded, a person's stance shifts one step toward the speaker's target 
                  (against → neutral → for)
                </p>
              </div>

              <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded">
                <h4 className="font-semibold text-gray-900 mb-1">Options System</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Registration:</strong> Options assigned unique IDs (O1, O2, O3...)</li>
                  <li>• <strong>Duplicate Detection:</strong> Same option = add supporter to existing</li>
                  <li>• <strong>Auto-Evaluation:</strong> AI rates each option on 6 criteria (0-1 scale)</li>
                  <li>• <strong>Auto-Voting:</strong> Agents vote based on utility = Σ(goal_weight × criterion_score)</li>
                  <li>• <strong>Affinity Bonus:</strong> +5% utility if agent likes the proposer</li>
                  <li>• <strong>Winner Selection:</strong> Option with highest (supporters - opponents) wins</li>
                </ul>
              </div>

              <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                <h4 className="font-semibold text-gray-900 mb-1">Affinity & Relationships</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Initial State:</strong> All participants start with 0.0 affinity (neutral)</li>
                  <li>• <strong>Accept Reaction:</strong> +0.1 affinity, +1 interaction score</li>
                  <li>• <strong>Decline/Reject:</strong> -0.1 affinity, -1 interaction score</li>
                  <li>• <strong>Decay Function:</strong> Recent interactions weighted more (half-life: 12 turns)</li>
                  <li>• <strong>Range:</strong> -1.0 (hostile) to +1.0 (allied)</li>
                  <li>• <strong>Impact:</strong> Influences persuasion success and voting decisions</li>
                </ul>
              </div>
            </div>
          </CardContent>
          )}
        </Card>

        {/* AI Architecture */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('architecture')}
          >
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{isExpanded('architecture') ? '▼' : '▶'}</span>
              <span className="text-2xl">🤖</span> AI Architecture
            </CardTitle>
          </CardHeader>
          {isExpanded('architecture') && (
          <CardContent className="space-y-4">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4">
              <h3 className="font-bold text-gray-900 mb-3">LangGraph State Machine</h3>
              <p className="text-sm text-gray-700 mb-3">
                Meetings are orchestrated using <strong>LangGraph</strong>, a state machine framework:
              </p>
              <div className="bg-white rounded p-3 text-sm text-gray-700 font-mono">
                START → Chair → Agent1 → Agent2 → ... → AgentN → Summarizer → Chair → ...
              </div>
              <ul className="text-sm text-gray-700 mt-3 space-y-1">
                <li>• <strong>Chair Node:</strong> Manages stage transitions and guidance</li>
                <li>• <strong>Agent Nodes:</strong> Each participant has their own node</li>
                <li>• <strong>Summarizer Node:</strong> Periodic context compression</li>
                <li>• <strong>Routing:</strong> After summarizer, returns to Chair or END</li>
              </ul>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <h4 className="font-bold text-gray-900 mb-2">🧠 LLM Strategy</h4>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• <strong>Model:</strong> OpenAI GPT-4o-mini</li>
                  <li>• <strong>Temperature by Stage:</strong> Variable creativity
                    <ul className="ml-4 mt-1 space-y-1 text-xs">
                      <li>- Clarify: 0.3 (precise)</li>
                      <li>- Options: 0.8 (creative)</li>
                      <li>- Decide: 0.3 (focused)</li>
                    </ul>
                  </li>
                  <li>• <strong>Structured Output:</strong> Pydantic validation</li>
                  <li>• <strong>Fallback:</strong> Safe defaults on parse errors</li>
                </ul>
              </div>

              <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                <h4 className="font-bold text-gray-900 mb-2">📝 Context Management</h4>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• <strong>Memory Pack:</strong> Last 6 turns + open questions</li>
                  <li>• <strong>Options Summary:</strong> All proposals + votes</li>
                  <li>• <strong>Episodic Log:</strong> Full history of events</li>
                  <li>• <strong>Periodic Summaries:</strong> Context compression</li>
                  <li>• <strong>Stance History:</strong> Track position changes</li>
                </ul>
              </div>
            </div>

            <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
              <h4 className="font-bold text-gray-900 mb-3">🎭 Agent Generation Process</h4>
              <ol className="text-sm text-gray-700 space-y-2">
                <li><strong>1. Plan:</strong> Choose speech act from stage-specific list (question, argue, propose, etc.)</li>
                <li><strong>2. Generate Candidates:</strong> Create 3 alternative responses</li>
                <li><strong>3. Critic Scoring:</strong> Rate each on novelty, stage-fit, usefulness (0-1)</li>
                <li><strong>4. Select Best:</strong> Highest critic score + heuristic adjustments</li>
                <li><strong>5. Sanitize:</strong> Validate names, reactions, stage compliance</li>
                <li><strong>6. Execute:</strong> Log dialogue, update metrics, broadcast via SSE</li>
              </ol>
            </div>
          </CardContent>
          )}
        </Card>

        {/* Metrics & Output */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('metrics')}
          >
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{isExpanded('metrics') ? '▼' : '▶'}</span>
              <span className="text-2xl">📈</span> Metrics & Output
            </CardTitle>
          </CardHeader>
          {isExpanded('metrics') && (
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <h4 className="font-semibold text-gray-900 mb-2">Meeting Metrics</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Turns per Stage:</strong> How long each phase lasted</li>
                  <li>• <strong>Turns by Agent:</strong> Participation levels</li>
                  <li>• <strong>Options Proposed:</strong> Number of solutions</li>
                  <li>• <strong>Votes Cast:</strong> Decision engagement</li>
                  <li>• <strong>Actions Raised:</strong> Follow-up tasks identified</li>
                  <li>• <strong>Stance Changes:</strong> Persuasion effectiveness</li>
                </ul>
              </div>

              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
                <h4 className="font-semibold text-gray-900 mb-2">Meeting Minutes (Auto-Generated)</h4>
                <p className="text-sm text-gray-700 mb-2">
                  Upon completion, the system generates comprehensive minutes including:
                </p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Meeting Title & Issue:</strong> Topic discussed</li>
                  <li>• <strong>Participants:</strong> All attendees with roles</li>
                  <li>• <strong>Final Decision:</strong> What was decided</li>
                  <li>• <strong>Full Transcript:</strong> Complete dialogue history</li>
                  <li>• <strong>Options Summary:</strong> All proposals with scores</li>
                  <li>• <strong>Narrative Summary:</strong> AI-generated overview</li>
                  <li>• <strong>Action Items:</strong> Follow-up tasks</li>
                  <li>• <strong>Metrics Dashboard:</strong> Participation stats</li>
                </ul>
              </div>

              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
                <h4 className="font-semibold text-gray-900 mb-2">Real-Time Streaming</h4>
                <p className="text-sm text-gray-700">
                  Meetings use <strong>Server-Sent Events (SSE)</strong> to stream dialogue in real-time. 
                  The frontend receives each line as it's generated, providing a live viewing experience 
                  like watching an actual meeting unfold. Stream includes stage transitions, votes, 
                  option registrations, and Chair interventions.
                </p>
              </div>
            </div>
          </CardContent>
          )}
        </Card>

        {/* Technical Details */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('technical')}
          >
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{isExpanded('technical') ? '▼' : '▶'}</span>
              <span className="text-2xl">🔧</span> Technical Implementation
            </CardTitle>
          </CardHeader>
          {isExpanded('technical') && (
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-bold text-gray-900 mb-3">Backend Stack</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>FastAPI:</strong> Python web framework</li>
                  <li>• <strong>SQLAlchemy:</strong> ORM with SQLite/PostgreSQL</li>
                  <li>• <strong>LangChain:</strong> LLM orchestration</li>
                  <li>• <strong>LangGraph:</strong> State machine framework</li>
                  <li>• <strong>OpenAI API:</strong> GPT-4o-mini inference</li>
                  <li>• <strong>Pydantic:</strong> Data validation</li>
                  <li>• <strong>JWT:</strong> Authentication</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 mb-3">Frontend Stack</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• <strong>Next.js 14:</strong> React framework</li>
                  <li>• <strong>TypeScript:</strong> Type safety</li>
                  <li>• <strong>Tailwind CSS:</strong> Styling</li>
                  <li>• <strong>Axios:</strong> API client</li>
                  <li>• <strong>EventSource:</strong> SSE streaming</li>
                  <li>• <strong>React Hooks:</strong> State management</li>
                </ul>
              </div>
            </div>
          </CardContent>
          )}
        </Card>

        {/* Best Practices */}
        <Card className="mb-6">
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('practices')}
          >
            <CardTitle className="flex items-center gap-2">
              <span className="text-xl">{isExpanded('practices') ? '▼' : '▶'}</span>
              <span className="text-2xl">✨</span> Best Practices
            </CardTitle>
          </CardHeader>
          {isExpanded('practices') && (
          <CardContent>
            <div className="space-y-3">
              <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                <h4 className="font-semibold text-gray-900 mb-1">🎯 Designing Effective Meetings</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Include diverse personas with different priorities</li>
                  <li>• Set appropriate dominance (1.0-1.5 for balanced participation)</li>
                  <li>• Use context field to provide background information</li>
                  <li>• Match conditions to meeting type (high pressure for urgent, high formality for official)</li>
                </ul>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                <h4 className="font-semibold text-gray-900 mb-1">👥 Configuring People</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Save reusable profiles in People Library for consistency</li>
                  <li>• Balance traits (avoid all low conflict_avoid = excessive debate)</li>
                  <li>• Align goals with realistic priorities (finance person = high cost concern)</li>
                  <li>• Write clear, distinctive personas to differentiate voices</li>
                </ul>
              </div>

              <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded">
                <h4 className="font-semibold text-gray-900 mb-1">⚙️ Tuning Conditions</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Crisis scenario: High time_pressure (0.8+), low max_turns (30)</li>
                  <li>• Brainstorm: Enable creativity_mode, low formality (0.3)</li>
                  <li>• Consensus-building: High decision_threshold (0.9), low conflict_tolerance (0.3)</li>
                  <li>• Robust debate: High conflict_tolerance (0.8), normal decision_threshold (0.7)</li>
                </ul>
              </div>
            </div>
          </CardContent>
          )}
        </Card>

      </div>
    </div>
  );
}
