"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Settings } from "lucide-react";
import {
  Burger,
  Group,
  Button,
  Drawer,
  Stack,
  ActionIcon,
  useMantineColorScheme,
  useComputedColorScheme,
  Container,
  Box,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { SettingsDialog } from "./settings-dialog";
import { LanguageSwitcher } from "./language-switcher";

/**
 * Navigation link item
 */
interface NavItem {
  href: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Upload" },
  { href: "/record", label: "Record" },
  { href: "/recordings", label: "Recordings" },
  { href: "/transcripts", label: "Transcripts" },
  { href: "/templates", label: "Templates" },
];

/**
 * Header component with navigation, settings, and dark mode toggle
 * Responsive with mobile menu drawer
 * MIGRATED TO MANTINE
 */
export default function Header() {
  const pathname = usePathname();
  const { setColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [mobileMenuOpened, { toggle: toggleMobileMenu, close: closeMobileMenu }] = useDisclosure(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setColorScheme(colorScheme === "dark" ? "light" : "dark");
  };

  return (
    <>
      <Box component="header" className="coa-header-root">
        <Container size="xl" style={{ padding: "0 1rem" }}>
          <Group h={64} justify="space-between">
            {/* Logo/Brand */}
            <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
              <Group gap="sm">
                <Box style={{ display: "flex", alignItems: "center" }}>
{/* Using native img to avoid Next.js Image preload/LCP conflicts in client components */}
                  <img
                    src="/images/coa-logo.png"
                    alt="City of Austin Logo"
                    width={180}
                    height={45}
                    className="coa-header-logo"
                    style={{
                      objectFit: "contain",
                    }}
                  />
                </Box>
                <Text
                  size="md"
                  fw={700}
                  visibleFrom="sm"
                  className="coa-header-tagline"
                >
                  Meeting Transcriber
                </Text>
              </Group>
            </Link>

            {/* Desktop Navigation */}
            <Group gap="lg" visibleFrom="md">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link"
                  style={{
                    textDecoration: "none",
                  }}
                >
                  <Text
                    component="span"
                    size="sm"
                    fw={600} // Increased font weight
                    className={pathname === item.href ? "nav-text-active" : "nav-text"}
                  >
                    {item.label}
                  </Text>
                </Link>
              ))}
            </Group>

            {/* Desktop Actions */}
            <Group gap="xs" visibleFrom="md">
              <LanguageSwitcher />
              <ActionIcon
                variant="subtle"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                size="lg"
                className="touch-target-sm"
              >
                {mounted && (colorScheme === "dark" ? (
                  <Sun size={20} />
                ) : (
                  <Moon size={20} />
                ))}
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Settings"
                size="lg"
                className="touch-target-sm"
              >
                <Settings size={20} />
              </ActionIcon>
            </Group>

            {/* Mobile Actions */}
            <Group gap="xs" hiddenFrom="md">
              <LanguageSwitcher />
              <ActionIcon
                variant="subtle"
                onClick={toggleTheme}
                aria-label="Toggle theme"
                size="lg"
                className="touch-target"
              >
                {mounted && (colorScheme === "dark" ? (
                  <Sun size={20} />
                ) : (
                  <Moon size={20} />
                ))}
              </ActionIcon>
              <Burger
                opened={mobileMenuOpened}
                onClick={toggleMobileMenu}
                aria-label="Open menu"
                size="sm"
                className="touch-target"
              />
            </Group>
          </Group>
        </Container>
      </Box>

      {/* Mobile Menu Drawer */}
      <Drawer
        opened={mobileMenuOpened}
        onClose={closeMobileMenu}
        position="right"
        size="xs"
        padding="md"
        title={<Text fw={600}>Navigation</Text>}
      >
        <Stack gap="xs" mt="lg">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="mobile-nav-link"
              style={{ textDecoration: 'none', color: 'inherit' }}
              onClick={closeMobileMenu}
            >
              <div
                className={pathname === item.href ? 'mobile-nav-item-active' : 'mobile-nav-item'}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--mantine-radius-md)',
                  minHeight: 48,
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: pathname === item.href ? 'var(--mantine-color-primary-light)' : 'transparent',
                  color: pathname === item.href ? 'var(--mantine-color-primary-filled)' : 'inherit',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {item.label}
              </div>
            </Link>
          ))}
          <Box mt="md" pt="md" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
            <Button
              variant="light"
              leftSection={<Settings size={16} />}
              fullWidth
              onClick={() => {
                closeMobileMenu();
                setIsSettingsOpen(true);
              }}
              style={{ minHeight: 48 }}
            >
              Settings
            </Button>
          </Box>
        </Stack>
      </Drawer>

      {/* Settings Dialog */}
      <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

      {/* CSS for hover effects */}
      <style jsx>{`
        :global(.coa-header-root) {
          background-color: rgba(255, 255, 255, 0.95);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: background-color 0.3s ease, border-color 0.3s ease;
        }
        :global(html[data-mantine-color-scheme='dark'] .coa-header-root) {
          background-color: rgba(34, 37, 78, 0.95);
          border-bottom-color: rgba(255, 255, 255, 0.1);
        }
        :global(.coa-header-tagline) {
          border-left: 1px solid rgba(0, 0, 0, 0.2);
          padding-left: 1rem;
          margin-left: 0.5rem;
          color: var(--mantine-color-gray-8);
        }
        :global(html[data-mantine-color-scheme='dark'] .coa-header-tagline) {
          border-left-color: rgba(255, 255, 255, 0.3);
          color: rgba(255, 255, 255, 0.9);
        }
        :global(.nav-text),
        :global(.nav-text-active) {
          transition: color 0.15s ease;
          cursor: pointer;
        }
        :global(.nav-text) {
          color: var(--mantine-color-gray-7);
        }
        :global(.nav-text-active) {
          color: var(--mantine-color-aphBlue-6);
        }
        :global(html[data-mantine-color-scheme='dark'] .nav-text) {
          color: rgba(255, 255, 255, 0.7);
        }
        :global(html[data-mantine-color-scheme='dark'] .nav-text-active) {
          color: #fff;
        }
        :global(.nav-link:hover .nav-text) {
          color: var(--mantine-color-text) !important;
        }
        :global(.mobile-nav-link:hover .mobile-nav-item:not(.mobile-nav-item-active)) {
          background-color: var(--mantine-color-gray-1) !important;
        }
        :global(.coa-header-logo) {
          transition: filter 120ms ease;
          filter: drop-shadow(0 6px 12px rgba(34, 37, 78, 0.15));
        }
        :global(html[data-mantine-color-scheme='dark'] .coa-header-logo) {
          filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.55));
        }
      `}</style>
    </>
  );
}
