/**
 * src/audio/audioRecorder.js
 * Real-time microphone capture, 16kHz downsampling, and PCM16 streaming
 * for Aura Skincare Voice Agent ("Aria").
 *
 * Implements:
 * - Browser mediaDevices getUserMedia with studio acoustic constraints
 * - Web Audio API AudioContext with AnalyserNode for real-time waveform visualizer
 * - ScriptProcessor / Audio Processing pipeline delivering 16kHz 16-bit linear PCM chunks
 * - Clean lifecycle controls: start(), stop(), mute(), cleanup(), getAnalyserNode()
 */

import {
  floatTo16BitPCM,
  downsampleTo16kHz,
  arrayBufferToBase64
} from '../utils/audioConversion.js';

export class AudioRecorder {
  /**
   * @param {Object} [options]
   * @param {number} [options.sampleRate=16000] - Target PCM sample rate
   * @param {number} [options.bufferSize=2048] - Audio processor buffer size (~128ms at 16kHz)
   * @param {Function} [options.onAudioData] - Callback receiving (base64Chunk, arrayBuffer)
   * @param {Function} [options.onError] - Callback receiving (error)
   */
  constructor(options = {}) {
    this.targetSampleRate = options.sampleRate || 16000;
    this.bufferSize = options.bufferSize || 2048;
    this.onAudioData = options.onAudioData || null;
    this.onError = options.onError || null;

    this.audioContext = null;
    this.mediaStream = null;
    this.sourceNode = null;
    this.processorNode = null;
    this.analyserNode = null;
    this.muteGain = null;

    this.isRecording = false;
    this.isMuted = false;
  }

  /**
   * Initializes microphone stream and begins Web Audio processing pipeline.
   * @returns {Promise<void>}
   */
  async start() {
    if (this.isRecording) {
      return;
    }

    try {
      // 1. Validate environment capabilities
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser environment.');
      }

      const AudioContextClass = typeof window !== 'undefined'
        ? (window.AudioContext || window.webkitAudioContext)
        : null;

      if (!AudioContextClass) {
        throw new Error('Web Audio API (AudioContext) is not supported in this browser.');
      }

      // 2. Request microphone stream with voice-optimized acoustic constraints
      const constraints = {
        audio: {
          sampleRate: this.targetSampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // 3. Initialize AudioContext
      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // 4. Setup AnalyserNode for visualizer UI
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.82;

      // 5. Connect Microphone MediaStreamSource
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.analyserNode);

      // 6. Setup Audio Processing Node
      this.processorNode = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);

      this.processorNode.onaudioprocess = (event) => {
        if (!this.isRecording || this.isMuted) {
          return;
        }

        const inputChannelData = event.inputBuffer.getChannelData(0);
        let samples = inputChannelData;

        // Downsample to 16,000 Hz if hardware AudioContext runs at 44.1kHz or 48kHz
        if (this.audioContext.sampleRate !== this.targetSampleRate) {
          samples = downsampleTo16kHz(inputChannelData, this.audioContext.sampleRate);
        }

        // Convert normalized Float32 samples to 16-bit linear PCM Little-Endian ArrayBuffer
        const pcmBuffer = floatTo16BitPCM(samples);
        // Base64 encode for WebSocket transmission
        const base64Chunk = arrayBufferToBase64(pcmBuffer);

        if (this.onAudioData) {
          this.onAudioData(base64Chunk, pcmBuffer);
        }
      };

      // Connect source to processor
      this.sourceNode.connect(this.processorNode);

      // To keep ScriptProcessor active in modern Web Audio implementations without
      // feeding mic audio back through speakers, connect processor to a 0-gain node
      this.muteGain = this.audioContext.createGain();
      this.muteGain.gain.value = 0;
      this.processorNode.connect(this.muteGain);
      this.muteGain.connect(this.audioContext.destination);

      this.isRecording = true;
    } catch (err) {
      this.cleanup();
      if (this.onError) {
        this.onError(err);
      }
      throw err;
    }
  }

  /**
   * Retrieves the AnalyserNode for connecting to the Canvas waveform visualizer.
   * @returns {AnalyserNode|null}
   */
  getAnalyserNode() {
    return this.analyserNode;
  }

  /**
   * Sets microphone mute status without destroying the audio pipeline.
   * @param {boolean} [shouldMute=true]
   */
  mute(shouldMute = true) {
    this.isMuted = Boolean(shouldMute);
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
  }

  /**
   * Stops recording and releases hardware resources.
   */
  stop() {
    this.cleanup();
  }

  /**
   * Full cleanup: stops tracks, disconnects audio nodes, and closes AudioContext.
   */
  cleanup() {
    this.isRecording = false;
    this.isMuted = false;

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
        this.processorNode.onaudioprocess = null;
      } catch (e) {
        /* ignore */
      }
      this.processorNode = null;
    }

    if (this.muteGain) {
      try {
        this.muteGain.disconnect();
      } catch (e) {
        /* ignore */
      }
      this.muteGain = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {
        /* ignore */
      }
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch (e) {
        /* ignore */
      }
      this.analyserNode = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch (e) {
        /* ignore */
      }
      this.mediaStream = null;
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

export default AudioRecorder;
