/**
 * Template Category Mapping - Shared Constants
 *
 * Centralized category definitions for template organization across
 * both the templates page and analyze page. Ensures consistency and
 * avoids duplication.
 */

/**
 * Template category type definition
 */
export type TemplateCategory = 'meeting' | 'interview' | 'review' | 'custom';

/**
 * Built-in template categories with their associated template names
 */
export const TEMPLATE_CATEGORIES = {
  meeting: [
    // Original 6
    'Meeting Minutes',
    'Project Status Review',
    'Retrospective',
    'Legislative & Board Briefing',
    'Budget Planning Workshop',
    'Emergency Operations Briefing',
    // New Agile/PM
    'Sprint Planning Session',
    'Daily Standup Summary',
    'Release Planning Meeting',
    'Scrum of Scrums',
    // New Process
    'Process Mapping Workshop',
    'Workflow Analysis Session',
    // New Product
    'Product Concept Workshop',
    // New Training
    'Training Session Notes',
    'Knowledge Transfer Session',
    // New Planning
    'Strategic Planning Workshop',
    'Brainstorming Session',
    'Roadmap Planning Meeting',
    // New Executive
    'Council/City Manager Briefing',
    'ELT/Department Leadership Briefing',
    'Staff Meeting Summary',
    'Quick Meeting Summary'
  ],
  interview: [
    // Original 2
    'Stakeholder Interview',
    '1-on-1 Session',
    // New Process
    'Process Discovery Interview',
    // New Product
    'Software Evaluation Interview',
    'Requirements Gathering Session',
    'User Research Interview'
  ],
  review: [
    // Original 8
    'Client Discovery Call',
    'Capital Project Coordination',
    'Public Safety Incident Review',
    'Community Engagement Session',
    'Regulatory Compliance Hearing',
    'Field Operations Standup',
    'Case Management Conference',
    'Community Program Review',
    // New Agile
    'Sprint Review / Demo',
    // New Process
    'Process Improvement Review'
  ]
} as const;

/**
 * Get the category for a template based on its name
 *
 * @param templateName - The name of the template
 * @param defaultCategory - Default category to return if not found (default: 'custom')
 * @returns The template category
 */
export function getTemplateCategory(
  templateName: string,
  defaultCategory: TemplateCategory = 'custom'
): TemplateCategory {
  for (const [category, names] of Object.entries(TEMPLATE_CATEGORIES)) {
    if ((names as readonly string[]).includes(templateName)) {
      return category as 'meeting' | 'interview' | 'review';
    }
  }
  return defaultCategory;
}
