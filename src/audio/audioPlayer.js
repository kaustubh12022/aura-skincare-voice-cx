/**
 * src/audio/audioPlayer.js
 * High-fidelity 24kHz PCM audio playback queue with instant barge-in interruption
 * for Aura Skincare Voice Agent ("Aria").
 *
 * Implements:
 * - 24,000 Hz 16-bit linear PCM chunk decoding and Web Audio buffer creation
 * - Monotonic timeline scheduling for seamless, gapless speech playback
 * - AnalyserNode integration for agent speech visualization
 * - Instant interruption / barge-in flushing (zero-latency source termination)
 */

import {
  pcm16ToFloat32,
  base64ToArrayBuffer
} from '../utils/audioConversion.js';

export class AudioPlayer {
  /**
   * @param {Object} [options]
   * @param {number} [options.sampleRate=24000] - Sample rate of incoming Gemini audio
   * @param {Function} [options.onPlaybackStateChange] - Callback receiving (isPlaying: boolean)
   * @param {Function} [options.onError] - Callback receiving (error)
   */
  constructor(options = {}) {
    this.targetSampleRate = options.sampleRate || 24000;
    this.onPlaybackStateChange = options.onPlaybackStateChange || null;
    this.onError = options.onError || null;

    this.audioContext = null;
    this.analyserNode = null;
    this.gainNode = null;

    this.nextPlayTime = 0;
    this.activeSources = new Set();
    this.isPlaying = false;
    this.totalQueuedChunks = 0;
  }

  /**
   * Initializes or resumes the Web Audio context and node graph.
   * @returns {Promise<AudioContext>}
   */
  async initAudioContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioContextClass = typeof window !== 'undefined'
        ? (window.AudioContext || window.webkitAudioContext)
        : null;

      if (!AudioContextClass) {
        throw new Error('Web Audio API (AudioContext) is not supported in this environment.');
      }

      // Attempt to initialize context at target 24kHz rate, falling back to default
      try {
        this.audioContext = new AudioContextClass({ sampleRate: this.targetSampleRate });
      } catch (err) {
        this.audioContext = new AudioContextClass();
      }

      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.82;

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 1.0;

      // Audio Graph: Source -> Analyser -> Gain -> Destination
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      this.nextPlayTime = 0;
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    return this.audioContext;
  }

  /**
   * Returns AnalyserNode for connecting to the Canvas waveform visualizer.
   * @returns {AnalyserNode|null}
   */
  getAnalyserNode() {
    return this.analyserNode;
  }

  /**
   * Enqueues and schedules a 24kHz 16-bit linear PCM audio chunk for gapless playback.
   *
   * @param {string|ArrayBuffer|Uint8Array|Buffer} pcmData - Base64 string or binary PCM chunk
   * @returns {Promise<void>}
   */
  async queueAudioChunk(pcmData) {
    if (!pcmData) {
      return;
    }

    try {
      await this.initAudioContext();

      // 1. Decode PCM chunk into binary ArrayBuffer
      let rawBuffer;
      if (typeof pcmData === 'string') {
        rawBuffer = base64ToArrayBuffer(pcmData);
      } else if (pcmData instanceof ArrayBuffer) {
        rawBuffer = pcmData;
      } else if (ArrayBuffer.isView(pcmData)) {
        rawBuffer = pcmData.buffer.slice(pcmData.byteOffset, pcmData.byteOffset + pcmData.byteLength);
      } else {
        return;
      }

      // 2. Convert 16-bit PCM Little-Endian bytes to normalized Float32 samples
      const float32Samples = pcm16ToFloat32(rawBuffer);
      if (float32Samples.length === 0) {
        return;
      }

      // 3. Create Web Audio buffer (Web Audio automatically resamples buffer to hardware rate if needed)
      const audioBuffer = this.audioContext.createBuffer(1, float32Samples.length, this.targetSampleRate);
      audioBuffer.copyToChannel(float32Samples, 0);

      // 4. Create and configure AudioBufferSourceNode
      const sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.analyserNode);

      // 5. Monotonic Timeline Scheduling (prevents clicks, jitter, and gaps)
      const currentTime = this.audioContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        // If buffer ran dry or starting afresh, lead by a tiny 25ms safety window
        this.nextPlayTime = currentTime + 0.025;
      }

      const scheduledStartTime = this.nextPlayTime;
      sourceNode.start(scheduledStartTime);
      this.nextPlayTime += audioBuffer.duration;

      // 6. Track active source node for immediate interruption capability
      this.activeSources.add(sourceNode);
      this.totalQueuedChunks++;

      if (!this.isPlaying) {
        this.isPlaying = true;
        if (this.onPlaybackStateChange) {
          this.onPlaybackStateChange(true);
        }
      }

      sourceNode.onended = () => {
        this.activeSources.delete(sourceNode);
        if (this.activeSources.size === 0) {
          this.isPlaying = false;
          if (this.onPlaybackStateChange) {
            this.onPlaybackStateChange(false);
          }
        }
      };
    } catch (err) {
      if (this.onError) {
        this.onError(err);
      }
    }
  }

  /**
   * CRITICAL: Instant Barge-In Interruption.
   * Immediately terminates all currently playing and scheduled hardware audio sources,
   * empties the queue, and resets the playback timeline to current time.
   */
  interrupt() {
    this.stopPlayback();
  }

  /**
   * Immediately stops all audio output and flushes the queue.
   */
  stopPlayback() {
    for (const source of this.activeSources) {
      try {
        source.stop(0);
        source.disconnect();
      } catch (e) {
        // Source may already have completed naturally
      }
    }

    this.activeSources.clear();

    if (this.audioContext) {
      this.nextPlayTime = this.audioContext.currentTime;
    } else {
      this.nextPlayTime = 0;
    }

    if (this.isPlaying) {
      this.isPlaying = false;
      if (this.onPlaybackStateChange) {
        this.onPlaybackStateChange(false);
      }
    }
  }

  /**
   * Full teardown of player resources and audio context.
   */
  cleanup() {
    this.stopPlayback();

    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch (e) {
        /* ignore */
      }
      this.gainNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch (e) {
        /* ignore */
      }
      this.analyserNode = null;
    }

    if (this.audioContext) {
      try {
        if (this.audioContext.state !== 'closed') {
          this.audioContext.close();
        }
      } catch (e) {
        /* ignore */
      }
      this.audioContext = null;
    }
  }
}

export default AudioPlayer;
