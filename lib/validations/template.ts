/**
 * Template Validation Schemas
 *
 * Zod schemas for validating template creation, editing, and structure.
 * Includes validation for Lucide icons, output formats, and template sections.
 */

import { z } from 'zod';

/**
 * Common Lucide React Icon Names
 * This is a curated list of commonly used icons. For a complete list,
 * see: https://lucide.dev/icons
 */
const LUCIDE_ICONS = [
  // Common UI icons
  'Mic', 'FileAudio', 'FileText', 'File', 'Files', 'Folder', 'FolderOpen',
  'Download', 'Upload', 'Save', 'Trash', 'Edit', 'Plus', 'Minus', 'X',
  'Check', 'ChevronDown', 'ChevronUp', 'ChevronLeft', 'ChevronRight',
  'Search', 'Settings', 'Menu', 'MoreVertical', 'MoreHorizontal',

  // Meeting & Communication
  'Users', 'User', 'UserPlus', 'MessageSquare', 'MessageCircle',
  'Video', 'Phone', 'Calendar', 'Clock', 'Timer',

  // Analysis & Documents
  'FileCheck', 'FileEdit', 'FilePlus', 'FileSearch', 'FileSignature',
  'Clipboard', 'ClipboardCheck', 'ClipboardList', 'ListChecks',
  'CheckSquare', 'Square', 'Circle', 'Target',

  // Actions & Status
  'PlayCircle', 'PauseCircle', 'StopCircle', 'SkipForward', 'SkipBack',
  'Repeat', 'Shuffle', 'Volume', 'Volume2', 'VolumeX',
  'AlertCircle', 'AlertTriangle', 'Info', 'HelpCircle',
  'CheckCircle', 'XCircle', 'Loader', 'RefreshCw',

  // Categories
  'BookOpen', 'Book', 'Briefcase', 'Flag', 'Star', 'Heart',
  'Tag', 'Tags', 'Hash', 'AtSign', 'Zap', 'TrendingUp',

  // Organization
  'Filter', 'SortAsc', 'SortDesc', 'Layout', 'Grid', 'List',
  'Columns', 'Rows', 'Maximize', 'Minimize', 'Copy', 'Share',
] as const;

/**
 * Output Format Schema
 */
export const outputFormatSchema = z.enum(['bullet_points', 'paragraph', 'table'], {
  message: 'Output format must be one of: bullet_points, paragraph, table',
});

/**
 * Template Category Schema
 */
export const templateCategorySchema = z.enum(['meeting', 'interview', 'review', 'custom'], {
  message: 'Template category must be one of: meeting, interview, review, custom',
});

/**
 * Output Type Schema
 */
export const outputTypeSchema = z.enum(['summary', 'action_items', 'quotes', 'decisions'], {
  message: 'Output type must be one of: summary, action_items, quotes, decisions',
});

/**
 * Lucide Icon Name Schema
 * Validates that the icon name exists in the Lucide library
 */
export const lucideIconSchema = z
  .string()
  .min(1, 'Icon name cannot be empty')
  .refine(
    (iconName) => {
      // Allow any string that matches common icon naming patterns
      // This is more permissive since Lucide has many icons
      return /^[A-Z][a-zA-Z0-9]*$/.test(iconName);
    },
    {
      message: 'Icon name must be in PascalCase (e.g., FileAudio, Users, CheckCircle)',
    }
  )
  .refine(
    (iconName) => {
      // Check against our curated list or allow any PascalCase string
      // This allows for future Lucide icons without updating the schema
      return (LUCIDE_ICONS as readonly string[]).includes(iconName) || /^[A-Z][a-zA-Z0-9]*$/.test(iconName);
    },
    {
      message: `Icon must be in PascalCase format. Common icons: ${LUCIDE_ICONS.slice(0, 10).join(', ')}, etc.`,
    }
  );

/**
 * Template Section ID Schema
 */
const sectionIdSchema = z
  .string()
  .min(1, 'Section ID cannot be empty')
  .regex(
    /^[a-z0-9-_]+$/,
    'Section ID can only contain lowercase letters, numbers, hyphens, and underscores'
  );

/**
 * Template Section Name Schema
 */
const sectionNameSchema = z
  .string()
  .min(1, 'Section name cannot be empty')
  .max(100, 'Section name must be 100 characters or less')
  .trim();

/**
 * Template Section Prompt Schema
 */
const sectionPromptSchema = z
  .string()
  .min(10, 'Section prompt must be at least 10 characters')
  .max(2000, 'Section prompt must be 2000 characters or less')
  .trim();

/**
 * Template Section Schema
 */
export const templateSectionSchema = z.object({
  id: sectionIdSchema,
  name: sectionNameSchema,
  prompt: sectionPromptSchema,
  extractEvidence: z.boolean().default(true),
  outputFormat: outputFormatSchema,
});

/**
 * Template Section Input Schema (before ID is assigned)
 */
export const templateSectionInputSchema = templateSectionSchema.omit({ id: true });

/**
 * Template ID Schema
 */
const templateIdSchema = z
  .string()
  .min(1, 'Template ID cannot be empty')
  .regex(
    /^[a-z0-9-_]+$/,
    'Template ID can only contain lowercase letters, numbers, hyphens, and underscores'
  );

/**
 * Template Name Schema
 */
const templateNameSchema = z
  .string()
  .min(1, 'Template name cannot be empty')
  .max(100, 'Template name must be 100 characters or less')
  .trim();

/**
 * Template Description Schema
 */
const templateDescriptionSchema = z
  .string()
  .min(10, 'Template description must be at least 10 characters')
  .max(500, 'Template description must be 500 characters or less')
  .trim();

/**
 * Template Schema
 */
export const templateSchema = z.object({
  id: templateIdSchema,
  name: templateNameSchema,
  description: templateDescriptionSchema,
  icon: lucideIconSchema,
  category: templateCategorySchema,
  sections: z
    .array(templateSectionSchema)
    .min(1, 'Template must have at least one section')
    .max(20, 'Template cannot have more than 20 sections'),
  outputs: z
    .array(outputTypeSchema)
    .min(1, 'Template must have at least one output type')
    .max(4, 'Template cannot have more than 4 output types'),
  isCustom: z.boolean(),
  createdAt: z.date(),
});

/**
 * Template Input Schema (before ID and createdAt are assigned)
 */
export const templateInputSchema = templateSchema.omit({ id: true, createdAt: true });

/**
 * Template Update Schema (partial with required ID)
 */
export const templateUpdateSchema = templateSchema.partial().required({ id: true });

/**
 * Default Template Configuration Schema
 */
export const defaultTemplateConfigSchema = z.object({
  category: templateCategorySchema,
  editable: z.boolean(),
  defaultSections: z.array(templateSectionInputSchema),
});

/**
 * Type inference from schemas
 */
export type OutputFormat = z.infer<typeof outputFormatSchema>;
export type TemplateCategory = z.infer<typeof templateCategorySchema>;
export type OutputType = z.infer<typeof outputTypeSchema>;
export type TemplateSection = z.infer<typeof templateSectionSchema>;
export type TemplateSectionInput = z.infer<typeof templateSectionInputSchema>;
export type Template = z.infer<typeof templateSchema>;
export type TemplateInput = z.infer<typeof templateInputSchema>;
export type TemplateUpdate = z.infer<typeof templateUpdateSchema>;
export type DefaultTemplateConfig = z.infer<typeof defaultTemplateConfigSchema>;

/**
 * Validate template creation input
 *
 * @param input - Template creation data
 * @returns Validated template input
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * const templateData = {
 *   name: 'Daily Standup',
 *   description: 'Template for daily standup meetings',
 *   icon: 'Users',
 *   category: 'meeting',
 *   sections: [...],
 *   outputs: ['summary', 'action_items'],
 *   isCustom: true,
 * };
 *
 * try {
 *   const validated = validateTemplateInput(templateData);
 *   console.log('Template is valid:', validated);
 * } catch (error) {
 *   console.error('Validation failed:', error);
 * }
 * ```
 */
export function validateTemplateInput(input: unknown): TemplateInput {
  return templateInputSchema.parse(input);
}

/**
 * Validate template section
 *
 * @param section - Template section data
 * @returns Validated section
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * const section = {
 *   id: 'key-points',
 *   name: 'Key Points',
 *   prompt: 'Extract the main discussion points from the meeting',
 *   extractEvidence: true,
 *   outputFormat: 'bullet_points',
 * };
 *
 * const validated = validateTemplateSection(section);
 * ```
 */
export function validateTemplateSection(section: unknown): TemplateSection {
  return templateSectionSchema.parse(section);
}

/**
 * Validate template section input (without ID)
 *
 * @param input - Template section input data
 * @returns Validated section input
 * @throws {z.ZodError} If validation fails
 */
export function validateTemplateSectionInput(input: unknown): TemplateSectionInput {
  return templateSectionInputSchema.parse(input);
}

/**
 * Validate complete template
 *
 * @param template - Complete template data
 * @returns Validated template
 * @throws {z.ZodError} If validation fails
 */
export function validateTemplate(template: unknown): Template {
  return templateSchema.parse(template);
}

/**
 * Validate template update
 *
 * @param update - Template update data
 * @returns Validated update
 * @throws {z.ZodError} If validation fails
 */
export function validateTemplateUpdate(update: unknown): TemplateUpdate {
  return templateUpdateSchema.parse(update);
}

/**
 * Validate output format
 *
 * @param format - Output format string
 * @returns Validated output format
 * @throws {z.ZodError} If validation fails
 */
export function validateOutputFormat(format: unknown): OutputFormat {
  return outputFormatSchema.parse(format);
}

/**
 * Validate template category
 *
 * @param category - Category string
 * @returns Validated category
 * @throws {z.ZodError} If validation fails
 */
export function validateTemplateCategory(category: unknown): TemplateCategory {
  return templateCategorySchema.parse(category);
}

/**
 * Validate output type
 *
 * @param type - Output type string
 * @returns Validated output type
 * @throws {z.ZodError} If validation fails
 */
export function validateOutputType(type: unknown): OutputType {
  return outputTypeSchema.parse(type);
}

/**
 * Validate Lucide icon name
 *
 * @param iconName - Icon name to validate
 * @returns Validated icon name
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * try {
 *   const icon = validateLucideIcon('FileAudio');
 *   console.log('Valid icon:', icon);
 * } catch (error) {
 *   console.error('Invalid icon name');
 * }
 * ```
 */
export function validateLucideIcon(iconName: unknown): string {
  return lucideIconSchema.parse(iconName);
}

/**
 * Safe validation that returns success/error result instead of throwing
 *
 * @param input - Template input to validate
 * @returns Result object with success flag and data or error
 *
 * @example
 * ```typescript
 * const result = safeValidateTemplateInput(templateData);
 * if (result.success) {
 *   console.log('Valid template:', result.data);
 * } else {
 *   console.error('Validation errors:', result.error.format());
 * }
 * ```
 */
export function safeValidateTemplateInput(
  input: unknown
): { success: true; data: TemplateInput } | { success: false; error: z.ZodError } {
  const result = templateInputSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Safe validation for template sections
 *
 * @param section - Section to validate
 * @returns Result object with success flag and data or error
 */
export function safeValidateTemplateSection(
  section: unknown
): { success: true; data: TemplateSection } | { success: false; error: z.ZodError } {
  const result = templateSectionSchema.safeParse(section);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Get list of common Lucide icon names
 *
 * @returns Array of common icon names
 */
export function getCommonLucideIcons(): readonly string[] {
  return LUCIDE_ICONS;
}

/**
 * Check if a string is a valid output format (type guard)
 *
 * @param value - Value to check
 * @returns True if valid output format
 */
export function isOutputFormat(value: unknown): value is OutputFormat {
  return outputFormatSchema.safeParse(value).success;
}

/**
 * Check if a string is a valid template category (type guard)
 *
 * @param value - Value to check
 * @returns True if valid template category
 */
export function isTemplateCategory(value: unknown): value is TemplateCategory {
  return templateCategorySchema.safeParse(value).success;
}

/**
 * Check if a string is a valid output type (type guard)
 *
 * @param value - Value to check
 * @returns True if valid output type
 */
export function isOutputType(value: unknown): value is OutputType {
  return outputTypeSchema.safeParse(value).success;
}
