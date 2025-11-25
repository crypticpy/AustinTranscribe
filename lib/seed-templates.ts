/**
 * Default Template Seeding
 *
 * Provides built-in templates for common meeting and interview scenarios.
 * Templates are seeded once on first app load and include production-ready
 * AI prompts designed to extract meaningful, actionable insights.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Template } from '@/types/template';
import { getDatabase } from './db';

/**
 * Storage key for tracking seeding status
 */
const SEEDING_STATUS_KEY = 'meeting-transcriber-templates-seeded';

/**
 * Built-in template: Meeting Minutes
 *
 * Comprehensive meeting documentation capturing attendees, agenda items,
 * discussions, decisions, and action items for standard business meetings.
 */
const MEETING_MINUTES_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Meeting Minutes',
  description: 'Comprehensive meeting documentation with attendees, agenda items, discussions, decisions, and action items',
  icon: 'FileText',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'attendees',
      name: 'Attendees',
      prompt: `Extract all meeting attendees from the transcript. List each person who participated in the meeting, including their name and role if mentioned. Format as a bullet list with the following structure:
- [Name] - [Role/Title] (if mentioned)

If multiple speakers are identified, include them all. If roles are not explicitly stated, just list the names.`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    },
    {
      id: 'agenda-items',
      name: 'Agenda Items',
      prompt: `Identify and list all agenda items or topics discussed during the meeting. Extract the main topics that were covered, presented, or brought up for discussion. Format as a numbered list with brief descriptions:
1. [Topic Name]: [Brief one-sentence description]

Focus on the planned or stated agenda items, as well as any emergent topics that received significant discussion time.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'key-discussions',
      name: 'Key Discussions',
      prompt: `Summarize the key discussions and deliberations from the meeting. For each major topic, provide:
- The main points raised
- Different perspectives or opinions expressed
- Important context or background information shared
- Questions asked and answers provided

Structure this as paragraphs organized by topic. Focus on substance over procedural matters. Include who said what when it adds important context.`,
      extractEvidence: true,
      outputFormat: 'paragraph',
      dependencies: ['agenda-items']
    },
    {
      id: 'decisions-made',
      name: 'Decisions Made',
      prompt: `Extract the most important decisions, resolutions, or conclusions reached during the meeting. Focus on high-impact choices or policy changes rather than minor acknowledgements. For each decision, specify:
- What was decided
- Who made or approved the decision (if mentioned)
- Any conditions, caveats, or timeline associated with the decision
- The reasoning or justification provided (if any)

Output no more than 6 decisions for meetings under 45 minutes and no more than 10 for longer sessions unless the transcript clearly documents a larger number of discrete decisions. If many trivial acknowledgements occur, summarize them in one bullet rather than listing each individually. Format as a bullet list and ignore vague commitments like "we should look into" unless a concrete decision was made.`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['agenda-items', 'key-discussions']
    },
    {
      id: 'action-items',
      name: 'Action Items',
      prompt: `Identify all action items, tasks, and commitments from the meeting. For each action item, extract:
- The specific task or action to be taken
- Who is responsible (assignee)
- Deadline or timeframe (if mentioned)
- Any dependencies or prerequisites

Format as a checklist with clear ownership:
- [ ] [Task description] - Assigned to: [Person] - Due: [Date/Timeframe]

Only include concrete, actionable tasks with clear owners when possible. If no owner is specified, note "Unassigned".`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['decisions-made', 'agenda-items']
    },
    {
      id: 'next-steps',
      name: 'Next Steps',
      prompt: `Summarize the next steps and future plans discussed. This should include:
- Upcoming meetings or follow-up sessions planned
- Topics to be revisited or continued in future discussions
- Information that needs to be gathered before next meeting
- Any parking lot items or deferred topics

Write as a concise paragraph focusing on forward-looking commitments and continuity.`,
      extractEvidence: false,
      outputFormat: 'paragraph',
      dependencies: ['action-items']
    }
  ]
};

/**
 * Built-in template: Stakeholder Interview
 *
 * Structured analysis for stakeholder or customer interviews, capturing
 * requirements, pain points, goals, and business context.
 */
const STAKEHOLDER_INTERVIEW_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Stakeholder Interview',
  description: 'Capture stakeholder insights, requirements, pain points, and goals from discovery interviews',
  icon: 'Users',
  category: 'interview',
  isCustom: false,
  outputs: ['summary', 'action_items', 'quotes'],
  sections: [
    {
      id: 'participant-background',
      name: 'Background/Context',
      prompt: `Summarize the stakeholder's background and context in two concise paragraphs that we can parse reliably.
- Paragraph 1 must begin with "Stakeholder:" and describe role, department, responsibilities, and relationship to the initiative.
- Paragraph 2 must begin with "Current Context:" and describe status quo, relevant history, past attempts, and situational factors.
Keep each paragraph under 80 words and avoid bullet lists or headings beyond the specified openers.`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'research-questions',
      name: 'Requirements',
      prompt: `Extract every requirement mentioned. Use a single dash "-" bullet per requirement with this exact structure:
- Category: [Functional/Non-Functional/Business] | Priority: [Must-have/Should-have/Nice-to-have/Unstated] | Requirement: [concise description under 20 words]
Include both explicit and implied requirements. Do not use numbered lists or additional headings.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'key-findings',
      name: 'Pain Points',
      prompt: `Identify every pain point or frustration. Use dash bullets with the following structure:
- Pain Point: [problem] | Impact: [business effect] | Workaround: [current workaround or "None"] | Urgency: [High/Medium/Low or inferred]
Keep each field brief so downstream parsers can split on the pipe character.`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['research-questions']
    },
    {
      id: 'quotes',
      name: 'Goals & Success Criteria',
      prompt: `Capture all goals and definitions of success. Use dash bullets with this structure:
- Goal: [objective] | KPI: [metric or "Not specified"] | Success Definition: [how they measure completion] | Horizon: [Short-term/Long-term/Both]
Include explicit statements first, then inferred goals.`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['key-findings']
    },
    {
      id: 'analysis',
      name: 'Budget & Timeline',
      prompt: `Capture all constraints using dash bullets with this structure:
- Budget: [range or "Not discussed"] | Timeline: [date/frame] | Resources: [availability] | Flexibility: [Budget/TIme/Scope priority or "Rigid"]
Mention any trade-offs directly in the field text; do not add extra bullets.`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['key-findings', 'quotes']
    },
    {
      id: 'follow-up-items',
      name: 'Follow-up Items',
      prompt: `List every follow-up or open question using dash bullets formatted as:
- Type: [Question/Stakeholder/Data/Prototype/Decision] | Description: [specific ask] | Owner: [person/team or "Unassigned"] | Due: [date/timeframe or "TBD"]
Only include actionable, concrete items.`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Project Status Review
 *
 * Status update meetings tracking completed work, progress, blockers,
 * and upcoming milestones for project management.
 */
const PROJECT_STATUS_REVIEW_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Project Status Review',
  description: 'Track project progress, completed work, blockers, risks, and upcoming milestones',
  icon: 'CheckCircle2',
  category: 'review',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'project-overview',
      name: 'Completed Work',
      prompt: `List every significant completion using dash bullets with strict structure:
- Item: [deliverable] | Owner: [person/team or "Multiple"] | Outcome: [result or impact] | Timeliness: [On track/Delayed/Early]
Only capture meaningful milestones or features.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'progress-report',
      name: 'In Progress Items',
      prompt: `Capture all active work using dash bullets with this format:
- Item: [workstream/task] | Owner: [person/team] | Status: [progress % or descriptor] | ETA: [date or timeframe] | Dependencies: [blocking item or "None"]
Indicate delays or risks inside the Status or Dependencies fields.`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['project-overview']
    },
    {
      id: 'challenges',
      name: 'Blockers & Challenges',
      prompt: `Identify every blocker or challenge using dash bullets:
- Blocker: [issue] | Impact: [timeline/scope/quality] | Blocked: [team/task] | Mitigation: [plan or "Pending"] | Escalation: [decision needed or "None"]
Mark hard stops vs. friction in the Impact or Mitigation text.`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['progress-report']
    },
    {
      id: 'solutions-proposed',
      name: 'Risks & Issues',
      prompt: `Record every risk with dash bullets formatted as:
- Risk: [description] | Likelihood: [High/Medium/Low] | Impact: [High/Medium/Low] | Mitigation: [plan or "None"] | Owner: [person/team]
If an issue has already occurred, set Likelihood to "Occurred" and capture context in Mitigation.`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['challenges']
    },
    {
      id: 'action-items-review',
      name: 'Next Milestones',
      prompt: `List future milestones using dash bullets with this structure:
- Milestone: [name] | Target Date: [date] | Dependency: [prereq or "None"] | Confidence: [High/Medium/Low] | Notes: [risk or highlight]
Highlight slipping items explicitly in the Notes field.`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['solutions-proposed']
    }
  ]
};

/**
 * Built-in template: 1-on-1 Session
 *
 * Personal development and feedback discussions between manager and team member,
 * capturing career goals, feedback, and commitments.
 */
const ONE_ON_ONE_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: '1-on-1 Session',
  description: 'Document manager-employee 1-on-1 discussions including feedback, goals, and development topics',
  icon: 'User2',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'quotes'],
  sections: [
    {
      id: 'discussion-topics',
      name: 'Discussion Topics',
      prompt: `List every topic discussed using dash bullets formatted as:
- Topic: [subject] | Summary: [1 sentence insight] | Sentiment: [Positive/Neutral/Concern]
Stick to one topic per bullet and keep the summary under 20 words.`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    },
    {
      id: 'feedback-given',
      name: 'Feedback Given',
      prompt: `Document manager-to-employee feedback with dash bullets using this structure:
- Type: [Positive/Constructive] | Feedback: [core message] | Example: [situation reference or "None"] | Importance: [Reason why it matters]
Quotes may appear inside the Feedback field but keep the overall line concise.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'feedback-received',
      name: 'Feedback Received',
      prompt: `Capture employee-to-manager feedback using dash bullets formatted as:
- Topic: [area of feedback] | Message: [concise statement] | Concern Level: [High/Medium/Low] | Manager Response: [commitment or "Not recorded"]
Only include substantive feedback that needs follow-up or acknowledgement.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'goals-and-development',
      name: 'Goals & Development',
      prompt: `Capture growth objectives with dash bullets following this structure:
- Goal: [objective] | Horizon: [Short-term/Long-term] | Skill Focus: [skills/competencies] | Support Needed: [resources/mentorship or "None"]
Include both performance and career goals.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'commitments-and-next-steps',
      name: 'Commitments & Next Steps',
      prompt: `List every commitment with dash bullets formatted as:
- Owner: [Manager/Team Member/Joint] | Commitment: [specific action] | Due: [date/timeframe or "TBD"] | Status: [New/Follow-up]
Only include concrete, trackable actions.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Client Discovery Call
 *
 * Sales and discovery calls with prospective clients, capturing business needs,
 * challenges, requirements, and next steps in the sales process.
 */
const CLIENT_DISCOVERY_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Client Discovery Call',
  description: 'Capture client business context, challenges, requirements, and success criteria from discovery calls',
  icon: 'Phone',
  category: 'interview',
  isCustom: false,
  outputs: ['summary', 'action_items', 'quotes'],
  sections: [
    {
      id: 'business-context',
      name: 'Business Context',
      prompt: `Summarize the client's business context in two short paragraphs so downstream systems can parse labels.
- Paragraph 1 must start with "Company Snapshot:" and describe industry, scale, current model, and market position.
- Paragraph 2 must start with "Strategic Context:" and cover initiatives, transformation efforts, and forces shaping their direction.
Keep each paragraph under 80 words.`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'current-challenges',
      name: 'Current Challenges',
      prompt: `Extract every challenge using dash bullets formatted as:
- Challenge: [problem] | Impact: [business effect] | Duration: [timeframe or "Unknown"] | Attempts: [previous solutions or "None"] | Urgency: [High/Medium/Low]
Use direct language from the client when available.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'requirements-and-needs',
      name: 'Requirements & Needs',
      prompt: `Document every requirement with dash bullets using this structure:
- Requirement: [capability] | Priority: [Must-have/Important/Nice-to-have] | Type: [Feature/Integration/Support/Scale/etc.] | Detail: [concise qualifier]
Include inferred needs after explicit ones, but keep the same format.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'constraints-and-considerations',
      name: 'Constraints & Considerations',
      prompt: `Identify every constraint with dash bullets formatted as:
- Constraint: [description] | Type: [Budget/Timeline/Technical/Org/Compliance/Risk] | Detail: [specifics] | Flexibility: [High/Medium/Low]
Include decision-making or approval considerations under the Type that best fits.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'success-criteria',
      name: 'Success Criteria',
      prompt: `Capture success definitions using dash bullets structured as:
- Criterion: [metric/outcome] | Target: [quantified goal or "Qualitative"] | Evaluation: [how they'll judge success] | Win Definition: [what makes it a win]
Reference any ROI expectations within the Target field.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'next-steps',
      name: 'Next Steps',
      prompt: `List all follow-up steps using dash bullets formatted as:
- Owner: [Our Team/Client/Joint] | Action: [specific task] | Deliverable: [artifact/meeting or "N/A"] | Timing: [date/timeframe] | Dependency: [prereq or "None"]
Ensure every action is concrete and time-bound.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Retrospective
 *
 * Team retrospective meetings analyzing what went well, what didn't,
 * lessons learned, and improvements for agile teams.
 */
const RETROSPECTIVE_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Retrospective',
  description: 'Analyze what went well, what didn\'t, lessons learned, and action items for continuous improvement',
  icon: 'RefreshCw',
  category: 'review',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'what-went-well',
      name: 'What Went Well',
      prompt: `List the wins using dash bullets with this structure:
- Item: [success] | Why: [reason it worked] | Impact: [team/project effect] | Repeatable: [Yes/No]
Include process, technical, and team highlights alike.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'what-didnt-go-well',
      name: 'What Didn\'t Go Well',
      prompt: `Document problems using dash bullets formatted as:
- Issue: [problem] | Impact: [effect] | Root Cause: [factor or "Unknown"] | Pattern: [Single/Recurring]
Keep language blameless and system-focused.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'lessons-learned',
      name: 'Lessons Learned',
      prompt: `Capture insights using dash bullets with:
- Lesson: [insight] | Evidence: [observation leading to it] | Application: [how to use it next time]
Focus on actionable guidance, not generic statements.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'action-items-for-improvement',
      name: 'Action Items for Improvement',
      prompt: `List committed improvements using checkbox bullets that mirror Meeting Minutes:
- [ ] Action: [change to implement] | Owner: [person/team] | Due: [date/timeframe] | Success Metric: [measurement] | Priority: [High/Medium/Low]
Only include concrete commitments.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'team-feedback',
      name: 'Team Feedback',
      prompt: `Provide two short paragraphs so we can parse labeled sentiment:
- Paragraph 1 must start with "Morale:" and summarize energy, recognition, and appreciation signals.
- Paragraph 2 must start with "Collaboration:" and cover communication themes, concerns, and feedback on the retro itself.
Keep paragraphs under 70 words each.`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    }
  ]
};

/**
 * Built-in template: Legislative & Board Briefing
 */
const LEGISLATIVE_BODY_BRIEFING_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Legislative & Board Briefing',
  description: 'Capture council/board briefing highlights, public comment themes, motions, and directives',
  icon: 'Gavel',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'briefing-overview',
      name: 'Briefing Overview',
      prompt: `Provide two concise paragraphs for deterministic parsing.
- Paragraph 1 must begin with "Meeting Focus:" and summarize agenda scope, presenters, and policy areas.
- Paragraph 2 must begin with "Key Outcomes:" and highlight overall tone plus top results in under 80 words.`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'department-highlights',
      name: 'Department Highlights',
      prompt: `List every department briefing using dash bullets with this structure:
- Department: [name] | Topic: [subject] | Highlight: [<=15 words] | Follow-up: [needed action or "None"]
Include only substantive updates delivered to council/board.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'public-comment-themes',
      name: 'Public Comment Themes',
      prompt: `Summarize public comment trends using dash bullets:
- Theme: [topic] | Concern: [brief detail] | District/Area: [identifier or "Citywide"] | Frequency: [High/Medium/Low]
Capture recurring sentiments rather than individual anecdotes.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'motions-and-votes',
      name: 'Motions & Votes',
      prompt: `Document every motion considered using dash bullets:
- Motion: [title] | Sponsor: [member] | Vote: [result or tally] | Follow-up: [implementation step or "None"]
Only include motions that reached deliberation.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'action-directives',
      name: 'Action Directives',
      prompt: `Capture directives assigned by council/board using checkbox bullets:
- [ ] Directive: [task] | Owner: [department/office] | Due: [date/timeframe] | Status: [New/Extended]
Ensure each directive is concrete and traceable.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'announcements-and-next-session',
      name: 'Announcements & Next Session',
      prompt: `Provide two labeled sentences for clarity.
- Sentence 1 must start with "Announcements:" and note key reminders or proclamations.
- Sentence 2 must start with "Next Session:" and mention planned date/themes in <=30 words.`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    }
  ]
};

/**
 * Built-in template: Capital Project Coordination
 */
const CAPITAL_PROJECT_COORDINATION_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Capital Project Coordination',
  description: 'Track multi-department capital projects across scope, schedule, risks, and milestones',
  icon: 'Landmark',
  category: 'review',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'portfolio-snapshot',
      name: 'Portfolio Snapshot',
      prompt: `Provide two short paragraphs:
- Paragraph 1 starts with "Portfolio Scope:" summarizing number of projects, total budget, and key corridors.
- Paragraph 2 starts with "Overall Health:" noting aggregate schedule status and resource posture in <=70 words.`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'workstream-progress',
      name: 'Workstream Progress',
      prompt: `List each major workstream with dash bullets:
- Workstream: [name] | Phase: [stage] | Status: [On Track/At Risk/Delayed] | Note: [<=15 word context]
Limit to the most material workstreams discussed.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'budget-and-schedule-risks',
      name: 'Budget & Schedule Risks',
      prompt: `Document risks using dash bullets:
- Risk: [description] | Impact: [Budget/Schedule/Both] | Owner: [department] | Mitigation: [next step or "Pending"]
Highlight items requiring council or executive awareness.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'field-issues-and-constraints',
      name: 'Field Issues & Constraints',
      prompt: `Capture field constraints using dash bullets:
- Issue: [problem] | Location: [project/area] | Cause: [factor] | Temporary Measure: [response or "None"]
Include permitting, community, or utility conflicts explicitly.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'upcoming-milestones',
      name: 'Upcoming Milestones',
      prompt: `List near-term milestones as dash bullets:
- Milestone: [name] | Target Date: [date] | Dependency: [prerequisite or "None"] | Confidence: [High/Medium/Low]
Flag threatened milestones inside the Confidence field.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Public Safety Incident Review
 */
const PUBLIC_SAFETY_INCIDENT_REVIEW_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Public Safety Incident Review',
  description: 'Review significant incidents, response actions, community impact, and corrective measures',
  icon: 'Shield',
  category: 'review',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'incident-summary',
      name: 'Incident Summary',
      prompt: `Provide two sentences for structured parsing.
- Sentence 1 begins with "Overview:" describing incident type, location, and scale.
- Sentence 2 begins with "Timeline:" highlighting critical timestamps and escalation in <=60 words.`,
      extractEvidence: true,
      outputFormat: 'paragraph'
    },
    {
      id: 'response-actions',
      name: 'Response Actions',
      prompt: `List each major response using dash bullets:
- Unit: [team/division] | Action: [tactic] | Timing: [timestamp or window] | Outcome: [result]
Include coordination with partner agencies when mentioned.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'policy-and-training-gaps',
      name: 'Policy & Training Gaps',
      prompt: `Document any gaps discussed using dash bullets:
- Gap: [issue] | Risk: [impact] | Required Fix: [policy/training change] | Owner: [office]
Focus on actionable systemic improvements.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'community-impact-notes',
      name: 'Community Impact Notes',
      prompt: `Capture community-facing effects using dash bullets:
- Population: [group/neighborhood] | Concern: [<=12 words] | Engagement: [outreach taken] | Follow-up: [next step or "Pending"]
Center impacted residents or businesses.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'corrective-actions',
      name: 'Corrective Actions',
      prompt: `List corrective commitments with checkbox bullets:
- [ ] Action: [change to implement] | Owner: [unit] | Due: [date/timeframe] | Metric: [success indicator]
Only include approved actions, not suggestions.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Community Engagement Session
 */
const COMMUNITY_ENGAGEMENT_SESSION_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Community Engagement Session',
  description: 'Summarize resident priorities, concerns, quotes, and commitments from outreach events',
  icon: 'Users2',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'quotes'],
  sections: [
    {
      id: 'session-overview',
      name: 'Session Overview',
      prompt: `Provide two sentences:
- Sentence 1 begins with "Session Context:" covering neighborhood, host, and purpose.
- Sentence 2 begins with "Attendance & Tone:" describing turnout, demographics, and overall sentiment in <=35 words.`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'resident-priorities',
      name: 'Resident Priorities',
      prompt: `List priorities using dash bullets:
- Priority: [topic] | Neighborhood: [area] | Desired Outcome: [<=12 words] | Urgency: [High/Medium/Low]
Reflect the language residents used wherever possible.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'barriers-and-concerns',
      name: 'Barriers & Concerns',
      prompt: `Document barriers via dash bullets:
- Concern: [issue] | Impacted Group: [community] | Root Cause: [factor] | Severity: [High/Medium/Low]
Focus on obstacles the city must address.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'representative-quotes',
      name: 'Representative Quotes',
      prompt: `Provide quotes using dash bullets that respect this pattern:
- Speaker: [name or "Resident"] | Affiliation: [group/district] | Quote: "[<=30 words]" | Sentiment: [Support/Concern]
Quotes must be verbatim excerpts from the transcript.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'commitments-and-follow-ups',
      name: 'Commitments & Follow-ups',
      prompt: `Record commitments with checkbox bullets:
- [ ] Owner: [department] | Follow-up: [task] | Due: [date/timeframe] | Community Contact: [person or "TBD"]
Ensure every item is actionable and time-bound.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Budget Planning Workshop
 */
const BUDGET_PLANNING_WORKSHOP_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Budget Planning Workshop',
  description: 'Facilitate fiscal planning by logging funding requests, tradeoffs, and allocations',
  icon: 'Calculator',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'fiscal-context',
      name: 'Fiscal Context',
      prompt: `Provide two paragraphs:
- Paragraph 1 starts with "Revenue Outlook:" summarizing projected revenue drivers or constraints.
- Paragraph 2 starts with "Cost Pressures:" outlining major obligations and trendlines in <=70 words.`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'funding-requests',
      name: 'Funding Requests',
      prompt: `Document requests using dash bullets:
- Department: [name] | Request: [program/equipment] | Amount: [$ value or range] | Priority: [Mandated/Core/Discretionary]
Only include requests discussed in detail.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'tradeoffs-and-scenarios',
      name: 'Tradeoffs & Scenarios',
      prompt: `List scenarios via dash bullets:
- Scenario: [name] | Assumption: [key variable] | Impact: [service effect] | Feasibility: [High/Medium/Low]
Capture both adopted and discarded scenarios.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'decisions-and-allocations',
      name: 'Decisions & Allocations',
      prompt: `Capture the most consequential budget decisions or allocations. Use at most 8 bullets unless the transcript explicitly records a longer list of discrete votes. When dozens of minor adjustments occur, summarize them together. Format each bullet as:
- Allocation: [program/project] | Amount: [$] | Condition: [contingency or "None"] | Vote: [consensus/rollcall result]
Only include confirmed decisions.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'action-items',
      name: 'Action Items',
      prompt: `List follow-ups using checkbox bullets:
- [ ] Task: [action] | Owner: [finance lead/department] | Due: [date/timeframe] | Dependency: [prerequisite or "None"]
Ensure every task advances the budget process.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Regulatory Compliance Hearing
 */
const REGULATORY_COMPLIANCE_HEARING_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Regulatory Compliance Hearing',
  description: 'Capture findings, testimony, and orders from compliance hearings',
  icon: 'Scale',
  category: 'review',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'case-overview',
      name: 'Case Overview',
      prompt: `Provide two sentences:
- Sentence 1 begins with "Subject/Site:" noting operator, site, and permit context.
- Sentence 2 begins with "Issue Summary:" describing violations and inspection dates in <=60 words.`,
      extractEvidence: true,
      outputFormat: 'paragraph'
    },
    {
      id: 'regulatory-findings',
      name: 'Regulatory Findings',
      prompt: `List findings using dash bullets:
- Finding: [violation] | Citation: [code/reference] | Severity: [High/Medium/Low] | Evidence Ref: [timestamp or exhibit]
Include each discrete violation cited.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'mitigation-plans',
      name: 'Mitigation Plans',
      prompt: `Document mitigation steps via dash bullets:
- Plan: [action] | Responsible Party: [entity] | Timeline: [date/window] | Status: [Proposed/Approved/In Progress]
Capture both immediate and long-term remedies.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'testimony-highlights',
      name: 'Testimony Highlights',
      prompt: `Summarize testimony with dash bullets:
- Speaker: [name/role] | Position: [support/concern] | Quote: "[<=25 words]" | Key Point: [<=10 words]
Include city staff, residents, and regulated parties.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'orders-and-deadlines',
      name: 'Orders & Deadlines',
      prompt: `Capture formal orders via dash bullets:
- Order: [requirement] | Due Date: [date] | Penalty: [amount/consequence or "Warning"] | Monitoring: [responsible unit]
Only include directives issued during the hearing.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Emergency Operations Briefing
 */
const EMERGENCY_OPERATIONS_BRIEFING_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Emergency Operations Briefing',
  description: 'Summarize incident status, operational priorities, resources, and immediate tasks',
  icon: 'AlertTriangle',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'incident-status',
      name: 'Incident Status',
      prompt: `Provide two sentences:
- Sentence 1 begins with "Situation:" outlining hazard type, affected geography, and severity.
- Sentence 2 begins with "Operational Period:" covering current objectives and time window in <=50 words.`,
      extractEvidence: true,
      outputFormat: 'paragraph'
    },
    {
      id: 'operational-priorities',
      name: 'Operational Priorities',
      prompt: `List priorities as dash bullets:
- Priority: [objective] | Lead Agency: [department] | Status: [Not Started/In Progress/Complete] | Note: [<=12 words]
Focus on life safety, incident stabilization, and property conservation goals.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'resource-deployment',
      name: 'Resource Deployment',
      prompt: `Document resource posture via dash bullets:
- Resource: [asset/team] | Quantity: [number] | Location: [site/EOC] | Sufficiency: [Adequate/Limited/Critical]
Include mutual aid assets when present.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'critical-risks',
      name: 'Critical Risks',
      prompt: `Describe risks using dash bullets:
- Risk: [threat] | Probability: [High/Medium/Low] | Impact: [High/Medium/Low] | Mitigation: [planned action]
Emphasize risks needing leadership decisions.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'immediate-actions',
      name: 'Immediate Actions',
      prompt: `Record immediate tasks with checkbox bullets:
- [ ] Action: [task] | Owner: [section chief/agency] | Start: [time] | Completion Criteria: [measure]
Limit to actions due in the current operational period.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'next-operational-period-plan',
      name: 'Next Operational Period Plan',
      prompt: `Provide two sentences:
- Sentence 1 starts with "Next Period Goals:" summarizing objectives for the upcoming period.
- Sentence 2 starts with "Coordination Notes:" highlighting interagency dependencies in <=45 words.`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    }
  ]
};

/**
 * Built-in template: Field Operations Standup
 */
const FIELD_OPERATIONS_STANDUP_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Field Operations Standup',
  description: 'Monitor daily field performance, disruptions, maintenance, and assignments',
  icon: 'Bus',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items'],
  sections: [
    {
      id: 'performance-snapshot',
      name: 'Performance Snapshot',
      prompt: `Provide two sentences:
- Sentence 1 begins with "Service Volume/Utilization:" sharing notable metrics or capacity insights.
- Sentence 2 begins with "On-Time Performance:" summarizing OTP percentages and trends in <=40 words.`,
      extractEvidence: true,
      outputFormat: 'paragraph'
    },
    {
      id: 'service-disruptions',
      name: 'Service Disruptions',
      prompt: `List disruptions as dash bullets:
- Route/Area/Zone: [identifier] | Issue: [cause] | Start Time: [HH:MM] | Status: [Active/Resolved] | Impact: [brief note or "None"]
Include impacts to normal operations.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'maintenance-flags',
      name: 'Maintenance Flags',
      prompt: `Document maintenance needs via dash bullets:
- Asset/Equipment: [name/ID] | Condition: [rating] | Required Work: [task] | ETA: [timeframe]
Highlight items affecting service availability.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'customer-feedback-trends',
      name: 'Customer Feedback Trends',
      prompt: `Capture feedback trends with dash bullets:
- Trend: [topic] | Source: [311/app/social] | Volume: [count or High/Med/Low] | Sentiment: [Positive/Neutral/Negative]
Group similar comments into single bullets.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'assignments-and-owners',
      name: 'Assignments & Owners',
      prompt: `List assignments with checkbox bullets:
- [ ] Task: [action] | Owner: [supervisor/team] | Location/Route: [identifier] | Due: [time]
Use this to track daily accountability.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Case Management Conference
 */
const CASE_MANAGEMENT_CONFERENCE_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Case Management Conference',
  description: 'Coordinate services, needs, and commitments for complex case management',
  icon: 'Home',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'quotes'],
  sections: [
    {
      id: 'case-overview',
      name: 'Case Overview',
      prompt: `Provide two sentences:
- Sentence 1 begins with "Client/Household:" covering demographics and status.
- Sentence 2 begins with "Case Status:" summarizing current placement, risks, and time in program in <=55 words.`,
      extractEvidence: true,
      outputFormat: 'paragraph'
    },
    {
      id: 'needs-assessment',
      name: 'Needs Assessment',
      prompt: `List needs via dash bullets:
- Need: [service/support] | Urgency: [High/Medium/Low] | Current Support: [provider or "None"] | Gap: [what's missing]
Include housing, health, employment, and legal needs as relevant.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'service-coordination',
      name: 'Service Coordination',
      prompt: `Capture coordination steps using dash bullets:
- Provider: [agency] | Service: [offering] | Status: [Pending/In Progress/Complete] | Next Step: [action]
Highlight interagency dependencies.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'client-voice',
      name: 'Client Voice',
      prompt: `Document client quotes via dash bullets:
- Speaker: [name or "Client"] | Quote: "[<=30 words]" | Priority: [need they emphasized] | Follow-up: [action or "Hear back"]
Use direct quotes only.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'next-steps-and-owners',
      name: 'Next Steps & Owners',
      prompt: `Record commitments with checkbox bullets:
- [ ] Action: [task] | Lead Agency: [department/nonprofit] | Due: [date/timeframe] | Outcome Measure: [indicator]
Only include items approved during the conference.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Community Program Review
 */
const COMMUNITY_PROGRAM_REVIEW_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Community Program Review',
  description: 'Evaluate program performance, community feedback, resource needs, and improvement actions',
  icon: 'TreePine',
  category: 'review',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'program-snapshot',
      name: 'Program Snapshot',
      prompt: `Provide two sentences:
- Sentence 1 begins with "Program Focus:" describing objectives, period, and participants.
- Sentence 2 begins with "Status:" covering current phase, capacity, and notable context in <=55 words.`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'participation-metrics',
      name: 'Participation Metrics',
      prompt: `List metrics via dash bullets:
- Metric: [name] | Value: [number/%] | Trend: [Up/Flat/Down] | Equity Focus: [group impacted]
Include attendance, waitlists, or volunteer hours as discussed.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'facility-and-resource-needs',
      name: 'Facility & Resource Needs',
      prompt: `Document needs with dash bullets:
- Facility/Location: [name] | Need: [equipment/staff/etc.] | Urgency: [High/Medium/Low] | Interim Measure: [workaround or "None"]
Capture both capital and operational gaps.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'community-feedback',
      name: 'Community Feedback',
      prompt: `Summarize feedback using dash bullets:
- Segment: [youth/seniors/etc.] | Feedback: [<=15 words] | Sentiment: [Positive/Neutral/Concern] | Requested Change: [action]
Represent diverse voices noted in the meeting.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'approvals-and-decisions',
      name: 'Approvals & Decisions',
      prompt: `Record the most impactful approvals or decisions as dash bullets:
- Decision: [approval/action] | Approver: [title] | Condition: [if any] | Effective Date: [date]
Limit to the top 8 items unless the transcript explicitly confirms more. When the team rubber-stamps a batch of minor adjustments, summarize them instead of listing each individually. Include grant submissions, schedule changes, or fee adjustments that materially affect operations.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'improvement-actions',
      name: 'Improvement Actions',
      prompt: `List improvement tasks with checkbox bullets:
- [ ] Action: [task] | Owner: [division] | Due: [date/timeframe] | Success Metric: [indicator]
Only include actions committed to during the review.`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

// =============================================================================
// NEW TEMPLATES - Agile/Project Management
// =============================================================================

/**
 * Built-in template: Sprint Planning Session
 */
const SPRINT_PLANNING_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Sprint Planning Session',
  description: 'Agile sprint planning with goals, capacity, backlog commitments, and team agreements',
  icon: 'CalendarCheck',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'sprint-goal',
      name: 'Sprint Goal',
      prompt: `Provide two concise paragraphs:
- Paragraph 1 must begin with "Sprint Objective:" describing the primary goal and business value targeted for this sprint.
- Paragraph 2 must begin with "Success Criteria:" outlining how the team will know the sprint goal is achieved in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'capacity-availability',
      name: 'Capacity & Availability',
      prompt: `Document team capacity using dash bullets:
- Team Member: [name] | Availability: [% or days] | Constraints: [PTO/meetings/other or "None"] | Focus Area: [specialty or "General"]
Include any team-wide capacity factors at the end.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    },
    {
      id: 'backlog-items-committed',
      name: 'Backlog Items Committed',
      prompt: `List committed backlog items using dash bullets:
- Item: [story/task title] | Type: [Story/Bug/Task/Spike] | Points: [estimate or "Unestimated"] | Owner: [assignee or "Unassigned"] | Priority: [P1/P2/P3]
Only include items the team committed to for this sprint.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['capacity-availability']
    },
    {
      id: 'acceptance-criteria',
      name: 'Acceptance Criteria',
      prompt: `Document acceptance criteria discussed for key items using dash bullets:
- Item: [story title] | Criteria: [specific acceptance condition] | Verified By: [test type or "Manual review"]
Focus on items where acceptance criteria were explicitly discussed or clarified.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['backlog-items-committed']
    },
    {
      id: 'risks-dependencies',
      name: 'Risks & Dependencies',
      prompt: `Identify risks and dependencies using dash bullets:
- Type: [Risk/Dependency] | Description: [issue] | Impact: [affected items] | Mitigation: [plan or "Needs discussion"] | Owner: [person]
Include external dependencies, technical risks, and blockers.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'sprint-commitments',
      name: 'Sprint Commitments',
      prompt: `Record team commitments with checkbox bullets:
- [ ] Commitment: [agreement] | Owner: [team/individual] | Due: [date or "End of sprint"] | Type: [Process/Technical/Communication]
Include process agreements, ceremonies, and team working agreements.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['backlog-items-committed']
    }
  ]
};

/**
 * Built-in template: Sprint Review / Demo
 */
const SPRINT_REVIEW_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Sprint Review / Demo',
  description: 'Sprint review with demo highlights, stakeholder feedback, and backlog updates',
  icon: 'Presentation',
  category: 'review',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'sprint-summary',
      name: 'Sprint Summary',
      prompt: `Provide two concise paragraphs:
- Paragraph 1 must begin with "Completed:" summarizing what was delivered this sprint vs. what was planned.
- Paragraph 2 must begin with "Velocity:" noting points completed, carry-over items, and any significant variances in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'paragraph'
    },
    {
      id: 'demo-highlights',
      name: 'Demo Highlights',
      prompt: `Document demonstrated features using dash bullets:
- Feature: [name] | Demo'd By: [person] | Status: [Complete/Partial/In Progress] | Reaction: [stakeholder response summary]
Focus on features that were shown during the demo.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'stakeholder-feedback',
      name: 'Stakeholder Feedback',
      prompt: `Capture stakeholder feedback using dash bullets:
- Stakeholder: [name/role] | Feedback: [comment] | Type: [Praise/Concern/Request/Question] | Action Needed: [Yes/No]
Include both positive feedback and concerns raised.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['demo-highlights']
    },
    {
      id: 'backlog-updates',
      name: 'Backlog Updates',
      prompt: `Record backlog changes using dash bullets:
- Change: [addition/reprioritization/removal] | Item: [story/feature] | Reason: [rationale] | Priority: [new priority or "TBD"]
Include new items added and any reprioritization decisions.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['stakeholder-feedback']
    },
    {
      id: 'review-action-items',
      name: 'Action Items',
      prompt: `List follow-up actions with checkbox bullets:
- [ ] Action: [task] | Owner: [person] | Due: [date/timeframe] | Source: [feedback item or discussion]
Only include concrete, actionable follow-ups from the review.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['stakeholder-feedback', 'backlog-updates']
    }
  ]
};

/**
 * Built-in template: Daily Standup Summary
 */
const DAILY_STANDUP_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Daily Standup Summary',
  description: 'Quick daily standup with team updates, blockers, and coordination needs',
  icon: 'Coffee',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items'],
  sections: [
    {
      id: 'team-updates',
      name: 'Team Updates',
      prompt: `Document each team member's update using dash bullets:
- Person: [name] | Yesterday: [<=15 words] | Today: [<=15 words] | Status: [On Track/Blocked/Need Help]
Keep updates concise and action-focused.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    },
    {
      id: 'blockers-raised',
      name: 'Blockers Raised',
      prompt: `List blockers using dash bullets:
- Blocker: [issue] | Affected: [person/task] | Duration: [how long blocked] | Help Needed: [type of assistance]
Only include actual blockers preventing progress.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'parking-lot-items',
      name: 'Parking Lot Items',
      prompt: `Capture parking lot topics using dash bullets:
- Topic: [subject] | Raised By: [person] | Participants Needed: [who should discuss] | Urgency: [High/Medium/Low]
Include topics deferred from standup for separate discussion.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    },
    {
      id: 'coordination-needs',
      name: 'Coordination Needs',
      prompt: `Document coordination items using dash bullets:
- Need: [collaboration required] | Between: [people involved] | Topic: [what to coordinate] | When: [timing]
Focus on hand-offs, pairing needs, and sync-ups mentioned.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points',
      dependencies: ['team-updates']
    }
  ]
};

/**
 * Built-in template: Release Planning Meeting
 */
const RELEASE_PLANNING_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Release Planning Meeting',
  description: 'Release planning with scope, milestones, resources, risks, and go/no-go criteria',
  icon: 'Rocket',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'release-scope',
      name: 'Release Scope',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Release Overview:" describing the release version, theme, and key features targeted.
- Paragraph 2 must begin with "Scope Boundaries:" clarifying what is explicitly out of scope in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'paragraph'
    },
    {
      id: 'timeline-milestones',
      name: 'Timeline & Milestones',
      prompt: `List milestones using dash bullets:
- Milestone: [name] | Date: [target date] | Owner: [responsible party] | Dependency: [prerequisite or "None"]
Include code freeze, testing phases, and deployment dates.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'resource-requirements',
      name: 'Resource Requirements',
      prompt: `Document resource needs using dash bullets:
- Resource: [person/team/tool] | Role: [function] | Availability: [status] | Gap: [shortfall or "None"]
Include development, QA, DevOps, and support resources.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'risk-assessment',
      name: 'Risk Assessment',
      prompt: `Capture risks using dash bullets:
- Risk: [description] | Category: [Technical/Schedule/Resource/External] | Likelihood: [High/Medium/Low] | Impact: [High/Medium/Low] | Mitigation: [plan]
Focus on risks that could affect the release date or quality.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['release-scope', 'timeline-milestones']
    },
    {
      id: 'go-no-go-criteria',
      name: 'Go/No-Go Criteria',
      prompt: `List release criteria using dash bullets:
- Criterion: [requirement] | Category: [Quality/Feature/Compliance/Business] | Status: [Met/Not Met/TBD] | Owner: [responsible party]
Include test coverage, performance, and business approval requirements.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'communication-plan',
      name: 'Communication Plan',
      prompt: `Document communication items using dash bullets:
- Audience: [stakeholder group] | Message: [key communication] | Channel: [method] | Timing: [when] | Owner: [person]
Include internal and external communications planned.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Scrum of Scrums
 */
const SCRUM_OF_SCRUMS_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Scrum of Scrums',
  description: 'Cross-team coordination with status reports, dependencies, escalations, and integration points',
  icon: 'Network',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items'],
  sections: [
    {
      id: 'team-status-reports',
      name: 'Team Status Reports',
      prompt: `Document each team's status using dash bullets:
- Team: [name] | Sprint Progress: [% or status] | Key Delivery: [main item this sprint] | Health: [Green/Yellow/Red]
Summarize each team's overall status briefly.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    },
    {
      id: 'cross-team-dependencies',
      name: 'Cross-Team Dependencies',
      prompt: `List dependencies using dash bullets:
- Dependency: [what's needed] | From: [providing team] | To: [receiving team] | Due: [date] | Status: [On Track/At Risk/Blocked]
Focus on dependencies between teams that could cause delays.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'escalation-items',
      name: 'Escalation Items',
      prompt: `Document escalations using dash bullets:
- Issue: [problem] | Teams Affected: [list] | Decision Needed: [what leadership must decide] | Urgency: [High/Medium/Low]
Include items that cannot be resolved at the team level.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'coordination-decisions',
      name: 'Coordination Decisions',
      prompt: `Record decisions made using dash bullets:
- Decision: [agreement reached] | Teams Involved: [participants] | Impact: [effect on work] | Owner: [accountable party]
Include cross-team agreements and coordination choices.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['cross-team-dependencies', 'escalation-items']
    },
    {
      id: 'integration-points',
      name: 'Integration Points',
      prompt: `List upcoming integration milestones using dash bullets:
- Integration: [what's being integrated] | Teams: [involved teams] | Target Date: [date] | Risk Level: [High/Medium/Low]
Focus on near-term integration activities requiring coordination.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

// =============================================================================
// NEW TEMPLATES - Process Mapping & Improvement
// =============================================================================

/**
 * Built-in template: Process Discovery Interview
 */
const PROCESS_DISCOVERY_INTERVIEW_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Process Discovery Interview',
  description: 'Stakeholder interview to understand existing processes, systems, pain points, and improvements',
  icon: 'Search',
  category: 'interview',
  isCustom: false,
  outputs: ['summary', 'action_items', 'quotes'],
  sections: [
    {
      id: 'interviewee-context',
      name: 'Interviewee Context',
      prompt: `Provide two concise paragraphs:
- Paragraph 1 must begin with "Role & Experience:" describing the interviewee's position, tenure, and involvement with the process.
- Paragraph 2 must begin with "Process Relationship:" explaining how they interact with this process daily in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'process-overview',
      name: 'Process Overview',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Process Purpose:" describing what the process accomplishes and why it exists.
- Paragraph 2 must begin with "Scope & Boundaries:" clarifying where the process starts, ends, and what's excluded in <=70 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'paragraph'
    },
    {
      id: 'steps-activities',
      name: 'Steps & Activities',
      prompt: `Document process steps using dash bullets:
- Step: [sequence number] | Activity: [what happens] | Actor: [who does it] | Trigger: [what initiates this step] | Output: [result]
Capture the process in sequential order as described by the interviewee.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['process-overview']
    },
    {
      id: 'systems-tools',
      name: 'Systems & Tools',
      prompt: `List systems and tools using dash bullets:
- System/Tool: [name] | Purpose: [how it's used in process] | Users: [who uses it] | Satisfaction: [High/Medium/Low] | Issues: [problems or "None"]
Include software, spreadsheets, paper forms, and other tools mentioned.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'pain-points-bottlenecks',
      name: 'Pain Points & Bottlenecks',
      prompt: `Capture pain points using dash bullets:
- Pain Point: [issue] | Location: [where in process] | Frequency: [how often] | Impact: [effect on work] | Workaround: [current solution or "None"]
Include delays, rework, frustrations, and inefficiencies mentioned.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['steps-activities']
    },
    {
      id: 'improvement-suggestions',
      name: 'Improvement Suggestions',
      prompt: `Document suggestions using dash bullets:
- Suggestion: [idea] | Problem Addressed: [pain point it solves] | Feasibility: [Easy/Medium/Hard or "Unknown"] | Benefit: [expected improvement]
Include both explicit suggestions and implied improvements.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['pain-points-bottlenecks']
    }
  ]
};

/**
 * Built-in template: Process Mapping Workshop
 */
const PROCESS_MAPPING_WORKSHOP_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Process Mapping Workshop',
  description: 'Collaborative workshop to map current state processes, roles, handoffs, and improvement opportunities',
  icon: 'GitBranch',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'process-scope',
      name: 'Process Scope',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Process Name & Purpose:" identifying the process being mapped and its business objective.
- Paragraph 2 must begin with "Boundaries:" defining the trigger event, end state, and what's excluded in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'current-state-map',
      name: 'Current State Map',
      prompt: `Document the as-is process using dash bullets:
- Step: [number] | Activity: [description] | Actor: [role/department] | System: [tool used or "Manual"] | Duration: [time if mentioned] | Notes: [observations]
Capture the process as it currently operates, not the ideal state.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['process-scope']
    },
    {
      id: 'roles-responsibilities',
      name: 'Roles & Responsibilities',
      prompt: `Document roles using dash bullets:
- Role: [title/department] | Responsibilities: [what they do in process] | Authority: [decisions they can make] | RACI: [Responsible/Accountable/Consulted/Informed]
Clarify who does what and who has decision authority.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'handoffs-decision-points',
      name: 'Handoffs & Decision Points',
      prompt: `Identify critical junctures using dash bullets:
- Type: [Handoff/Decision] | Location: [between which steps] | Participants: [roles involved] | Criteria: [rules for decisions or "Informal"] | Risk: [potential issues]
Focus on points where work transfers between people or decisions branch the process.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['current-state-map', 'roles-responsibilities']
    },
    {
      id: 'metrics-kpis',
      name: 'Metrics & KPIs',
      prompt: `List process metrics using dash bullets:
- Metric: [name] | Current Value: [measurement or "Not tracked"] | Target: [goal or "Not defined"] | Owner: [who tracks it]
Include cycle time, volume, quality, and cost metrics discussed.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'gaps-opportunities',
      name: 'Gaps & Opportunities',
      prompt: `Document improvement opportunities using dash bullets:
- Gap/Opportunity: [issue or improvement] | Type: [Automation/Elimination/Simplification/Integration] | Priority: [High/Medium/Low] | Effort: [estimate or "TBD"]
Capture inefficiencies, redundancies, and improvement ideas identified.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['current-state-map', 'handoffs-decision-points']
    }
  ]
};

/**
 * Built-in template: Process Improvement Review
 */
const PROCESS_IMPROVEMENT_REVIEW_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Process Improvement Review',
  description: 'Review of process improvement initiatives with root cause analysis, proposals, and implementation plans',
  icon: 'TrendingUp',
  category: 'review',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'process-overview',
      name: 'Process Overview',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Process Under Review:" identifying the process and why improvement is needed.
- Paragraph 2 must begin with "Improvement Goals:" stating the desired outcomes and success criteria in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'current-performance',
      name: 'Current Performance',
      prompt: `Document baseline metrics using dash bullets:
- Metric: [name] | Current: [value] | Target: [goal] | Gap: [difference] | Trend: [Improving/Stable/Declining]
Include quantitative measures of current process performance.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'root-cause-analysis',
      name: 'Root Cause Analysis',
      prompt: `Document root causes using dash bullets:
- Problem: [symptom observed] | Root Cause: [underlying reason] | Evidence: [how we know] | Category: [People/Process/Technology/Policy]
Focus on systemic causes rather than symptoms.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['current-performance']
    },
    {
      id: 'proposed-changes',
      name: 'Proposed Changes',
      prompt: `Document recommendations using dash bullets:
- Change: [proposed modification] | Addresses: [root cause it solves] | Type: [Quick Win/Medium/Major] | Owner: [responsible party]
Include both approved and discussed-but-pending proposals.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['root-cause-analysis']
    },
    {
      id: 'impact-assessment',
      name: 'Impact Assessment',
      prompt: `Assess impacts using dash bullets:
- Change: [proposed modification] | Benefit: [expected improvement] | Risk: [potential downside] | Affected Areas: [departments/systems impacted]
Evaluate both positive impacts and implementation risks.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['proposed-changes']
    },
    {
      id: 'implementation-plan',
      name: 'Implementation Plan',
      prompt: `Document implementation steps with checkbox bullets:
- [ ] Action: [task] | Owner: [person/team] | Due: [date/timeframe] | Dependency: [prerequisite or "None"] | Status: [Not Started/In Progress]
Include sequenced actions for implementing approved changes.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['proposed-changes', 'impact-assessment']
    }
  ]
};

/**
 * Built-in template: Workflow Analysis Session
 */
const WORKFLOW_ANALYSIS_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Workflow Analysis Session',
  description: 'Detailed workflow walkthrough capturing steps, decision logic, exceptions, and automation opportunities',
  icon: 'Workflow',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'quotes'],
  sections: [
    {
      id: 'workflow-context',
      name: 'Workflow Context',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Workflow Purpose:" describing what this workflow accomplishes and its business value.
- Paragraph 2 must begin with "Analysis Scope:" clarifying what aspects are being examined and why in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'step-by-step-walkthrough',
      name: 'Step-by-Step Walkthrough',
      prompt: `Document workflow steps using dash bullets:
- Step: [number] | Name: [activity name] | Description: [what happens] | Performer: [role] | Time: [duration if mentioned] | Input/Output: [data flow]
Capture each step in execution order with sufficient detail.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['workflow-context']
    },
    {
      id: 'decision-logic',
      name: 'Decision Logic',
      prompt: `Document decision points using dash bullets:
- Decision: [what's being decided] | Location: [after which step] | Criteria: [rules/conditions] | Outcomes: [possible paths] | Authority: [who decides]
Capture business rules and branching logic.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['step-by-step-walkthrough']
    },
    {
      id: 'exceptions-edge-cases',
      name: 'Exceptions & Edge Cases',
      prompt: `Document exceptions using dash bullets:
- Exception: [scenario] | Frequency: [how often] | Handling: [current approach] | Pain Level: [High/Medium/Low] | Improvement: [suggested fix or "None"]
Capture non-standard paths and how they're handled.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['step-by-step-walkthrough', 'decision-logic']
    },
    {
      id: 'automation-opportunities',
      name: 'Automation Opportunities',
      prompt: `Identify automation candidates using dash bullets:
- Opportunity: [what could be automated] | Current Effort: [manual time spent] | Automation Type: [RPA/Integration/AI/Rule-based] | Complexity: [High/Medium/Low] | ROI: [expected value]
Focus on repetitive, rule-based, or high-volume activities.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['step-by-step-walkthrough']
    },
    {
      id: 'documentation-needs',
      name: 'Documentation Needs',
      prompt: `List documentation gaps using dash bullets:
- Gap: [what's missing] | Type: [SOP/Training/Reference/System doc] | Priority: [High/Medium/Low] | Owner: [who should create it]
Include missing procedures, outdated docs, and tribal knowledge that needs capturing.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    }
  ]
};

// =============================================================================
// NEW TEMPLATES - Software & Product
// =============================================================================

/**
 * Built-in template: Software Evaluation Interview
 */
const SOFTWARE_EVALUATION_INTERVIEW_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Software Evaluation Interview',
  description: 'Stakeholder interview about software usage, satisfaction, pain points, and improvement needs',
  icon: 'Monitor',
  category: 'interview',
  isCustom: false,
  outputs: ['summary', 'action_items', 'quotes'],
  sections: [
    {
      id: 'application-context',
      name: 'Application Context',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Application:" identifying the software name, vendor (if external), and primary purpose.
- Paragraph 2 must begin with "User Base:" describing who uses it, how many users, and their roles in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'business-criticality',
      name: 'Business Criticality',
      prompt: `Document criticality using dash bullets:
- Function: [business capability supported] | Criticality: [Mission Critical/Important/Nice to Have] | Downtime Impact: [effect of outage] | Alternatives: [backup options or "None"]
Assess how important this software is to operations.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'current-usage-patterns',
      name: 'Current Usage Patterns',
      prompt: `Document usage using dash bullets:
- Use Case: [how it's used] | Frequency: [Daily/Weekly/Monthly/Ad-hoc] | Users: [who does this] | Volume: [transactions/records if mentioned]
Capture the main ways stakeholders interact with the software.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'strengths-satisfaction',
      name: 'Strengths & Satisfaction',
      prompt: `Document positives using dash bullets:
- Strength: [what works well] | Benefit: [value it provides] | User Sentiment: [specific feedback or "General satisfaction"]
Include features, performance, and capabilities users appreciate.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'pain-points-limitations',
      name: 'Pain Points & Limitations',
      prompt: `Document problems using dash bullets:
- Pain Point: [issue] | Impact: [effect on work] | Frequency: [how often encountered] | Workaround: [current solution or "None"] | Severity: [High/Medium/Low]
Capture bugs, missing features, performance issues, and usability problems.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'feature-requests',
      name: 'Feature Requests',
      prompt: `Document requested improvements using dash bullets:
- Request: [feature or enhancement] | Use Case: [why it's needed] | Priority: [Must Have/Should Have/Nice to Have] | Business Value: [expected benefit]
Include both explicit requests and implied needs.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['pain-points-limitations']
    },
    {
      id: 'integration-needs',
      name: 'Integration Needs',
      prompt: `Document integration requirements using dash bullets:
- Integration: [system to connect with] | Data Flow: [what data needs to move] | Current State: [Manual/Partial/None] | Priority: [High/Medium/Low]
Capture connections with other systems and data exchange needs.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'support-vendor-experience',
      name: 'Support & Vendor Experience',
      prompt: `Document support experience using dash bullets:
- Aspect: [support area] | Rating: [Excellent/Good/Fair/Poor] | Feedback: [specific comment] | Improvement Needed: [suggestion or "None"]
Include vendor responsiveness, documentation quality, and training support.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Product Concept Workshop
 */
const PRODUCT_CONCEPT_WORKSHOP_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Product Concept Workshop',
  description: 'Workshop exploring product ideas with problem definition, users, feasibility, and next steps',
  icon: 'Lightbulb',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'problem-statement',
      name: 'Problem Statement',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Problem:" clearly articulating the problem or opportunity being addressed.
- Paragraph 2 must begin with "Impact:" describing who is affected and the consequences of not solving it in <=70 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'paragraph'
    },
    {
      id: 'target-users',
      name: 'Target Users',
      prompt: `Document target users using dash bullets:
- User Segment: [persona or group] | Size: [estimate if known] | Current Behavior: [how they solve problem today] | Adoption Likelihood: [High/Medium/Low]
Identify who would benefit from this product concept.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'concept-overview',
      name: 'Concept Overview',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Solution Concept:" describing the proposed product or feature at a high level.
- Paragraph 2 must begin with "Key Capabilities:" listing the core functionality that addresses the problem in <=70 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'paragraph',
      dependencies: ['problem-statement', 'target-users']
    },
    {
      id: 'value-proposition',
      name: 'Value Proposition',
      prompt: `Document value using dash bullets:
- Benefit: [value delivered] | For: [user segment] | Differentiation: [why better than alternatives] | Evidence: [data or assumption]
Capture why users would adopt this solution.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['concept-overview']
    },
    {
      id: 'competitive-landscape',
      name: 'Competitive Landscape',
      prompt: `Document alternatives using dash bullets:
- Alternative: [competing solution] | Type: [Direct/Indirect/Status Quo] | Strengths: [what it does well] | Weaknesses: [limitations] | Our Advantage: [differentiation]
Include existing solutions users might use instead.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'feasibility-assessment',
      name: 'Feasibility Assessment',
      prompt: `Assess feasibility using dash bullets:
- Dimension: [Technical/Resource/Time/Budget/Organizational] | Assessment: [feasible/challenging/uncertain] | Key Constraint: [main limitation] | Mitigation: [approach or "Needs investigation"]
Evaluate what's required to build this concept.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'open-questions',
      name: 'Open Questions',
      prompt: `List unknowns using dash bullets:
- Question: [what we need to learn] | Category: [User/Technical/Business/Market] | Priority: [High/Medium/Low] | Research Method: [how to answer it]
Capture uncertainties that need investigation.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['concept-overview', 'feasibility-assessment']
    },
    {
      id: 'next-steps',
      name: 'Next Steps',
      prompt: `Document follow-ups with checkbox bullets:
- [ ] Action: [validation activity] | Owner: [person] | Due: [timeframe] | Output: [expected deliverable]
Include research, prototyping, and decision checkpoints.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['open-questions']
    }
  ]
};

/**
 * Built-in template: Requirements Gathering Session
 */
const REQUIREMENTS_GATHERING_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Requirements Gathering Session',
  description: 'Requirements elicitation with functional and non-functional requirements, user stories, and priorities',
  icon: 'ClipboardList',
  category: 'interview',
  isCustom: false,
  outputs: ['summary', 'action_items', 'quotes'],
  sections: [
    {
      id: 'business-context',
      name: 'Business Context',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Initiative:" describing the project or feature being scoped and its business driver.
- Paragraph 2 must begin with "Stakeholders:" identifying key stakeholders and their interests in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'functional-requirements',
      name: 'Functional Requirements',
      prompt: `Document functional requirements using dash bullets:
- Requirement: [capability] | Category: [feature area] | Priority: [Must/Should/Could/Won't] | Rationale: [why needed]
Capture what the system must do to meet business needs.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'non-functional-requirements',
      name: 'Non-Functional Requirements',
      prompt: `Document non-functional requirements using dash bullets:
- Requirement: [quality attribute] | Category: [Performance/Security/Usability/Scalability/Compliance] | Target: [specific metric or standard] | Priority: [Critical/Important/Desired]
Capture how the system should perform.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'user-stories',
      name: 'User Stories',
      prompt: `Document user stories using dash bullets:
- Story: "As a [user], I want [capability] so that [benefit]" | Priority: [High/Medium/Low] | Size: [Small/Medium/Large or points] | Dependencies: [related stories or "None"]
Capture user-centered requirements in story format.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['functional-requirements']
    },
    {
      id: 'acceptance-criteria',
      name: 'Acceptance Criteria',
      prompt: `Document acceptance criteria using dash bullets:
- Story/Requirement: [reference] | Criterion: [specific testable condition] | Type: [Given-When-Then/Checklist/Metric]
Define how we'll know requirements are met.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['user-stories']
    },
    {
      id: 'constraints-assumptions',
      name: 'Constraints & Assumptions',
      prompt: `Document constraints and assumptions using dash bullets:
- Type: [Constraint/Assumption] | Description: [detail] | Impact: [effect on solution] | Risk if Wrong: [consequence]
Capture limitations and things taken as given.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'priority-ranking',
      name: 'Priority Ranking',
      prompt: `Summarize priorities using dash bullets:
- Priority Tier: [Must Have/Should Have/Could Have/Won't Have] | Items: [list of requirements in this tier] | Rationale: [why this prioritization]
Provide MoSCoW or similar prioritization summary.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['functional-requirements', 'user-stories']
    }
  ]
};

/**
 * Built-in template: User Research Interview
 */
const USER_RESEARCH_INTERVIEW_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'User Research Interview',
  description: 'User interview capturing workflows, goals, pain points, mental models, and unmet needs',
  icon: 'UserSearch',
  category: 'interview',
  isCustom: false,
  outputs: ['summary', 'quotes'],
  sections: [
    {
      id: 'participant-profile',
      name: 'Participant Profile',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Demographics:" describing role, experience level, and relevant background (anonymized as appropriate).
- Paragraph 2 must begin with "Context:" explaining their relationship to the product/domain being researched in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'current-workflow',
      name: 'Current Workflow',
      prompt: `Document their current process using dash bullets:
- Activity: [what they do] | Frequency: [how often] | Tools: [what they use] | Time: [duration if mentioned] | Satisfaction: [rating or sentiment]
Capture how they accomplish tasks today.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'goals-motivations',
      name: 'Goals & Motivations',
      prompt: `Document goals using dash bullets:
- Goal: [what they're trying to achieve] | Motivation: [underlying reason] | Priority: [High/Medium/Low] | Measure of Success: [how they'd know they achieved it]
Capture both explicit goals and underlying motivations.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'pain-points',
      name: 'Pain Points',
      prompt: `Document frustrations using dash bullets:
- Pain Point: [frustration] | Context: [when it occurs] | Impact: [effect on them] | Coping Strategy: [how they deal with it] | Severity: [High/Medium/Low]
Capture problems, annoyances, and obstacles they face.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'mental-models',
      name: 'Mental Models',
      prompt: `Document mental models using dash bullets:
- Concept: [how they think about something] | Language: [terms they use] | Expectation: [what they assume should happen] | Misconception: [incorrect belief if any]
Capture how they conceptualize the domain.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'feature-reactions',
      name: 'Feature Reactions',
      prompt: `Document reactions to concepts shown using dash bullets:
- Feature/Concept: [what was shown] | Reaction: [their response] | Appeal: [High/Medium/Low] | Concerns: [hesitations or "None"] | Quote: "[notable comment]"
Capture responses to prototypes, mockups, or feature descriptions.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'unmet-needs',
      name: 'Unmet Needs',
      prompt: `Document unmet needs using dash bullets:
- Need: [what they wish they could do] | Current Gap: [what's missing] | Impact of Gap: [consequence] | Ideal Solution: [their vision if stated]
Capture opportunities for improvement they mentioned.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['pain-points', 'goals-motivations']
    }
  ]
};

// =============================================================================
// NEW TEMPLATES - Training & Knowledge Transfer
// =============================================================================

/**
 * Built-in template: Training Session Notes
 */
const TRAINING_SESSION_NOTES_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Training Session Notes',
  description: 'Training session capture with concepts, procedures, examples, Q&A, and practice exercises',
  icon: 'GraduationCap',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items'],
  sections: [
    {
      id: 'training-overview',
      name: 'Training Overview',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Topic:" identifying the training subject, instructor(s), and learning objectives.
- Paragraph 2 must begin with "Audience:" describing attendees, their roles, and prerequisite knowledge assumed in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'key-concepts-taught',
      name: 'Key Concepts Taught',
      prompt: `Document key concepts using dash bullets:
- Concept: [topic/term] | Definition: [explanation] | Importance: [why it matters] | Application: [how to use it]
Capture the main learning points covered.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'procedures-demonstrated',
      name: 'Procedures Demonstrated',
      prompt: `Document procedures using dash bullets:
- Procedure: [name] | Steps: [high-level sequence] | Tips: [instructor advice] | Common Mistakes: [pitfalls mentioned]
Capture step-by-step processes that were taught.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'examples-scenarios',
      name: 'Examples & Scenarios',
      prompt: `Document examples using dash bullets:
- Example: [case or scenario] | Concept Illustrated: [what it teaches] | Key Takeaway: [main lesson] | Variation: [related scenarios mentioned]
Capture case studies, demonstrations, and illustrative scenarios.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['key-concepts-taught']
    },
    {
      id: 'qa-highlights',
      name: 'Q&A Highlights',
      prompt: `Document Q&A using dash bullets:
- Question: [what was asked] | Asker: [role or "Attendee"] | Answer: [response summary] | Follow-up Needed: [Yes/No]
Capture important questions and answers from the session.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'resources-references',
      name: 'Resources & References',
      prompt: `List resources using dash bullets:
- Resource: [name] | Type: [Document/Video/Tool/Website] | Location: [where to find it] | Use: [what it's for]
Include materials, documentation, and references mentioned.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    },
    {
      id: 'practice-exercises',
      name: 'Practice Exercises',
      prompt: `Document exercises using dash bullets:
- Exercise: [activity name] | Objective: [learning goal] | Instructions: [what to do] | Completion: [done in session or "Homework"]
Capture hands-on activities and practice assignments.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    }
  ]
};

/**
 * Built-in template: Knowledge Transfer Session
 */
const KNOWLEDGE_TRANSFER_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Knowledge Transfer Session',
  description: 'Knowledge transfer with subject overview, processes, tribal knowledge, and documentation gaps',
  icon: 'Share2',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'quotes'],
  sections: [
    {
      id: 'transfer-context',
      name: 'Transfer Context',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Knowledge Area:" describing what knowledge is being transferred and why.
- Paragraph 2 must begin with "Participants:" identifying the knowledge source (outgoing/expert) and recipients in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'subject-matter-overview',
      name: 'Subject Matter Overview',
      prompt: `Document the domain using dash bullets:
- Topic: [knowledge area] | Scope: [what it covers] | Importance: [why it matters] | Dependencies: [related knowledge needed]
Provide a high-level map of the knowledge being transferred.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'key-processes',
      name: 'Key Processes',
      prompt: `Document critical processes using dash bullets:
- Process: [name] | Purpose: [what it accomplishes] | Frequency: [how often done] | Steps: [high-level flow] | Owner: [who should know this]
Capture essential procedures that must be transferred.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'tribal-knowledge',
      name: 'Tribal Knowledge',
      prompt: `Document undocumented insights using dash bullets:
- Insight: [knowledge shared] | Context: [when it applies] | Source: [how it was learned] | Risk if Lost: [consequence of not capturing]
Capture tips, tricks, history, and unwritten rules.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'systems-access',
      name: 'Systems Access',
      prompt: `Document access needs using dash bullets:
- System: [name] | Access Level: [what's needed] | Current Status: [who has access] | Action: [what to do for transfer]
Identify accounts, permissions, and credentials to transfer.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    },
    {
      id: 'documentation-gaps',
      name: 'Documentation Gaps',
      prompt: `Identify missing documentation using dash bullets:
- Gap: [what's undocumented] | Type: [SOP/Guide/Reference/Training] | Priority: [Critical/High/Medium/Low] | Effort: [estimate to create]
Capture documentation that needs to be created.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points',
      dependencies: ['key-processes', 'tribal-knowledge']
    },
    {
      id: 'follow-up-training',
      name: 'Follow-up Training',
      prompt: `Document additional training needs with checkbox bullets:
- [ ] Topic: [what else to cover] | Format: [Session/Shadowing/Self-study] | Timing: [when] | Owner: [who will provide]
Identify remaining knowledge gaps to address.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    }
  ]
};

// =============================================================================
// NEW TEMPLATES - Planning & Strategy
// =============================================================================

/**
 * Built-in template: Strategic Planning Workshop
 */
const STRATEGIC_PLANNING_WORKSHOP_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Strategic Planning Workshop',
  description: 'Strategic planning with vision, SWOT analysis, initiatives, resources, and implementation roadmap',
  icon: 'Target',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'current-state-assessment',
      name: 'Current State Assessment',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Current Position:" summarizing where the organization/team stands today.
- Paragraph 2 must begin with "Key Challenges:" outlining the main obstacles and pressures being faced in <=70 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'paragraph'
    },
    {
      id: 'vision-goals',
      name: 'Vision & Goals',
      prompt: `Document vision and goals using dash bullets:
- Type: [Vision/Goal/Objective] | Statement: [the aspiration] | Timeframe: [horizon] | Measure: [how success is defined]
Capture the desired future state and strategic goals.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'strategic-options',
      name: 'Strategic Options',
      prompt: `Document options considered using dash bullets:
- Option: [strategic approach] | Pros: [advantages] | Cons: [disadvantages] | Recommendation: [Pursue/Consider/Reject]
Include different approaches discussed, not just the chosen one.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'swot-analysis',
      name: 'SWOT Analysis',
      prompt: `Document SWOT using dash bullets:
- Category: [Strength/Weakness/Opportunity/Threat] | Item: [specific factor] | Impact: [significance] | Strategy: [how to leverage or address]
Capture internal and external factors discussed.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['current-state-assessment']
    },
    {
      id: 'prioritized-initiatives',
      name: 'Prioritized Initiatives',
      prompt: `Document initiatives using dash bullets:
- Initiative: [strategic action] | Goal Supported: [which goal] | Priority: [1/2/3 or High/Medium/Low] | Owner: [accountable party] | Horizon: [timeline]
List strategic initiatives in priority order.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['vision-goals', 'swot-analysis']
    },
    {
      id: 'resource-allocation',
      name: 'Resource Allocation',
      prompt: `Document resource decisions using dash bullets:
- Resource: [budget/people/technology] | Allocation: [where it goes] | Amount: [quantity or %] | Rationale: [why this allocation]
Capture how resources will be deployed to support strategy.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['prioritized-initiatives']
    },
    {
      id: 'success-metrics',
      name: 'Success Metrics',
      prompt: `Document KPIs using dash bullets:
- Metric: [measure] | Target: [goal value] | Baseline: [current value or "TBD"] | Frequency: [how often measured] | Owner: [who tracks it]
Define how strategic progress will be measured.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['vision-goals']
    },
    {
      id: 'implementation-roadmap',
      name: 'Implementation Roadmap',
      prompt: `Document roadmap with checkbox bullets:
- [ ] Milestone: [deliverable] | Initiative: [which strategic initiative] | Target: [date/quarter] | Dependencies: [prerequisites] | Owner: [responsible party]
Outline the timeline for executing the strategy.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['prioritized-initiatives']
    }
  ]
};

/**
 * Built-in template: Brainstorming Session
 */
const BRAINSTORMING_SESSION_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Brainstorming Session',
  description: 'Brainstorming session capturing ideas, themes, top candidates, and validation next steps',
  icon: 'Sparkles',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items'],
  sections: [
    {
      id: 'session-focus',
      name: 'Session Focus',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Challenge:" clearly stating the problem or opportunity being explored.
- Paragraph 2 must begin with "Constraints:" noting any boundaries, requirements, or assumptions in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'ideas-generated',
      name: 'Ideas Generated',
      prompt: `Document all ideas using dash bullets:
- Idea: [concept] | Proposer: [person or "Group"] | Description: [brief explanation in <=20 words]
Capture all ideas proposed without filtering. Aim to document every concept mentioned.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    },
    {
      id: 'idea-categories',
      name: 'Idea Categories',
      prompt: `Group ideas into themes using dash bullets:
- Category: [theme name] | Ideas: [list of related ideas] | Common Thread: [what unifies them]
Cluster related ideas to identify patterns.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points',
      dependencies: ['ideas-generated']
    },
    {
      id: 'top-candidates',
      name: 'Top Candidates',
      prompt: `Document highest-potential ideas using dash bullets:
- Idea: [concept] | Why Selected: [strengths] | Potential Impact: [expected benefit] | Feasibility: [High/Medium/Low] | Votes/Support: [if voting occurred]
Highlight the most promising ideas from the session.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['ideas-generated']
    },
    {
      id: 'feasibility-notes',
      name: 'Feasibility Notes',
      prompt: `Document feasibility considerations using dash bullets:
- Idea: [concept] | Challenge: [feasibility concern] | Requirement: [what would be needed] | Unknown: [what we don't know yet]
Capture practical considerations discussed.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['top-candidates']
    },
    {
      id: 'next-steps',
      name: 'Next Steps',
      prompt: `Document follow-up actions with checkbox bullets:
- [ ] Action: [task] | Idea: [which concept it supports] | Owner: [person] | Due: [timeframe] | Output: [expected deliverable]
Include research, validation, and development tasks.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points',
      dependencies: ['top-candidates']
    }
  ]
};

/**
 * Built-in template: Roadmap Planning Meeting
 */
const ROADMAP_PLANNING_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Roadmap Planning Meeting',
  description: 'Roadmap planning with priorities, sequencing, dependencies, and stakeholder commitments',
  icon: 'Map',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'planning-horizon',
      name: 'Planning Horizon',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Timeframe:" specifying the planning period (e.g., Q1-Q4, 6 months, annual).
- Paragraph 2 must begin with "Context:" summarizing factors influencing this roadmap (budget cycle, market conditions, etc.) in <=60 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'strategic-priorities',
      name: 'Strategic Priorities',
      prompt: `Document guiding priorities using dash bullets:
- Priority: [strategic objective] | Weight: [relative importance] | Rationale: [why this priority] | Sponsor: [executive owner]
Capture the strategic lens through which roadmap decisions are made.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'feature-initiative-candidates',
      name: 'Feature/Initiative Candidates',
      prompt: `Document roadmap candidates using dash bullets:
- Item: [feature/initiative] | Type: [Feature/Improvement/Technical Debt/Infrastructure] | Value: [business benefit] | Effort: [T-shirt size or estimate] | Requester: [stakeholder]
List all items considered for the roadmap.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'sequencing-decisions',
      name: 'Sequencing Decisions',
      prompt: `Document timing decisions using dash bullets:
- Item: [feature/initiative] | Timing: [quarter/sprint/month] | Rationale: [why this timing] | Trade-off: [what it was prioritized over]
Capture what goes when and why.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['feature-initiative-candidates', 'strategic-priorities']
    },
    {
      id: 'dependencies-constraints',
      name: 'Dependencies & Constraints',
      prompt: `Document limitations using dash bullets:
- Constraint: [limitation] | Type: [Resource/Technical/External/Timing] | Impact: [what it affects] | Mitigation: [how to address]
Capture factors limiting roadmap options.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'resource-considerations',
      name: 'Resource Considerations',
      prompt: `Document resource impacts using dash bullets:
- Resource: [team/budget/tool] | Capacity: [availability] | Roadmap Impact: [what it enables or limits] | Gap: [shortfall if any]
Assess resource implications of roadmap decisions.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['sequencing-decisions']
    },
    {
      id: 'stakeholder-commitments',
      name: 'Stakeholder Commitments',
      prompt: `Document commitments using dash bullets:
- Stakeholder: [person/team] | Commitment: [what was agreed] | Deliverable: [specific item] | Timeline: [when] | Contingency: [conditions if any]
Capture agreements made about roadmap items.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['sequencing-decisions']
    }
  ]
};

// =============================================================================
// NEW TEMPLATES - Executive & Tiered Formats
// =============================================================================

/**
 * Built-in template: Council/City Manager Briefing
 */
const COUNCIL_CITY_MANAGER_BRIEFING_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Council/City Manager Briefing',
  description: 'Executive briefing for council and city manager with policy implications and strategic decisions',
  icon: 'Building2',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'decisions'],
  sections: [
    {
      id: 'executive-summary',
      name: 'Executive Summary',
      prompt: `Provide 3-5 sentences capturing the essential information an executive needs:
Begin with "Summary:" and include the meeting purpose, key outcomes, and most important decision or issue requiring attention. Keep under 100 words and focus on strategic significance.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'policy-implications',
      name: 'Policy Implications',
      prompt: `Document policy impacts using dash bullets:
- Policy Area: [domain affected] | Implication: [how policy is impacted] | Action Needed: [legislative/administrative action or "Informational only"] | Timeline: [urgency]
Focus on items that affect city policy or direction.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'key-decisions-required',
      name: 'Key Decisions Required',
      prompt: `Document decisions needing executive action using dash bullets:
- Decision: [what needs to be decided] | Options: [choices available] | Recommendation: [staff recommendation] | Deadline: [when decision needed] | Impact: [consequence of delay]
Focus on items requiring council or city manager authorization.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'budget-resource-impact',
      name: 'Budget/Resource Impact',
      prompt: `Document financial implications using dash bullets:
- Item: [expenditure or resource] | Amount: [$ or FTE] | Source: [fund/budget line] | Timing: [when needed] | Approval Required: [Yes/No and level]
Include both immediate and long-term financial impacts.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'community-impact',
      name: 'Community Impact',
      prompt: `Document constituent considerations using dash bullets:
- Stakeholder: [community group] | Impact: [how they're affected] | Sentiment: [expected reaction] | Communication: [outreach needed or "None"]
Highlight impacts on residents, businesses, and community groups.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'recommended-actions',
      name: 'Recommended Actions',
      prompt: `Document recommended executive actions using dash bullets:
- Action: [what leadership should do] | Rationale: [why recommended] | Timeline: [when] | Owner: [responsible department]
Provide clear, actionable recommendations for leadership.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['key-decisions-required', 'budget-resource-impact']
    }
  ]
};

/**
 * Built-in template: ELT/Department Leadership Briefing
 */
const ELT_DEPARTMENT_BRIEFING_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'ELT/Department Leadership Briefing',
  description: 'Leadership briefing with department updates, cross-functional issues, and operational decisions',
  icon: 'Briefcase',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items', 'decisions'],
  sections: [
    {
      id: 'briefing-overview',
      name: 'Briefing Overview',
      prompt: `Provide two paragraphs:
- Paragraph 1 must begin with "Purpose:" stating the briefing objective and key topics covered.
- Paragraph 2 must begin with "Attendees:" listing leadership present and their departments in <=50 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'department-updates',
      name: 'Department Updates',
      prompt: `Document department status using dash bullets:
- Department: [name] | Presenter: [person] | Key Update: [main point] | Status: [Green/Yellow/Red] | Support Needed: [request or "None"]
Summarize each department's status report.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'cross-functional-issues',
      name: 'Cross-Functional Issues',
      prompt: `Document cross-departmental items using dash bullets:
- Issue: [problem or opportunity] | Departments Involved: [list] | Status: [current state] | Resolution Path: [approach] | Owner: [lead department]
Capture items spanning multiple departments.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'resource-requests',
      name: 'Resource Requests',
      prompt: `Document resource asks using dash bullets:
- Request: [what's needed] | Requesting Dept: [who] | Amount: [quantity/$] | Justification: [why needed] | Decision: [Approved/Pending/Denied]
Include budget, staffing, and equipment requests.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'decisions-made',
      name: 'Decisions Made',
      prompt: `Document leadership decisions using dash bullets:
- Decision: [what was decided] | Owner: [accountable party] | Timeline: [implementation date] | Communication: [who needs to know]
Capture operational decisions finalized at this level.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'elt-action-items',
      name: 'Action Items',
      prompt: `Document follow-up tasks with checkbox bullets:
- [ ] Action: [task] | Owner: [department/person] | Due: [date] | Escalate To: [if needed or "N/A"]
Track commitments made during the briefing.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points',
      dependencies: ['decisions-made', 'cross-functional-issues']
    }
  ]
};

/**
 * Built-in template: Staff Meeting Summary
 */
const STAFF_MEETING_SUMMARY_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Staff Meeting Summary',
  description: 'Team/staff meeting summary with announcements, discussions, updates, and action items',
  icon: 'Users',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items'],
  sections: [
    {
      id: 'meeting-overview',
      name: 'Meeting Overview',
      prompt: `Provide two sentences:
- Sentence 1 begins with "Purpose:" stating why the meeting was held.
- Sentence 2 begins with "Attendance:" noting who participated in <=30 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'announcements',
      name: 'Announcements',
      prompt: `Document announcements using dash bullets:
- Announcement: [information shared] | Source: [who announced] | Effective: [when applicable] | Action Required: [what staff should do or "Informational"]
Capture organizational updates and news.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    },
    {
      id: 'discussion-topics',
      name: 'Discussion Topics',
      prompt: `Document discussions using dash bullets:
- Topic: [subject discussed] | Key Points: [main takeaways] | Outcome: [conclusion reached or "Ongoing"] | Follow-up: [next step if any]
Summarize substantive conversations.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'team-updates',
      name: 'Team Updates',
      prompt: `Document team member updates using dash bullets:
- Person: [name] | Update: [what they shared] | Help Needed: [request or "None"]
Keep updates brief and action-focused.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'bullet_points'
    },
    {
      id: 'staff-action-items',
      name: 'Action Items',
      prompt: `Document tasks with checkbox bullets:
- [ ] Task: [what needs to be done] | Owner: [person] | Due: [date/timeframe] | Status: [New/Carry-over]
Track commitments and follow-ups from the meeting.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'next-steps',
      name: 'Next Steps',
      prompt: `Provide two sentences:
- Sentence 1 begins with "Next Meeting:" noting when the team will reconvene.
- Sentence 2 begins with "Focus:" identifying key priorities before next meeting in <=30 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    }
  ]
};

/**
 * Built-in template: Quick Meeting Summary
 */
const QUICK_MEETING_SUMMARY_TEMPLATE: Omit<Template, 'id' | 'createdAt'> = {
  name: 'Quick Meeting Summary',
  description: 'Concise meeting summary for short meetings with purpose, key points, decisions, and actions',
  icon: 'Zap',
  category: 'meeting',
  isCustom: false,
  outputs: ['summary', 'action_items'],
  sections: [
    {
      id: 'meeting-purpose',
      name: 'Meeting Purpose',
      prompt: `Provide 1-2 sentences beginning with "Purpose:" explaining why the meeting was held and what it aimed to accomplish. Keep under 40 words.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    },
    {
      id: 'key-points',
      name: 'Key Points',
      prompt: `Document 3-5 main takeaways using dash bullets:
- Point: [key information or discussion outcome]
Keep each bullet concise and impactful. Focus on what attendees need to remember.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'decisions',
      name: 'Decisions',
      prompt: `Document decisions using dash bullets:
- Decision: [what was decided] | Owner: [who's responsible] | Effective: [when]
Only include concrete decisions made. If no decisions, state "No formal decisions made."

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'action-items',
      name: 'Action Items',
      prompt: `Document actions with checkbox bullets:
- [ ] Action: [task] | Owner: [person] | Due: [date/timeframe]
Keep focused on concrete, trackable commitments.

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: true,
      outputFormat: 'bullet_points'
    },
    {
      id: 'next-meeting',
      name: 'Next Meeting',
      prompt: `If a follow-up was scheduled, provide one sentence beginning with "Next Meeting:" noting the date/time and focus. If no follow-up, state "No follow-up meeting scheduled."

If this topic was not discussed in the meeting, output: "Not applicable to this meeting."`,
      extractEvidence: false,
      outputFormat: 'paragraph'
    }
  ]
};

/**
 * All built-in templates
 */
const BUILT_IN_TEMPLATES = [
  // Original 16 templates
  MEETING_MINUTES_TEMPLATE,
  STAKEHOLDER_INTERVIEW_TEMPLATE,
  PROJECT_STATUS_REVIEW_TEMPLATE,
  ONE_ON_ONE_TEMPLATE,
  CLIENT_DISCOVERY_TEMPLATE,
  RETROSPECTIVE_TEMPLATE,
  LEGISLATIVE_BODY_BRIEFING_TEMPLATE,
  CAPITAL_PROJECT_COORDINATION_TEMPLATE,
  PUBLIC_SAFETY_INCIDENT_REVIEW_TEMPLATE,
  COMMUNITY_ENGAGEMENT_SESSION_TEMPLATE,
  BUDGET_PLANNING_WORKSHOP_TEMPLATE,
  REGULATORY_COMPLIANCE_HEARING_TEMPLATE,
  EMERGENCY_OPERATIONS_BRIEFING_TEMPLATE,
  FIELD_OPERATIONS_STANDUP_TEMPLATE,
  CASE_MANAGEMENT_CONFERENCE_TEMPLATE,
  COMMUNITY_PROGRAM_REVIEW_TEMPLATE,
  // New Agile/Project Management templates (5)
  SPRINT_PLANNING_TEMPLATE,
  SPRINT_REVIEW_TEMPLATE,
  DAILY_STANDUP_TEMPLATE,
  RELEASE_PLANNING_TEMPLATE,
  SCRUM_OF_SCRUMS_TEMPLATE,
  // New Process Mapping & Improvement templates (4)
  PROCESS_DISCOVERY_INTERVIEW_TEMPLATE,
  PROCESS_MAPPING_WORKSHOP_TEMPLATE,
  PROCESS_IMPROVEMENT_REVIEW_TEMPLATE,
  WORKFLOW_ANALYSIS_TEMPLATE,
  // New Software & Product templates (4)
  SOFTWARE_EVALUATION_INTERVIEW_TEMPLATE,
  PRODUCT_CONCEPT_WORKSHOP_TEMPLATE,
  REQUIREMENTS_GATHERING_TEMPLATE,
  USER_RESEARCH_INTERVIEW_TEMPLATE,
  // New Training & Knowledge Transfer templates (2)
  TRAINING_SESSION_NOTES_TEMPLATE,
  KNOWLEDGE_TRANSFER_TEMPLATE,
  // New Planning & Strategy templates (3)
  STRATEGIC_PLANNING_WORKSHOP_TEMPLATE,
  BRAINSTORMING_SESSION_TEMPLATE,
  ROADMAP_PLANNING_TEMPLATE,
  // New Executive & Tiered Format templates (4)
  COUNCIL_CITY_MANAGER_BRIEFING_TEMPLATE,
  ELT_DEPARTMENT_BRIEFING_TEMPLATE,
  STAFF_MEETING_SUMMARY_TEMPLATE,
  QUICK_MEETING_SUMMARY_TEMPLATE,
];

/**
 * Checks if default templates have already been seeded
 */
function isAlreadySeeded(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    return localStorage.getItem(SEEDING_STATUS_KEY) === 'true';
  } catch (error) {
    console.error('Error checking seeding status:', error);
    return false;
  }
}

/**
 * Marks templates as seeded in localStorage
 */
function markAsSeeded(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(SEEDING_STATUS_KEY, 'true');
  } catch (error) {
    console.error('Error marking templates as seeded:', error);
  }
}

/**
 * Seeds default templates into IndexedDB if not already seeded.
 *
 * This function:
 * 1. Checks if templates have already been seeded
 * 2. If not, creates complete Template objects with IDs and timestamps
 * 3. Saves each template to IndexedDB
 * 4. Marks seeding as complete to prevent duplicate seeding
 *
 * Safe to call multiple times - will only seed once.
 *
 * @returns Promise<void>
 * @throws Error if seeding fails
 */
export async function seedDefaultTemplates(): Promise<void> {
  // Dexie isn't available server-side, so skip silently
  if (typeof window === 'undefined') {
    return;
  }

  const previouslySeeded = isAlreadySeeded();

  try {
    const db = getDatabase();
    const now = new Date();

    // Load existing templates once so we can reconcile without duplicates
    const existingTemplates = await db.templates.toArray();
    const existingBuiltInNames = new Set(
      existingTemplates.filter(template => !template.isCustom).map(template => template.name)
    );

    const missingTemplatesInput = BUILT_IN_TEMPLATES.filter(
      template => !existingBuiltInNames.has(template.name)
    );

    if (missingTemplatesInput.length === 0) {
      if (!previouslySeeded) {
        markAsSeeded();
      }
      console.log('[Templates] All built-in templates already present; no seeding required.');
      return;
    }

    console.log('[Templates] Seeding missing built-in templates...', {
      missing: missingTemplatesInput.map(template => template.name),
    });

    const templatesToInsert: Template[] = missingTemplatesInput.map(template => ({
      ...template,
      id: uuidv4(),
      createdAt: now,
    }));

    await Promise.all(templatesToInsert.map(template => db.templates.put(template)));

    markAsSeeded();

    console.log(`[Templates] Seeded ${templatesToInsert.length} built-in template(s).`);
  } catch (error) {
    console.error('Error seeding default templates:', error);
    throw new Error(
      `Failed to seed default templates: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Resets the seeding status and clears all built-in templates.
 * Useful for development and testing.
 *
 * WARNING: This will delete all built-in templates from the database!
 *
 * @returns Promise<void>
 */
export async function resetDefaultTemplates(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = getDatabase();

    // Delete all built-in templates
    const allTemplates = await db.templates.toArray();
    const builtInTemplateIds = allTemplates
      .filter(template => !template.isCustom)
      .map(template => template.id);

    await Promise.all(
      builtInTemplateIds.map(id => db.templates.delete(id))
    );

    // Reset seeding status
    localStorage.removeItem(SEEDING_STATUS_KEY);

    console.log('Default templates reset successfully');
  } catch (error) {
    console.error('Error resetting default templates:', error);
    throw new Error(
      `Failed to reset default templates: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Gets the count of built-in templates currently in the database
 */
export async function getBuiltInTemplateCount(): Promise<number> {
  try {
    const db = getDatabase();
    const allTemplates = await db.templates.toArray();
    return allTemplates.filter(template => !template.isCustom).length;
  } catch (error) {
    console.error('Error getting built-in template count:', error);
    return 0;
  }
}

/**
 * Export template constants for reference
 */
export { BUILT_IN_TEMPLATES };
