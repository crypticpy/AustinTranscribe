/**
 * Language Switcher Component
 *
 * Bilingual toggle for City of Austin workers
 * - English / Español
 * - Persists preference in localStorage
 * - Mobile-friendly with 48px touch targets
 * MIGRATED TO MANTINE
 */

"use client";

import * as React from "react";
import { Globe } from "lucide-react";
import { ActionIcon, Menu, Text } from "@mantine/core";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";
import { getStoredLocale, setStoredLocale } from "@/lib/locale";

/**
 * Language Switcher Component
 *
 * Provides a dropdown menu for switching between English and Spanish.
 * Preference is saved to localStorage and page reloads to apply the new language.
 */
export function LanguageSwitcher() {
  const [currentLocale, setCurrentLocale] = React.useState<Locale>(() => {
    return getStoredLocale();
  });

  /**
   * Handle language change
   * Saves to localStorage and reloads the page
   */
  const handleLocaleChange = React.useCallback((newLocale: Locale) => {
    // Save to localStorage
    setStoredLocale(newLocale);

    // Update state
    setCurrentLocale(newLocale);

    // Reload page to apply new language
    // (Next.js will detect the stored locale and render with new translations)
    window.location.reload();
  }, []);

  return (
    <Menu position="bottom-end" width={180}>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          aria-label="Change language"
          size="lg"
          className="touch-target-sm"
        >
          <Globe size={20} />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Language / Idioma</Menu.Label>
        {locales.map((locale) => (
          <Menu.Item
            key={locale}
            onClick={() => handleLocaleChange(locale)}
            style={{
              minHeight: 48,
              backgroundColor: currentLocale === locale
                ? "var(--mantine-color-aphBlue-0)"
                : undefined,
            }}
          >
            <Text component="span" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span aria-hidden="true">{localeFlags[locale]}</span>
              <span>{localeNames[locale]}</span>
              {locale === currentLocale && (
                <Text component="span" size="xs" c="dimmed" ml="auto">
                  (current)
                </Text>
              )}
            </Text>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
