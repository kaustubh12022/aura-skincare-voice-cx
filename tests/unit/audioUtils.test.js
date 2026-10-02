/**
 * tests/unit/audioUtils.test.js
 * Comprehensive unit test suite for Web Audio PCM conversions,
 * downsampling algorithms, and Base64 streaming utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  floatTo16BitPCM,
  pcm16ToFloat32,
  downsampleAudio,
  pcmToBase64,
  base64ToPcm,
  generateSineWave
} from '../mocks/audioUtils.js';

describe('Audio Utilities Unit Tests (PCM & Downsampling)', () => {
  // --- PCM Conversion ---

  describe('16-bit Linear PCM Little-Endian Encoding (floatTo16BitPCM)', () => {
    it('TC-1.2.1: encodes silence (0.0) to zero int16 bytes', () => {
      const float32 = new Float32Array([0.0, 0.0, 0.0]);
      const pcmBuffer = floatTo16BitPCM(float32);

      expect(pcmBuffer.length).toBe(6); // 3 samples * 2 bytes = 6
      expect(pcmBuffer.readInt16LE(0)).toBe(0);
      expect(pcmBuffer.readInt16LE(2)).toBe(0);
      expect(pcmBuffer.readInt16LE(4)).toBe(0);
    });

    it('encodes maximum positive amplitude (+1.0) to +32767 (0x7FFF)', () => {
      const float32 = new Float32Array([1.0]);
      const pcmBuffer = floatTo16BitPCM(float32);

      expect(pcmBuffer.length).toBe(2);
      expect(pcmBuffer.readInt16LE(0)).toBe(32767);
    });

    it('encodes maximum negative amplitude (-1.0) to -32768 (-0x8000)', () => {
      const float32 = new Float32Array([-1.0]);
      const pcmBuffer = floatTo16BitPCM(float32);

      expect(pcmBuffer.length).toBe(2);
      expect(pcmBuffer.readInt16LE(0)).toBe(-32768);
    });

    it('clamps over-range positive amplitudes (+1.5, +2.0) safely without overflow', () => {
      const float32 = new Float32Array([1.5, 2.5]);
      const pcmBuffer = floatTo16BitPCM(float32);

      expect(pcmBuffer.readInt16LE(0)).toBe(32767);
      expect(pcmBuffer.readInt16LE(2)).toBe(32767);
    });

    it('clamps over-range negative amplitudes (-1.8, -3.0) safely without underflow', () => {
      const float32 = new Float32Array([-1.8, -3.0]);
      const pcmBuffer = floatTo16BitPCM(float32);

      expect(pcmBuffer.readInt16LE(0)).toBe(-32768);
      expect(pcmBuffer.readInt16LE(2)).toBe(-32768);
    });

    it('handles empty inputs safely', () => {
      expect(floatTo16BitPCM([]).length).toBe(0);
      expect(floatTo16BitPCM(null).length).toBe(0);
    });
  });

  // --- Float32 Reconstruction ---

  describe('Linear PCM to Float32 Normalization (pcm16ToFloat32)', () => {
    it('TC-1.2.2: restores PCM buffer back to Float32Array accurately', () => {
      const originalFloat = new Float32Array([0.0, 0.5, -0.5, 1.0, -1.0]);
      const pcmBuffer = floatTo16BitPCM(originalFloat);
      const restored = pcm16ToFloat32(pcmBuffer);

      expect(restored.length).toBe(originalFloat.length);
      for (let i = 0; i < originalFloat.length; i++) {
        // High fidelity round-trip within Int16 quantization tolerance (~0.0001)
        expect(Math.abs(restored[i] - originalFloat[i])).toBeLessThan(0.001);
      }
    });

    it('handles empty buffers safely', () => {
      const empty = pcm16ToFloat32(Buffer.alloc(0));
      expect(empty.length).toBe(0);
    });
  });

  // --- Downsampling Calculation ---

  describe('Audio Downsampling Algorithm (downsampleAudio)', () => {
    it('downsamples from 48,000 Hz to 16,000 Hz with exact 3:1 ratio', () => {
      // 48,000 samples at 48kHz = 1 second
      const sampleRateIn = 48000;
      const sampleRateOut = 16000;
      const input = new Float32Array(48000);
      for (let i = 0; i < input.length; i++) input[i] = Math.sin(i * 0.1);

      const output = downsampleAudio(input, sampleRateIn, sampleRateOut);

      // Output should have 16,000 samples (+/- 1 sample rounding)
      expect(output.length).toBe(16000);
      expect(Number.isNaN(output[0])).toBe(false);
      expect(Number.isNaN(output[output.length - 1])).toBe(false);
    });

    it('downsamples from 44,100 Hz to 16,000 Hz with appropriate ratio', () => {
      const sampleRateIn = 44100;
      const sampleRateOut = 16000;
      const input = new Float32Array(44100);

      const output = downsampleAudio(input, sampleRateIn, sampleRateOut);
      expect(output.length).toBe(16000);
    });

    it('returns exact copy when source and target sample rates match', () => {
      const input = new Float32Array([0.1, 0.2, 0.3]);
      const output = downsampleAudio(input, 16000, 16000);

      expect(output.length).toBe(3);
      expect(output[0]).toBeCloseTo(0.1);
      expect(output[1]).toBeCloseTo(0.2);
      expect(output[2]).toBeCloseTo(0.3);
    });

    it('throws error on non-positive sample rates', () => {
      const input = new Float32Array(10);
      expect(() => downsampleAudio(input, 0, 16000)).toThrow();
      expect(() => downsampleAudio(input, 16000, -1)).toThrow();
    });
  });

  // --- Base64 Streaming Conversions ---

  describe('Base64 Encoding & Decoding for WebSocket Streaming', () => {
    it('correctly roundtrips PCM buffer through Base64 representation', () => {
      const original = Buffer.from([0x00, 0x7f, 0x00, 0x80, 0x12, 0x34]);
      const base64 = pcmToBase64(original);

      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);

      const restored = base64ToPcm(base64);
      expect(restored.equals(original)).toBe(true);
    });

    it('handles empty / invalid inputs gracefully', () => {
      expect(pcmToBase64(null)).toBe('');
      expect(base64ToPcm('')).toHaveLength(0);
      expect(base64ToPcm(null)).toHaveLength(0);
    });
  });

  // --- Synthetic Audio Waveform Generation ---

  describe('Synthetic Waveform Test Vectors (generateSineWave)', () => {
    it('generates 16kHz sine wave with correct sample count and bounds', () => {
      const durationSec = 0.5; // 500ms
      const sampleRate = 16000;
      const frequencyHz = 440; // Concert A

      const samples = generateSineWave(frequencyHz, durationSec, sampleRate, 0.8);

      expect(samples.length).toBe(8000); // 16000 * 0.5 = 8000
      let maxVal = -1;
      let minVal = 1;

      for (let i = 0; i < samples.length; i++) {
        if (samples[i] > maxVal) maxVal = samples[i];
        if (samples[i] < minVal) minVal = samples[i];
      }

      expect(maxVal).toBeLessThanOrEqual(0.8001);
      expect(minVal).toBeGreaterThanOrEqual(-0.8001);
    });
  });
});
