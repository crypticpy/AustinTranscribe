/**
 * Browser Capabilities Detection
 *
 * Utilities for detecting browser support for audio recording features.
 * System audio capture via getDisplayMedia is only supported in:
 * - Chrome 74+
 * - Edge 79+
 * - Firefox (limited - may not support audio in getDisplayMedia)
 * - Safari: No support for system audio
 *
 * This module provides comprehensive browser feature detection for the recording
 * functionality, including microphone access, system audio capture, and secure context
 * verification.
 */

import type { BrowserCapabilities, RecordingMode, RecordingModeConfig } from '@/types/recording';

/**
 * Detect the current browser name from user agent string.
 *
 * Uses navigator.userAgent to identify the browser. The order of checks matters
 * since some browsers include multiple identifiers (e.g., Edge includes "Chrome").
 *
 * @returns Browser name as a string ('Chrome', 'Firefox', 'Safari', 'Edge', 'Opera', or 'unknown')
 *
 * @example
 * const browser = detectBrowserName();
 * if (browser === 'Safari') {
 *   console.warn('System audio not supported');
 * }
 */
export function detectBrowserName(): string {
  if (typeof navigator === 'undefined') return 'unknown';

  const ua = navigator.userAgent;

  // Order matters: check Edge before Chrome, Opera before Chrome
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';

  return 'unknown';
}

/**
 * Check if the current context is secure (HTTPS or localhost).
 *
 * Media APIs (getUserMedia, getDisplayMedia) require a secure context.
 * This means the page must be served over:
 * - HTTPS (https://)
 * - Localhost (http://localhost or http://127.0.0.1)
 * - File protocol (file://) in some browsers
 *
 * @returns true if running in a secure context, false otherwise
 *
 * @example
 * if (!isSecureContext()) {
 *   alert('Recording requires HTTPS or localhost');
 * }
 */
export function isSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext === true;
}

/**
 * Check if getUserMedia API is supported (microphone access).
 *
 * getUserMedia is available in all modern browsers but requires:
 * 1. Secure context (HTTPS/localhost)
 * 2. User permission grant
 * 3. Physical microphone device
 *
 * This function only checks API availability, not permission status.
 *
 * @returns true if getUserMedia API is available, false otherwise
 *
 * @example
 * if (hasMicrophoneSupport()) {
 *   // Show microphone recording option
 * }
 */
export function hasMicrophoneSupport(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !!(navigator.mediaDevices?.getUserMedia);
}

/**
 * Check if getDisplayMedia with audio capture is supported (system audio).
 *
 * System audio capture allows recording audio from browser tabs, windows, or
 * the entire screen. Browser support varies significantly:
 *
 * - Chrome 74+: Full support
 * - Edge 79+: Full support
 * - Firefox: API exists but audio support is inconsistent
 * - Safari: No audio support in getDisplayMedia
 * - Mobile browsers: Generally not supported
 *
 * Note: This checks API availability, not whether the user's system or
 * selected capture source actually provides an audio track.
 *
 * @returns true if system audio capture is likely supported, false otherwise
 *
 * @example
 * if (hasSystemAudioSupport()) {
 *   // Show system audio recording option
 * }
 */
export function hasSystemAudioSupport(): boolean {
  if (typeof navigator === 'undefined') return false;

  // Check if getDisplayMedia exists
  if (!navigator.mediaDevices?.getDisplayMedia) return false;

  // Safari doesn't support audio in getDisplayMedia
  const browser = detectBrowserName();
  if (browser === 'Safari') return false;

  // Mobile browsers generally don't support this
  if (isMobileDevice()) return false;

  return true;
}

/**
 * Check if the current device is a mobile device.
 *
 * Uses user agent string to detect mobile devices. This is not 100% reliable
 * but works for most common cases.
 *
 * @returns true if the device appears to be mobile, false otherwise
 *
 * @example
 * if (isMobileDevice()) {
 *   // Show mobile-optimized recording UI
 * }
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Get comprehensive browser capabilities for recording features.
 *
 * Performs all capability checks and returns a complete capability profile
 * including microphone, system audio, and commentary mode support.
 *
 * Commentary mode requires both microphone AND system audio support since
 * it records both sources simultaneously.
 *
 * @returns BrowserCapabilities object with all feature flags
 *
 * @example
 * const caps = getBrowserCapabilities();
 * console.log(`Browser: ${caps.browserName}`);
 * console.log(`Microphone: ${caps.hasMicrophoneSupport}`);
 * console.log(`System Audio: ${caps.hasSystemAudioSupport}`);
 * console.log(`Commentary: ${caps.hasCommentarySupport}`);
 */
export function getBrowserCapabilities(): BrowserCapabilities {
  const mic = hasMicrophoneSupport();
  const system = hasSystemAudioSupport();

  return {
    hasMicrophoneSupport: mic,
    hasSystemAudioSupport: system,
    hasCommentarySupport: mic && system, // Need both for commentary
    browserName: detectBrowserName(),
    isSecureContext: isSecureContext(),
  };
}

/**
 * Check if a specific recording mode is supported in the current browser.
 *
 * Determines whether a given recording mode can be used based on browser
 * capabilities and execution context.
 *
 * @param mode - The recording mode to check
 * @returns true if the mode is supported, false otherwise
 *
 * @example
 * if (!isModeSupported('system-audio')) {
 *   // Disable or hide system audio option
 * }
 */
export function isModeSupported(mode: RecordingMode): boolean {
  const caps = getBrowserCapabilities();

  switch (mode) {
    case 'microphone':
      return caps.hasMicrophoneSupport;
    case 'system-audio':
      return caps.hasSystemAudioSupport;
    case 'commentary':
      return caps.hasCommentarySupport;
    default:
      return false;
  }
}

/**
 * Get a user-friendly explanation for why a recording mode is not supported.
 *
 * Provides specific error messages based on the browser, device, and security
 * context to help users understand why a feature is unavailable.
 *
 * @param mode - The recording mode to check
 * @returns Error message string if not supported, undefined if supported
 *
 * @example
 * const reason = getUnsupportedReason('system-audio');
 * if (reason) {
 *   alert(reason); // "System audio capture not supported in Safari. Use Chrome or Edge."
 * }
 */
export function getUnsupportedReason(mode: RecordingMode): string | undefined {
  const caps = getBrowserCapabilities();

  // Check secure context first - applies to all modes
  if (!caps.isSecureContext) {
    return 'Requires HTTPS or localhost';
  }

  switch (mode) {
    case 'microphone':
      if (!caps.hasMicrophoneSupport) {
        return 'Microphone access not available in this browser';
      }
      break;

    case 'system-audio':
      if (!caps.hasSystemAudioSupport) {
        if (isMobileDevice()) {
          return 'System audio capture not supported on mobile devices';
        }
        if (caps.browserName === 'Safari') {
          return 'System audio capture not supported in Safari. Use Chrome or Edge.';
        }
        if (caps.browserName === 'Firefox') {
          return 'System audio may have limited support in Firefox. Use Chrome or Edge for best results.';
        }
        return 'System audio capture not supported in this browser. Use Chrome or Edge.';
      }
      break;

    case 'commentary':
      if (!caps.hasCommentarySupport) {
        if (!caps.hasMicrophoneSupport) {
          return 'Microphone access not available';
        }
        return 'System audio capture required for commentary mode. Use Chrome or Edge.';
      }
      break;
  }

  return undefined;
}

/**
 * Get configuration for all recording modes including support status.
 *
 * Returns an array of RecordingModeConfig objects that can be used to render
 * the mode selection UI. Each config includes support status and disabled reasons.
 *
 * The returned configurations include:
 * - Microphone: Records from device microphone
 * - System Audio: Records from apps like Zoom/Teams
 * - Commentary: Records both microphone and system audio
 *
 * @returns Array of RecordingModeConfig objects for all modes
 *
 * @example
 * const modes = getRecordingModeConfigs();
 * return (
 *   <div>
 *     {modes.map(mode => (
 *       <ModeButton
 *         key={mode.id}
 *         disabled={!mode.supported}
 *         tooltip={mode.disabledReason}
 *       >
 *         {mode.label}
 *       </ModeButton>
 *     ))}
 *   </div>
 * );
 */
export function getRecordingModeConfigs(): RecordingModeConfig[] {
  return [
    {
      id: 'microphone',
      label: 'Microphone',
      description: 'Record from your device microphone. Great for in-person meetings or phone recordings.',
      icon: 'Mic',
      color: 'blue',
      supported: isModeSupported('microphone'),
      disabledReason: getUnsupportedReason('microphone'),
    },
    {
      id: 'system-audio',
      label: 'System Audio',
      description: 'Capture audio from Zoom, Teams, or other apps. Select a tab or window to record.',
      icon: 'Monitor',
      color: 'green',
      supported: isModeSupported('system-audio'),
      disabledReason: getUnsupportedReason('system-audio'),
    },
    {
      id: 'commentary',
      label: 'Commentary',
      description: 'Capture both system audio AND your microphone. Perfect for participating in virtual meetings.',
      icon: 'Users',
      color: 'violet',
      supported: isModeSupported('commentary'),
      disabledReason: getUnsupportedReason('commentary'),
    },
  ];
}
