/**
 * tests/unit/webAudio.test.js
 * Comprehensive unit test suite for Milestone 2 Web Audio Engine & State Coordinator:
 * - 16-bit linear PCM conversion with saturation clipping protection
 * - Float32 reconstruction & quantization precision
 * - Linear interpolation downsampling to 16,000 Hz
 * - Base64 binary codec roundtripping
 * - AudioPlayer gapless scheduling & instant barge-in interruption flushing
 * - VoiceAgentCoordinator 6-state visual state machine & protocol events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  floatTo16BitPCM,
  pcm16ToFloat32,
  downsampleTo16kHz,
  downsampleAudio,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  pcmToBase64,
  base64ToPcm
} from '../../src/utils/audioConversion.js';
import { AudioPlayer } from '../../src/audio/audioPlayer.js';
import { AudioRecorder } from '../../src/audio/audioRecorder.js';
import {
  VoiceAgentCoordinator,
  CALL_STATES,
  normalizeCallState
} from '../../src/hooks/useVoiceAgent.js';

// --- Mock Web Audio Context for Node.js Testing ---
class MockAudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._data = new Float32Array(length);
  }
  copyToChannel(source, channelNumber) {
    this._data.set(source);
  }
  getChannelData(channelNumber) {
    return this._data;
  }
}

class MockAudioBufferSourceNode {
  constructor(context) {
    this.context = context;
    this.buffer = null;
    this.startTime = null;
    this.stoppedTime = null;
    this.isStopped = false;
    this.onended = null;
  }
  connect(dest) {}
  disconnect() {}
  start(when) {
    this.startTime = when;
  }
  stop(when) {
    this.stoppedTime = when;
    this.isStopped = true;
    if (this.onended) {
      this.onended();
    }
  }
}

class MockAnalyserNode {
  constructor() {
    this.fftSize = 256;
    this.smoothingTimeConstant = 0.82;
  }
  connect(dest) {}
  disconnect() {}
}

class MockGainNode {
  constructor() {
    this.gain = { value: 1.0 };
  }
  connect(dest) {}
  disconnect() {}
}

class MockAudioContext {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 24000;
    this.currentTime = 10.0; // Simulated timeline cursor
    this.state = 'running';
    this.destination = {};
  }
  createBuffer(channels, length, rate) {
    return new MockAudioBuffer(channels, length, rate);
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode(this);
  }
  createAnalyser() {
    return new MockAnalyserNode();
  }
  createGain() {
    return new MockGainNode();
  }
  async resume() {
    this.state = 'running';
  }
  async close() {
    this.state = 'closed';
  }
}

describe('Milestone 2: Web Audio Engine & Audio Conversion Tests', () => {
  // =========================================================================
  // 1. floatTo16BitPCM & pcm16ToFloat32 Tests
  // =========================================================================
  describe('floatTo16BitPCM (Linear PCM 16-Bit Little-Endian Encoding)', () => {
    it('TC-2.1.1: converts silence (0.0) to zero int16 bytes', () => {
      const float32 = new Float32Array([0.0, 0.0, 0.0]);
      const arrayBuffer = floatTo16BitPCM(float32);

      expect(arrayBuffer.byteLength).toBe(6); // 3 samples * 2 bytes = 6 bytes
      const view = new DataView(arrayBuffer);
      expect(view.getInt16(0, true)).toBe(0);
      expect(view.getInt16(2, true)).toBe(0);
      expect(view.getInt16(4, true)).toBe(0);
    });

    it('TC-2.1.2: converts maximum positive amplitude (+1.0) to +32767 (0x7FFF)', () => {
      const float32 = new Float32Array([1.0]);
      const arrayBuffer = floatTo16BitPCM(float32);

      expect(arrayBuffer.byteLength).toBe(2);
      const view = new DataView(arrayBuffer);
      expect(view.getInt16(0, true)).toBe(32767);
    });

    it('TC-2.1.3: converts maximum negative amplitude (-1.0) to -32768 (-0x8000)', () => {
      const float32 = new Float32Array([-1.0]);
      const arrayBuffer = floatTo16BitPCM(float32);

      expect(arrayBuffer.byteLength).toBe(2);
      const view = new DataView(arrayBuffer);
      expect(view.getInt16(0, true)).toBe(-32768);
    });

    it('TC-2.1.4: clipping protection prevents overflow on positive over-range values (+1.5, +3.0)', () => {
      const float32 = new Float32Array([1.5, 3.0, 10.0]);
      const arrayBuffer = floatTo16BitPCM(float32);

      const view = new DataView(arrayBuffer);
      expect(view.getInt16(0, true)).toBe(32767);
      expect(view.getInt16(2, true)).toBe(32767);
      expect(view.getInt16(4, true)).toBe(32767);
    });

    it('TC-2.1.5: clipping protection prevents underflow on negative over-range values (-1.8, -5.0)', () => {
      const float32 = new Float32Array([-1.8, -5.0, -100.0]);
      const arrayBuffer = floatTo16BitPCM(float32);

      const view = new DataView(arrayBuffer);
      expect(view.getInt16(0, true)).toBe(-32768);
      expect(view.getInt16(2, true)).toBe(-32768);
      expect(view.getInt16(4, true)).toBe(-32768);
    });

    it('TC-2.1.6: safely handles empty, null, or undefined input', () => {
      expect(floatTo16BitPCM([]).byteLength).toBe(0);
      expect(floatTo16BitPCM(new Float32Array(0)).byteLength).toBe(0);
      expect(floatTo16BitPCM(null).byteLength).toBe(0);
      expect(floatTo16BitPCM(undefined).byteLength).toBe(0);
    });
  });

  describe('pcm16ToFloat32 (Linear PCM Reconstruction & Precision)', () => {
    it('TC-2.2.1: roundtrips Float32 values with high numerical fidelity (< 0.001 quantization error)', () => {
      const original = new Float32Array([0.0, 0.5, -0.5, 0.25, -0.75, 1.0, -1.0]);
      const pcmBuffer = floatTo16BitPCM(original);
      const restored = pcm16ToFloat32(pcmBuffer);

      expect(restored.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(Math.abs(restored[i] - original[i])).toBeLessThan(0.001);
      }
    });

    it('TC-2.2.2: supports Int16Array, ArrayBuffer, and Uint8Array input types', () => {
      const int16 = new Int16Array([0, 16384, -16384]);
      const fromInt16 = pcm16ToFloat32(int16);
      expect(fromInt16.length).toBe(3);
      expect(fromInt16[0]).toBe(0);
      expect(fromInt16[1]).toBeCloseTo(0.5, 2);
      expect(fromInt16[2]).toBeCloseTo(-0.5, 2);

      const fromArrayBuffer = pcm16ToFloat32(int16.buffer);
      expect(fromArrayBuffer.length).toBe(3);
      expect(fromArrayBuffer[1]).toBeCloseTo(0.5, 2);

      const fromUint8 = pcm16ToFloat32(new Uint8Array(int16.buffer));
      expect(fromUint8.length).toBe(3);
      expect(fromUint8[1]).toBeCloseTo(0.5, 2);
    });

    it('TC-2.2.3: returns empty Float32Array on empty or invalid buffer', () => {
      expect(pcm16ToFloat32(null).length).toBe(0);
      expect(pcm16ToFloat32(new ArrayBuffer(0)).length).toBe(0);
    });
  });

  // =========================================================================
  // 2. downsampleTo16kHz & downsampleAudio Tests
  // =========================================================================
  describe('downsampleTo16kHz & Audio Resampling Calculations', () => {
    it('TC-2.3.1: downsamples 48kHz audio to 16kHz with exact 3:1 sample count ratio', () => {
      // 48,000 samples (1 second at 48kHz)
      const input48k = new Float32Array(48000);
      for (let i = 0; i < input48k.length; i++) {
        input48k[i] = Math.sin((i / 48000) * 2 * Math.PI * 440); // 440 Hz tone
      }

      const output16k = downsampleTo16kHz(input48k, 48000);

      expect(output16k.length).toBe(16000);
      expect(Number.isNaN(output16k[0])).toBe(false);
      expect(Number.isNaN(output16k[output16k.length - 1])).toBe(false);
    });

    it('TC-2.3.2: downsamples 44.1kHz audio to 16kHz with accurate ratio calculations', () => {
      // 44,100 samples (1 second at 44.1kHz)
      const input44k = new Float32Array(44100);
      for (let i = 0; i < input44k.length; i++) {
        input44k[i] = 0.5 * Math.sin(i * 0.05);
      }

      const output16k = downsampleTo16kHz(input44k, 44100);

      // 44100 / (44100 / 16000) = 16000
      expect(output16k.length).toBe(16000);
    });

    it('TC-2.3.3: returns identical buffer when source sample rate is already 16kHz', () => {
      const input16k = new Float32Array([0.1, 0.25, -0.4, 0.8]);
      const output = downsampleTo16kHz(input16k, 16000);

      expect(output.length).toBe(input16k.length);
      for (let i = 0; i < input16k.length; i++) {
        expect(output[i]).toBeCloseTo(input16k[i]);
      }
    });

    it('TC-2.3.4: preserves constant DC audio level across downsampling window', () => {
      const input = new Float32Array(300).fill(0.75);
      const output = downsampleAudio(input, 48000, 16000);

      expect(output.length).toBe(100);
      for (let i = 0; i < output.length; i++) {
        expect(output[i]).toBeCloseTo(0.75, 4);
      }
    });

    it('TC-2.3.5: throws on zero or negative sample rates', () => {
      const input = new Float32Array(10);
      expect(() => downsampleTo16kHz(input, 0)).toThrow(/positive/);
      expect(() => downsampleAudio(input, 48000, -100)).toThrow(/positive/);
    });

    it('TC-2.3.6: handles empty buffer gracefully', () => {
      expect(downsampleTo16kHz(new Float32Array(0), 48000).length).toBe(0);
      expect(downsampleTo16kHz(null, 48000).length).toBe(0);
    });
  });

  // =========================================================================
  // 3. Base64 Binary Codec Tests
  // =========================================================================
  describe('Base64 Binary Codec (arrayBufferToBase64 & base64ToArrayBuffer)', () => {
    it('TC-2.4.1: perfectly roundtrips binary PCM ArrayBuffer through Base64 string', () => {
      const originalBytes = new Uint8Array([0x00, 0x7f, 0x12, 0x34, 0xff, 0xfe, 0x5a, 0xa5]);
      const base64 = arrayBufferToBase64(originalBytes.buffer);

      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);

      const restoredBuffer = base64ToArrayBuffer(base64);
      const restoredBytes = new Uint8Array(restoredBuffer);

      expect(restoredBytes.length).toBe(originalBytes.length);
      for (let i = 0; i < originalBytes.length; i++) {
        expect(restoredBytes[i]).toBe(originalBytes[i]);
      }
    });

    it('TC-2.4.2: chunked processing handles large buffers (>64KB) without stack overflow', () => {
      const largeBytes = new Uint8Array(70000);
      for (let i = 0; i < largeBytes.length; i++) {
        largeBytes[i] = i % 256;
      }

      const base64 = arrayBufferToBase64(largeBytes.buffer);
      const decodedBuffer = base64ToArrayBuffer(base64);
      const decodedBytes = new Uint8Array(decodedBuffer);

      expect(decodedBytes.length).toBe(largeBytes.length);
      expect(decodedBytes[0]).toBe(0);
      expect(decodedBytes[255]).toBe(255);
      expect(decodedBytes[69999]).toBe(69999 % 256);
    });

    it('TC-2.4.3: handles empty or invalid inputs gracefully', () => {
      expect(arrayBufferToBase64(null)).toBe('');
      expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe('');
      expect(base64ToArrayBuffer('')).toHaveProperty('byteLength', 0);
      expect(base64ToArrayBuffer(null)).toHaveProperty('byteLength', 0);
    });

    it('TC-2.4.4: alias exports pcmToBase64 and base64ToPcm match primary functions', () => {
      expect(pcmToBase64).toBe(arrayBufferToBase64);
      expect(base64ToPcm).toBe(base64ToArrayBuffer);
    });
  });

  // =========================================================================
  // 4. AudioPlayer Interruption & Barge-in Flushing Tests
  // =========================================================================
  describe('AudioPlayer (Gapless Scheduling & Instant Barge-in Interruption)', () => {
    let mockContext;
    let player;

    beforeEach(() => {
      mockContext = new MockAudioContext();
      // Inject mock AudioContext
      globalThis.window = {
        AudioContext: vi.fn(() => mockContext)
      };
      player = new AudioPlayer({ sampleRate: 24000 });
    });

    it('TC-2.5.1: schedules contiguous audio chunks forward monotonically on the timeline', async () => {
      // 2400 samples at 24kHz = 0.1 second (100ms)
      const float32Chunk = new Float32Array(2400).fill(0.2);
      const pcm1 = floatTo16BitPCM(float32Chunk);
      const pcm2 = floatTo16BitPCM(float32Chunk);

      await player.queueAudioChunk(pcm1);
      const scheduledTime1 = player.nextPlayTime;
      expect(scheduledTime1).toBeGreaterThan(mockContext.currentTime);

      await player.queueAudioChunk(pcm2);
      const scheduledTime2 = player.nextPlayTime;

      // Second chunk must schedule exactly duration (0.1s) after first
      expect(scheduledTime2).toBeCloseTo(scheduledTime1 + 0.1, 3);
      expect(player.activeSources.size).toBe(2);
      expect(player.isPlaying).toBe(true);
    });

    it('TC-2.5.2: CRITICAL: interrupt() / stopPlayback() immediately terminates all active source nodes with stop(0)', async () => {
      const float32Chunk = new Float32Array(2400).fill(0.1);
      const pcm = floatTo16BitPCM(float32Chunk);

      await player.queueAudioChunk(pcm);
      await player.queueAudioChunk(pcm);
      await player.queueAudioChunk(pcm);

      expect(player.activeSources.size).toBe(3);

      const capturedSources = Array.from(player.activeSources);

      // Execute instant barge-in interruption
      player.interrupt();

      // All source nodes must have had stop(0) called
      for (const src of capturedSources) {
        expect(src.isStopped).toBe(true);
        expect(src.stoppedTime).toBe(0);
      }

      // Active sources set must be immediately flushed to empty
      expect(player.activeSources.size).toBe(0);
      expect(player.isPlaying).toBe(false);
      // Timeline cursor must be reset to current audio context time
      expect(player.nextPlayTime).toBe(mockContext.currentTime);
    });

    it('TC-2.5.3: queuing new chunk after interruption schedules cleanly without using stale timestamp', async () => {
      const pcm = floatTo16BitPCM(new Float32Array(2400).fill(0.1));

      await player.queueAudioChunk(pcm);
      await player.queueAudioChunk(pcm);
      const staleScheduledTime = player.nextPlayTime;

      // Interruption occurs
      player.interrupt();
      expect(player.nextPlayTime).toBe(mockContext.currentTime);

      // Advance mock timeline to simulate time passing during user speech
      mockContext.currentTime = 15.0;

      // New utterance arrives from agent
      await player.queueAudioChunk(pcm);

      // Should schedule near new currentTime (15.0 + 0.025), not stale time
      expect(player.nextPlayTime).toBeGreaterThan(15.0);
      expect(player.nextPlayTime).toBeLessThan(16.0);
      expect(player.activeSources.size).toBe(1);
    });

    it('TC-2.5.4: cleanup() flushes playback and closes audioContext', async () => {
      const pcm = floatTo16BitPCM(new Float32Array(2400));
      await player.queueAudioChunk(pcm);

      player.cleanup();
      expect(player.activeSources.size).toBe(0);
      expect(player.isPlaying).toBe(false);
      expect(mockContext.state).toBe('closed');
    });
  });

  // =========================================================================
  // 5. VoiceAgentCoordinator 6-State Visual State Machine Tests
  // =========================================================================
  describe('VoiceAgentCoordinator (6-State Visual State Machine & Protocol)', () => {
    let coordinator;
    let mockWs;

    class MockWebSocket {
      static OPEN = 1;
      constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.OPEN;
        this.sentMessages = [];
        mockWs = this;
      }
      send(data) {
        this.sentMessages.push(data);
      }
      close() {
        this.readyState = 3;
        if (this.onclose) this.onclose();
      }
    }

    beforeEach(() => {
      coordinator = new VoiceAgentCoordinator({
        WebSocket: MockWebSocket,
        wsUrl: 'ws://test-server/ws'
      });
    });

    it('TC-2.6.1: starts in Idle state and transitions to Connecting then Listening', async () => {
      expect(coordinator.state).toBe(CALL_STATES.IDLE);

      // Mock audio recorder and player start
      vi.spyOn(AudioRecorder.prototype, 'start').mockResolvedValue();
      vi.spyOn(AudioPlayer.prototype, 'initAudioContext').mockResolvedValue({});
      vi.spyOn(coordinator, 'getActiveAnalyserNode').mockReturnValue({});

      const stateTransitions = [];
      coordinator.subscribe('state', (state) => stateTransitions.push(state));

      await coordinator.startCall();
      expect(stateTransitions).toContain(CALL_STATES.CONNECTING);

      // Trigger socket onopen
      await mockWs.onopen();
      expect(coordinator.state).toBe(CALL_STATES.LISTENING);
    });

    it('TC-2.6.2: handles incoming audio chunk and transitions to Speaking', () => {
      const float32Chunk = new Float32Array(480).fill(0.1);
      const base64Pcm = arrayBufferToBase64(floatTo16BitPCM(float32Chunk));

      coordinator.audioPlayer = new AudioPlayer();
      const queueSpy = vi.spyOn(coordinator.audioPlayer, 'queueAudioChunk').mockResolvedValue();

      coordinator.handleSocketMessage(JSON.stringify({
        type: 'audio',
        pcm: base64Pcm
      }));

      expect(queueSpy).toHaveBeenCalledWith(base64Pcm);
      expect(coordinator.state).toBe(CALL_STATES.SPEAKING);
    });

    it('TC-2.6.3: handles interrupted event by triggering player interrupt and returning to Listening', () => {
      coordinator.audioPlayer = new AudioPlayer();
      const interruptSpy = vi.spyOn(coordinator.audioPlayer, 'interrupt');
      coordinator.setState(CALL_STATES.SPEAKING);

      coordinator.handleSocketMessage(JSON.stringify({
        type: 'interrupted'
      }));

      expect(interruptSpy).toHaveBeenCalled();
      expect(coordinator.state).toBe(CALL_STATES.LISTENING);
    });

    it('TC-2.6.4: tracks tool_event by updating state to Thinking', () => {
      coordinator.handleSocketMessage(JSON.stringify({
        type: 'tool_event',
        tool: 'get_order_details',
        args: { order_id: 'ORD-101' },
        result: { status: 'Out for Delivery' }
      }));

      expect(coordinator.state).toBe(CALL_STATES.THINKING);
      expect(coordinator.toolEvents.length).toBe(1);
      expect(coordinator.toolEvents[0].tool).toBe('get_order_details');
    });

    it('TC-2.6.5: appends chronological transcript turns from user and agent', () => {
      coordinator.handleSocketMessage(JSON.stringify({
        type: 'transcript',
        role: 'user',
        text: 'Where is my order ORD-101?'
      }));

      coordinator.handleSocketMessage(JSON.stringify({
        type: 'transcript',
        role: 'aria',
        text: 'Your order is currently out for delivery with BlueDart.'
      }));

      expect(coordinator.transcripts.length).toBe(2);
      expect(coordinator.transcripts[0].role).toBe('user');
      expect(coordinator.transcripts[0].text).toContain('ORD-101');
      expect(coordinator.transcripts[1].role).toBe('aria');
      expect(coordinator.transcripts[1].text).toContain('BlueDart');
    });

    it('TC-2.6.6: receives call_outcome and transitions to Ended', () => {
      const outcomeData = {
        customer_intent: 'order_tracking',
        order_id: 'ORD-101',
        resolution_status: 'resolved',
        call_summary: 'Customer checked delivery status of ORD-101.'
      };

      coordinator.handleSocketMessage(JSON.stringify({
        type: 'call_outcome',
        data: outcomeData
      }));

      expect(coordinator.state).toBe(CALL_STATES.ENDED);
      expect(coordinator.callOutcome).toEqual(outcomeData);
    });

    it('TC-2.6.7: endCall() sends end_call control frame and sets state to Ended', () => {
      coordinator.socket = mockWs;
      coordinator.audioPlayer = new AudioPlayer();
      const stopSpy = vi.spyOn(coordinator.audioPlayer, 'cleanup');

      coordinator.endCall();

      expect(mockWs.sentMessages).toContain(JSON.stringify({ type: 'end_call' }));
      expect(coordinator.state).toBe(CALL_STATES.ENDED);
      expect(stopSpy).toHaveBeenCalled();
    });

    it('TC-2.6.8: normalizeCallState properly handles case variations', () => {
      expect(normalizeCallState('idle')).toBe('Idle');
      expect(normalizeCallState('connecting')).toBe('Connecting');
      expect(normalizeCallState('listening')).toBe('Listening');
      expect(normalizeCallState('thinking')).toBe('Thinking');
      expect(normalizeCallState('speaking')).toBe('Speaking');
      expect(normalizeCallState('ended')).toBe('Ended');
      expect(normalizeCallState('Listening')).toBe('Listening');
    });
  });

  // =========================================================================
  // 6. AudioRecorder Lifecycle & Controls
  // =========================================================================
  describe('AudioRecorder Lifecycle & Controls', () => {
    it('TC-2.7.1: initializes with 16kHz defaults and tracks mute state', () => {
      const recorder = new AudioRecorder();
      expect(recorder.targetSampleRate).toBe(16000);
      expect(recorder.isRecording).toBe(false);
      expect(recorder.isMuted).toBe(false);

      recorder.mute(true);
      expect(recorder.isMuted).toBe(true);

      recorder.mute(false);
      expect(recorder.isMuted).toBe(false);
    });

    it('TC-2.7.2: cleanup releases resources safely without throwing', () => {
      const recorder = new AudioRecorder();
      expect(() => recorder.cleanup()).not.toThrow();
      expect(recorder.isRecording).toBe(false);
      expect(recorder.mediaStream).toBe(null);
      expect(recorder.audioContext).toBe(null);
    });
  });
});
