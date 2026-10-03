/**
 * src/hooks/useVoiceAgent.js
 * React custom hook & Voice Agent Coordinator managing the 6-state visual state machine,
 * WebSocket communications, and Web Audio streaming for Aura Skincare ("Aria").
 *
 * Visual States: Idle, Connecting, Listening, Thinking, Speaking, Ended
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioRecorder } from '../audio/audioRecorder.js';
import { AudioPlayer } from '../audio/audioPlayer.js';

export const CALL_STATES = {
  IDLE: 'Idle',
  CONNECTING: 'Connecting',
  LISTENING: 'Listening',
  THINKING: 'Thinking',
  SPEAKING: 'Speaking',
  ENDED: 'Ended'
};

/**
 * Normalizes state strings received from backend or internal transitions.
 * @param {string} state
 * @returns {string}
 */
export function normalizeCallState(state) {
  if (!state) return CALL_STATES.IDLE;
  const s = String(state).trim().toLowerCase();
  switch (s) {
    case 'idle':
      return CALL_STATES.IDLE;
    case 'connecting':
      return CALL_STATES.CONNECTING;
    case 'listening':
      return CALL_STATES.LISTENING;
    case 'thinking':
      return CALL_STATES.THINKING;
    case 'speaking':
      return CALL_STATES.SPEAKING;
    case 'ended':
      return CALL_STATES.ENDED;
    default:
      return state;
  }
}

/**
 * Resolves target WebSocket URL based on Vite environment variables or browser host.
 * @returns {string}
 */
export function resolveWsUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }

  return 'ws://localhost:3001/ws';
}

/**
 * VoiceAgentCoordinator
 * Pure JavaScript / Web Audio session coordinator managing state, audio pipelines,
 * and WebSocket communication. Framework-agnostic so it can be verified in unit tests
 * and integrated into React hooks.
 */
export class VoiceAgentCoordinator {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || resolveWsUrl();
    this.customWebSocket = options.WebSocket || (typeof WebSocket !== 'undefined' ? WebSocket : null);

    this.state = CALL_STATES.IDLE;
    this.transcripts = [];
    this.toolEvents = [];
    this.callOutcome = null;
    this.error = null;
    this.isMuted = false;

    this.socket = null;
    this.audioRecorder = null;
    this.audioPlayer = null;

    // Listeners
    this.listeners = {
      state: new Set(),
      transcript: new Set(),
      toolEvent: new Set(),
      outcome: new Set(),
      error: new Set(),
      analyser: new Set()
    };
  }

  subscribe(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].add(callback);
      return () => this.listeners[event].delete(callback);
    }
    return () => {};
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[VoiceAgentCoordinator] Error in listener for ${event}:`, e);
        }
      });
    }
  }

  setState(newState) {
    const normalized = normalizeCallState(newState);
    if (this.state !== normalized) {
      this.state = normalized;
      this.emit('state', this.state);
      this.emit('analyser', this.getActiveAnalyserNode());
    }
  }

  getActiveAnalyserNode() {
    if (this.state === CALL_STATES.SPEAKING && this.audioPlayer) {
      return this.audioPlayer.getAnalyserNode();
    }
    if ((this.state === CALL_STATES.LISTENING || this.state === CALL_STATES.THINKING) && this.audioRecorder) {
      return this.audioRecorder.getAnalyserNode();
    }
    return null;
  }

  /**
   * Initiates the voice call session:
   * Requests mic permission, initializes audio subsystems, and establishes WebSocket.
   */
  async startCall() {
    if (this.state !== CALL_STATES.IDLE && this.state !== CALL_STATES.ENDED) {
      return;
    }

    this.error = null;
    this.callOutcome = null;
    this.transcripts = [];
    this.toolEvents = [];
    this.setState(CALL_STATES.CONNECTING);

    try {
      // 1. Initialize AudioPlayer & unlock speaker AudioContext during user click gesture
      this.audioPlayer = new AudioPlayer({
        onPlaybackStateChange: (isPlaying) => {
          if (isPlaying && this.state !== CALL_STATES.SPEAKING && this.state !== CALL_STATES.ENDED) {
            this.setState(CALL_STATES.SPEAKING);
          } else if (!isPlaying && this.state === CALL_STATES.SPEAKING) {
            this.setState(CALL_STATES.LISTENING);
          }
        },
        onError: (err) => {
          console.error('[AudioPlayer Error]:', err);
        }
      });
      await this.audioPlayer.initAudioContext();

      // 2. Initialize AudioRecorder & acquire mic stream during user click gesture
      this.audioRecorder = new AudioRecorder({
        onAudioData: (base64Chunk) => {
          // Stream microphone audio to backend over WebSocket
          if (this.socket && this.socket.readyState === (this.customWebSocket?.OPEN ?? 1)) {
            this.socket.send(JSON.stringify({
              type: 'audio',
              pcm: base64Chunk
            }));
          }
        },
        onError: (err) => {
          console.error('[AudioRecorder Error]:', err);
          this.handleError(err.message || 'Microphone error');
        }
      });
      await this.audioRecorder.start();

      // 3. Connect WebSocket
      const WsClass = this.customWebSocket;
      if (!WsClass) {
        throw new Error('WebSocket is not supported in this environment.');
      }

      this.socket = new WsClass(this.wsUrl);

      this.socket.onopen = () => {
        this.startHeartbeat();
        this.setState(CALL_STATES.LISTENING);
      };

      this.socket.onmessage = (event) => {
        this.handleSocketMessage(event.data);
      };

      this.socket.onerror = (err) => {
        console.error('[WebSocket Error]:', err);
        this.handleError('WebSocket connection error.');
      };

      this.socket.onclose = () => {
        this.cleanupHardware();
        this.setState(CALL_STATES.ENDED);
      };
    } catch (err) {
      this.handleError(err.message || 'Failed to start call');
      this.cleanupHardware();
      this.setState(CALL_STATES.IDLE);
    }
  }

  /**
   * Starts a 15-second heartbeat ping to prevent proxy/NAT/server timeouts during silence.
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === (this.customWebSocket?.OPEN ?? 1)) {
        try {
          this.socket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (e) {
          /* ignore */
        }
      }
    }, 15000);
  }

  /**
   * Stops the heartbeat interval.
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handles incoming WebSocket messages from the backend relay.
   * @param {string|ArrayBuffer} data
   */
  handleSocketMessage(data) {
    try {
      if (!data) return;
      const message = typeof data === 'string' ? JSON.parse(data) : JSON.parse(new TextDecoder().decode(data));

      switch (message.type) {
        case 'heartbeat':
        case 'pong':
          // Keep-alive acknowledgment received
          break;

        case 'status':
          if (message.state) {
            this.setState(message.state);
          }
          break;

        case 'audio':
          if (message.pcm && this.audioPlayer) {
            this.audioPlayer.queueAudioChunk(message.pcm);
            this.setState(CALL_STATES.SPEAKING);
          }
          break;

        case 'interrupted':
          // Immediate zero-latency barge-in flush
          if (this.audioPlayer) {
            this.audioPlayer.interrupt();
          }
          this.setState(CALL_STATES.LISTENING);
          break;

        case 'transcript':
          if (message.text !== undefined && message.text !== null) {
            const role = message.role || 'aria';
            const turnId = message.turnId;
            const isFinal = Boolean(message.isFinal);

            // Locate active turn to update in-place, or create new turn
            let existingIndex = -1;
            if (turnId) {
              existingIndex = this.transcripts.findIndex((t) => t.turnId === turnId);
            }
            if (existingIndex === -1 && this.transcripts.length > 0) {
              const last = this.transcripts[this.transcripts.length - 1];
              if (!last.isFinal && last.role === role && (!turnId || !last.turnId)) {
                existingIndex = this.transcripts.length - 1;
              }
            }

            if (existingIndex !== -1) {
              this.transcripts[existingIndex] = {
                ...this.transcripts[existingIndex],
                text: message.text,
                isFinal: isFinal || this.transcripts[existingIndex].isFinal,
                timestamp: message.timestamp || this.transcripts[existingIndex].timestamp
              };
            } else {
              const transcriptItem = {
                id: message.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                turnId: turnId || `turn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                role: role,
                text: message.text,
                timestamp: message.timestamp || new Date().toISOString(),
                isFinal: isFinal
              };
              this.transcripts.push(transcriptItem);
            }
            this.emit('transcript', [...this.transcripts]);
          }
          break;

        case 'tool_event':
          this.toolEvents.push(message);
          this.emit('toolEvent', [...this.toolEvents]);
          // When a tool is executing, update state to thinking
          this.setState(CALL_STATES.THINKING);
          break;

        case 'call_outcome':
          if (message.data) {
            this.callOutcome = message.data;
            this.emit('outcome', this.callOutcome);
            this.setState(CALL_STATES.ENDED);
          }
          break;

        case 'error':
          this.handleError(message.message || 'Server error occurred');
          break;

        default:
          break;
      }
    } catch (err) {
      console.error('[VoiceAgentCoordinator] Message parse error:', err);
    }
  }

  /**
   * Sends text query from test helper buttons (e.g. "Track ORD-101")
   * @param {string} text
   */
  sendTextMessage(text) {
    if (!text || !this.socket || this.socket.readyState !== (this.customWebSocket?.OPEN ?? 1)) {
      return;
    }

    this.socket.send(JSON.stringify({
      type: 'text_input',
      text: text.trim()
    }));

    // Record user text in transcript
    const userTurn = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString()
    };
    this.transcripts.push(userTurn);
    this.emit('transcript', [...this.transcripts]);
    this.setState(CALL_STATES.THINKING);
  }

  /**
   * Mutes / unmutes the microphone.
   * @param {boolean} [shouldMute]
   */
  toggleMute(shouldMute) {
    this.isMuted = typeof shouldMute === 'boolean' ? shouldMute : !this.isMuted;
    if (this.audioRecorder) {
      this.audioRecorder.mute(this.isMuted);
    }
  }

  handleError(msg) {
    this.error = msg;
    this.emit('error', this.error);
  }

  /**
   * Concludes the call, signals backend, and transitions to Ended.
   */
  endCall() {
    if (this.socket && this.socket.readyState === (this.customWebSocket?.OPEN ?? 1)) {
      try {
        this.socket.send(JSON.stringify({ type: 'end_call' }));
      } catch (e) {
        /* ignore */
      }
    }

    // Stop audio immediately so we stop listening/speaking
    if (this.audioRecorder) {
      try { this.audioRecorder.cleanup(); } catch (e) {}
      this.audioRecorder = null;
    }
    if (this.audioPlayer) {
      try { this.audioPlayer.cleanup(); } catch (e) {}
      this.audioPlayer = null;
    }

    // Do NOT close the socket here (leave this.cleanupHardware() for onclose)
    // The backend needs time to generate and send the call_outcome JSON before it closes the socket.
    this.setState(CALL_STATES.ENDED);
  }

  /**
   * Cleans up audio contexts and media streams.
   */
  cleanupHardware() {
    this.stopHeartbeat();

    if (this.audioRecorder) {
      try {
        this.audioRecorder.cleanup();
      } catch (e) {}
      this.audioRecorder = null;
    }

    if (this.audioPlayer) {
      try {
        this.audioPlayer.cleanup();
      } catch (e) {}
      this.audioPlayer = null;
    }

    if (this.socket) {
      try {
        if (this.socket.readyState === (this.customWebSocket?.OPEN ?? 1)) {
          this.socket.close();
        }
      } catch (e) {}
      this.socket = null;
    }
  }

  /**
   * Resets coordinator back to Idle state.
   */
  resetCall() {
    this.cleanupHardware();
    this.setState(CALL_STATES.IDLE);
    this.error = null;
  }
}

/**
 * React Hook useVoiceAgent for Aura Skincare Voice Agent.
 */
export function useVoiceAgent(options = {}) {

  const [callState, setCallState] = useState(CALL_STATES.IDLE);
  const [transcripts, setTranscripts] = useState([]);
  const [toolEvents, setToolEvents] = useState([]);
  const [callOutcome, setCallOutcome] = useState(null);
  const [error, setError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [activeAnalyserNode, setActiveAnalyserNode] = useState(null);

  const coordinatorRef = useRef(null);

  if (!coordinatorRef.current) {
    coordinatorRef.current = new VoiceAgentCoordinator(options);
  }

  useEffect(() => {
    const coordinator = coordinatorRef.current;

    const unsubState = coordinator.subscribe('state', (newState) => {
      setCallState(newState);
      setActiveAnalyserNode(coordinator.getActiveAnalyserNode());
    });

    const unsubTranscript = coordinator.subscribe('transcript', (updatedTranscripts) => {
      setTranscripts(updatedTranscripts);
    });

    const unsubToolEvent = coordinator.subscribe('toolEvent', (events) => {
      setToolEvents(events);
    });

    const unsubOutcome = coordinator.subscribe('outcome', (outcome) => {
      setCallOutcome(outcome);
    });

    const unsubError = coordinator.subscribe('error', (err) => {
      setError(err);
    });

    const unsubAnalyser = coordinator.subscribe('analyser', (analyser) => {
      setActiveAnalyserNode(analyser);
    });

    return () => {
      unsubState();
      unsubTranscript();
      unsubToolEvent();
      unsubOutcome();
      unsubError();
      unsubAnalyser();
      coordinator.cleanupHardware();
    };
  }, []);

  const startCall = useCallback(() => {
    return coordinatorRef.current.startCall();
  }, []);

  const endCall = useCallback(() => {
    return coordinatorRef.current.endCall();
  }, []);

  const sendTextMessage = useCallback((text) => {
    return coordinatorRef.current.sendTextMessage(text);
  }, []);

  const toggleMute = useCallback((shouldMute) => {
    coordinatorRef.current.toggleMute(shouldMute);
    setIsMuted(coordinatorRef.current.isMuted);
  }, []);

  const resetCall = useCallback(() => {
    coordinatorRef.current.resetCall();
    setTranscripts([]);
    setToolEvents([]);
    setCallOutcome(null);
    setError(null);
  }, []);

  const getAnalyserNode = useCallback(() => {
    return coordinatorRef.current?.getActiveAnalyserNode() || null;
  }, []);

  const isCallActive = callState === CALL_STATES.CONNECTING ||
                       callState === CALL_STATES.LISTENING ||
                       callState === CALL_STATES.THINKING ||
                       callState === CALL_STATES.SPEAKING;

  return {
    callState,
    isCallActive,
    startCall,
    endCall,
    resetCall,
    sendTextMessage,
    toggleMute,
    isMuted,
    transcripts,
    toolEvents,
    callOutcome,
    error,
    activeAnalyserNode,
    getAnalyserNode,
    coordinator: coordinatorRef.current
  };
}

export default useVoiceAgent;
