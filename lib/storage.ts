/**
 * Type-safe localStorage wrapper for application user preferences
 * Provides getter/setter functions for non-sensitive user settings only
 *
 * SECURITY NOTE: This module NO LONGER stores API keys or sensitive credentials.
 * All API configuration is now managed via server-side environment variables.
 */

/**
 * Storage keys for user preferences (non-sensitive only)
 */
const STORAGE_KEYS = {
  THEME: 'user_theme_preference',
  LANGUAGE: 'user_language_preference',
  AUTO_SAVE: 'auto_save_enabled',
  NOTIFICATIONS: 'notifications_enabled',
} as const;

/**
 * Theme preference type
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Language preference type
 */
export type Language = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh';

/**
 * Get user theme preference from localStorage
 */
export function getThemePreference(): Theme | null {
  if (typeof window === 'undefined') return null;
  const theme = localStorage.getItem(STORAGE_KEYS.THEME);
  return theme as Theme | null;
}

/**
 * Set user theme preference in localStorage
 */
export function setThemePreference(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

/**
 * Get user language preference from localStorage
 */
export function getLanguagePreference(): Language | null {
  if (typeof window === 'undefined') return null;
  const language = localStorage.getItem(STORAGE_KEYS.LANGUAGE);
  return language as Language | null;
}

/**
 * Set user language preference in localStorage
 */
export function setLanguagePreference(language: Language): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
}

/**
 * Get auto-save preference from localStorage
 */
export function getAutoSavePreference(): boolean {
  if (typeof window === 'undefined') return true;
  const autoSave = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE);
  return autoSave !== 'false'; // Default to true
}

/**
 * Set auto-save preference in localStorage
 */
export function setAutoSavePreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, enabled.toString());
}

/**
 * Get notifications preference from localStorage
 */
export function getNotificationsPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const notifications = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
  return notifications !== 'false'; // Default to true
}

/**
 * Set notifications preference in localStorage
 */
export function setNotificationsPreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, enabled.toString());
}

/**
 * Clear all user preferences from localStorage
 * NOTE: This does NOT clear API keys (they are no longer stored client-side)
 */
export function clearAllPreferences(): void {
  if (typeof window === 'undefined') return;
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

/**
 * Get all user preferences as an object
 */
export function getAllPreferences() {
  return {
    theme: getThemePreference(),
    language: getLanguagePreference(),
    autoSave: getAutoSavePreference(),
    notifications: getNotificationsPreference(),
  };
}
