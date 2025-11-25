/**
 * Audio Amplitude Hook
 *
 * Custom React hook for real-time audio amplitude analysis using the Web Audio API.
 * Provides frequency data for visualizations that respond to actual audio input.
 *
 * Features:
 * - Real-time frequency analysis via AnalyserNode
 * - Smooth 60fps updates using requestAnimationFrame
 * - Configurable FFT size for different visualization granularities
 * - Automatic cleanup of AudioContext on stop/unmount
 * - Works with any MediaStream (microphone, system audio, or mixed)
 *
 * Usage:
 * ```tsx
 * const { amplitudes, startAnalysis, stopAnalysis, isAnalysing } = useAudioAmplitude();
 *
 * // Start analysis with a MediaStream
 * startAnalysis(stream);
 *
 * // Use amplitudes array for visualization
 * amplitudes.forEach((value, i) => {
 *   // value is 0-255, representing frequency magnitude
 *   const barHeight = 15 + (value / 255) * 30;
 * });
 *
 * // Stop analysis when done
 * stopAnalysis();
 * ```
 */

"use client";

import * as React from 'react';

/**
 * Options for configuring the audio amplitude analyzer
 */
export interface UseAudioAmplitudeOptions {
  /**
   * FFT size for frequency analysis.
   * Must be a power of 2 between 32 and 32768.
   * Higher values give more frequency bins but slower updates.
   * @default 64 (gives 32 frequency bins)
   */
  fftSize?: number;

  /**
   * Smoothing time constant for the analyzer.
   * Value between 0 and 1. Higher = smoother but less responsive.
   * @default 0.8
   */
  smoothingTimeConstant?: number;
}

/**
 * Return type for the useAudioAmplitude hook
 */
export interface UseAudioAmplitudeReturn {
  /**
   * Array of frequency amplitude values (0-255).
   * Length is fftSize/2 (e.g., 32 values for fftSize=64).
   * Updates in real-time when analyzing.
   */
  amplitudes: number[];

  /**
   * Normalized average amplitude (0-1).
   * Useful for simple level indicators.
   */
  averageLevel: number;

  /**
   * Whether analysis is currently active.
   */
  isAnalysing: boolean;

  /**
   * Start analyzing a MediaStream.
   * @param stream - The MediaStream to analyze (from getUserMedia or getDisplayMedia)
   */
  startAnalysis: (stream: MediaStream) => void;

  /**
   * Stop analysis and cleanup resources.
   */
  stopAnalysis: () => void;
}

/**
 * Custom hook for real-time audio amplitude analysis
 *
 * Uses the Web Audio API's AnalyserNode to extract frequency data
 * from a MediaStream, providing real-time amplitude values for
 * audio visualizations.
 *
 * @param options - Configuration options
 * @returns Amplitude data and control functions
 *
 * @example
 * ```tsx
 * function RecordingVisualizer({ stream }: { stream: MediaStream | null }) {
 *   const { amplitudes, startAnalysis, stopAnalysis, isAnalysing } = useAudioAmplitude();
 *
 *   useEffect(() => {
 *     if (stream) {
 *       startAnalysis(stream);
 *     }
 *     return () => stopAnalysis();
 *   }, [stream]);
 *
 *   return (
 *     <div className="waveform">
 *       {amplitudes.map((amp, i) => (
 *         <div
 *           key={i}
 *           className="bar"
 *           style={{ height: `${15 + (amp / 255) * 30}px` }}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAudioAmplitude(
  options: UseAudioAmplitudeOptions = {}
): UseAudioAmplitudeReturn {
  const { fftSize = 64, smoothingTimeConstant = 0.8 } = options;

  // State for amplitude data
  const [amplitudes, setAmplitudes] = React.useState<number[]>(() =>
    new Array(fftSize / 2).fill(0)
  );
  const [averageLevel, setAverageLevel] = React.useState(0);
  const [isAnalysing, setIsAnalysing] = React.useState(false);

  // Refs for Web Audio API objects (avoid re-renders)
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const dataArrayRef = React.useRef<Uint8Array<ArrayBuffer> | null>(null);

  /**
   * Stop analysis and cleanup all resources
   */
  const stopAnalysis = React.useCallback(() => {
    // Cancel animation frame
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Disconnect source node
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // Ignore errors if already disconnected
      }
      sourceRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // Ignore errors if already closed
      }
      audioContextRef.current = null;
    }

    // Clear analyser reference
    analyserRef.current = null;
    dataArrayRef.current = null;

    // Reset state
    setIsAnalysing(false);
    setAmplitudes(new Array(fftSize / 2).fill(0));
    setAverageLevel(0);
  }, [fftSize]);

  /**
   * Start analyzing a MediaStream
   */
  const startAnalysis = React.useCallback(
    (stream: MediaStream) => {
      // Stop any existing analysis first
      stopAnalysis();

      try {
        // Create new AudioContext
        const audioContext = new AudioContext();
        audioContextRef.current = audioContext;

        // Create AnalyserNode with configured settings
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothingTimeConstant;
        analyserRef.current = analyser;

        // Create source node from the MediaStream
        const source = audioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        // Connect source to analyser
        // Note: We don't connect analyser to destination - we just want to analyze, not hear it
        source.connect(analyser);

        // Initialize data array for frequency data
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

        // Mark as analyzing
        setIsAnalysing(true);

        /**
         * Animation loop to continuously read frequency data
         */
        const updateAmplitudes = () => {
          if (!analyserRef.current || !dataArrayRef.current) {
            return;
          }

          // Get frequency data
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);

          // Convert Uint8Array to regular array for React state
          const amplitudeArray = Array.from(dataArrayRef.current);

          // Calculate average level (normalized 0-1)
          const sum = amplitudeArray.reduce((acc, val) => acc + val, 0);
          const avg = sum / amplitudeArray.length / 255;

          // Update state
          setAmplitudes(amplitudeArray);
          setAverageLevel(avg);

          // Continue the animation loop
          animationFrameRef.current = requestAnimationFrame(updateAmplitudes);
        };

        // Start the animation loop
        animationFrameRef.current = requestAnimationFrame(updateAmplitudes);
      } catch (error) {
        console.error('Failed to start audio analysis:', error);
        stopAnalysis();
      }
    },
    [fftSize, smoothingTimeConstant, stopAnalysis]
  );

  /**
   * Cleanup on unmount
   */
  React.useEffect(() => {
    return () => {
      // Cancel animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Disconnect source
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch {
          // Ignore
        }
      }

      // Close audio context
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  return {
    amplitudes,
    averageLevel,
    isAnalysing,
    startAnalysis,
    stopAnalysis,
  };
}
