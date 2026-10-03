/**
 * server/geminiLiveRelay.js
 * Aura Skincare AI Voice Agent ("Aria") - Gemini Live WebSocket Relay
 *
 * Manages upstream WebSocket connection to Google Gemini Live API,
 * audio streaming, tool calling execution, interruption handling,
 * and post-call analytics.
 */

import WebSocket from 'ws';
import { getOrderDetails } from './orderDatabase.js';
import { getSystemPolicyInstruction } from './brandPolicy.js';
import { TranscriptManager } from './transcriptManager.js';
import { generateCallSummary } from './summarizer.js';

const GEMINI_LIVE_WS_BASE = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const TARGET_MODEL = 'models/gemini-3.8-live';
const VOICE_NAME = 'Sulafat'; // Official warm prebuilt voice in Gemini Live API

/**
 * Tool Declaration for get_order_details
 */
export const TOOLS_CONFIG = [
  {
    functionDeclarations: [
      {
        name: 'get_order_details',
        description: 'Look up live shipping status, courier tracking, and item details for an Aura Skincare customer order using their Order ID.',
        parameters: {
          type: 'OBJECT',
          properties: {
            order_id: {
              type: 'STRING',
              description: 'The customer order identifier, formatted as ORD-XXX (e.g. ORD-101, ORD-102, ORD-103).'
            }
          },
          required: ['order_id']
        }
      }
    ]
  }
];

/**
 * Handle incoming client WebSocket connection and bridge to Gemini Live API
 *
 * @param {WebSocket} clientWs - Browser client WebSocket
 * @param {import('http').IncomingMessage} req - HTTP connection upgrade request
 */
export function handleGeminiLiveRelay(clientWs, req) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.error('[GeminiRelay] Missing GEMINI_API_KEY environment variable.');
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'GEMINI_API_KEY is not configured on the server. Please set it in .env.'
      }));
      clientWs.close(1008, 'Missing API Key');
    }
    return;
  }

  // Session State
  let isSetupComplete = false;
  let isSessionEnded = false;
  const audioInputQueue = []; // Queue audio packets if client sends before setup completes
  const transcriptManager = new TranscriptManager();
  let currentAriaChunkText = '';

  // Determine upstream Gemini Live endpoint (supports mock testing overrides)
  const customWsUrl = process.env.GEMINI_LIVE_WS_URL || process.env.GEMINI_LIVE_URL;
  let geminiUrl = customWsUrl;
  if (!geminiUrl) {
    geminiUrl = `${GEMINI_LIVE_WS_BASE}?key=${apiKey}`;
  } else if (!geminiUrl.includes('key=')) {
    const separator = geminiUrl.includes('?') ? '&' : '?';
    geminiUrl = `${geminiUrl}${separator}key=${apiKey}`;
  }

  console.log(`[GeminiRelay] Connecting upstream to Gemini Live: ${geminiUrl.replace(/key=[^&]+/, 'key=REDACTED')}`);

  // Create upstream WebSocket connection to Gemini
  let geminiWs;
  try {
    geminiWs = new WebSocket(geminiUrl);
  } catch (initErr) {
    console.error('[GeminiRelay] Failed to instantiate WebSocket:', initErr);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: `Failed to connect to Gemini Live: ${initErr.message}`
      }));
      clientWs.close(1011, 'Upstream Connection Error');
    }
    return;
  }

  // Heartbeat ping interval to keep Gemini upstream and client connection alive through silence
  let heartbeatInterval = null;

  const startHeartbeat = () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      // 1. Keep upstream Gemini WebSocket connection alive through silence
      if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
        try {
          geminiWs.ping();
        } catch (e) {
          console.warn('[GeminiRelay] Upstream ping failed:', e.message);
        }
      }

      // 2. Keep client WebSocket connection alive through NAT / proxy timeouts
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
        } catch (e) {}
      }
    }, 15000);
  };

  /**
   * Helper: Safely send message to client
   */
  const sendToClient = (payload) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify(payload));
    }
  };

  /**
   * Helper: Safely send message to Gemini
   */
  const sendToGemini = (payload) => {
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(JSON.stringify(payload));
    }
  };

  /**
   * Send initial session setup frame (BidiGenerateContentSetup)
   */
  const sendSessionSetup = () => {
    const setupMessage = {
      setup: {
        model: TARGET_MODEL,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: VOICE_NAME
              }
            }
          },
          temperature: 0.6
        },
        systemInstruction: {
          parts: [
            {
              text: getSystemPolicyInstruction()
            }
          ]
        },
        tools: TOOLS_CONFIG,
        inputAudioTranscription: {},
        outputAudioTranscription: {}
      }
    };

    console.log('[GeminiRelay] Sending BidiGenerateContentSetup to Gemini Live...');
    sendToGemini(setupMessage);
  };

  /**
   * Upstream Gemini WebSocket Event Listeners
   */
  geminiWs.on('open', () => {
    console.log('[GeminiRelay] Upstream Gemini Live connection opened.');
    sendToClient({ type: 'status', state: 'connecting' });
    sendSessionSetup();
    startHeartbeat();
  });

  geminiWs.on('pong', () => {
    // Upstream Gemini connection is healthy
  });

  geminiWs.on('message', async (rawMessage) => {
    try {
      if (!rawMessage) return;
      const rawText = typeof rawMessage === 'string' ? rawMessage.trim() : rawMessage.toString('utf8').trim();
      if (!rawText) return;

      const response = JSON.parse(rawText);

      // 1. Setup Complete
      if (response.setupComplete) {
        console.log('[GeminiRelay] Gemini Live Setup Complete. Session ready.');
        isSetupComplete = true;
        sendToClient({ type: 'status', state: 'listening' });

        // Flush any audio chunks received while waiting for setup
        while (audioInputQueue.length > 0) {
          const chunk = audioInputQueue.shift();
          sendToGemini(chunk);
        }
        return;
      }

      // 2. Server Content (Audio, Transcriptions, Interruption)
      if (response.serverContent) {
        const { modelTurn, interrupted, turnComplete, inputTranscription, outputTranscription } = response.serverContent;

        // A. Interruption / Barge-In
        if (interrupted === true) {
          console.log('[GeminiRelay] Interruption detected by Gemini VAD. Signaling client flush.');
          currentAriaChunkText = '';
          const activeTurn = transcriptManager.getCurrentTurn();
          transcriptManager.handleInterruption();
          if (activeTurn && activeTurn.role === 'aria') {
            sendToClient({
              type: 'transcript',
              role: 'aria',
              text: activeTurn.text,
              turnId: activeTurn.id,
              isFinal: true,
              interrupted: true,
              timestamp: activeTurn.timestamp
            });
          }
          sendToClient({ type: 'interrupted' });
          sendToClient({ type: 'status', state: 'listening' });
          return;
        }

        // B. Output Audio Chunks & Text Parts
        if (modelTurn && Array.isArray(modelTurn.parts)) {
          for (const part of modelTurn.parts) {
            // Forward audio to client
            if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('audio/pcm')) {
              sendToClient({
                type: 'audio',
                pcm: part.inlineData.data
              });
              sendToClient({ type: 'status', state: 'speaking' });
            }

            // Accumulate any text response
            if (part.text) {
              currentAriaChunkText += part.text;
              // If no outputTranscription is provided, use modelTurn text
              if (!outputTranscription || !outputTranscription.text) {
                const turn = transcriptManager.appendToken('aria', part.text);
                if (turn) {
                  sendToClient({
                    type: 'transcript',
                    role: 'aria',
                    text: turn.text,
                    turnId: turn.id,
                    isFinal: false,
                    timestamp: turn.timestamp
                  });
                }
              }
            }
          }
        }

        // C. Input Transcription (User Speech streaming)
        if (inputTranscription && inputTranscription.text) {
          const userText = inputTranscription.text;
          if (userText) {
            console.log(`[Transcript] User: "${userText}"`);
            const turn = transcriptManager.appendToken('user', userText);
            if (turn) {
              sendToClient({
                type: 'transcript',
                role: 'user',
                text: turn.text,
                turnId: turn.id,
                isFinal: false,
                timestamp: turn.timestamp
              });
            }
          }
        }

        // D. Output Transcription (Aria Speech streaming)
        if (outputTranscription && outputTranscription.text) {
          const ariaText = outputTranscription.text;
          if (ariaText) {
            console.log(`[Transcript] Aria: "${ariaText}"`);
            const turn = transcriptManager.appendToken('aria', ariaText);
            if (turn) {
              sendToClient({
                type: 'transcript',
                role: 'aria',
                text: turn.text,
                turnId: turn.id,
                isFinal: false,
                timestamp: turn.timestamp
              });
            }
          }
        }

        // E. Turn Complete - finalize active turn
        if (turnComplete === true) {
          const completedTurn = transcriptManager.getCurrentTurn();
          transcriptManager.completeTurn();
          if (completedTurn) {
            sendToClient({
              type: 'transcript',
              role: completedTurn.role,
              text: completedTurn.text,
              turnId: completedTurn.id,
              isFinal: true,
              timestamp: completedTurn.timestamp
            });
          } else if (currentAriaChunkText.trim()) {
            const turn = transcriptManager.addTurn('aria', currentAriaChunkText.trim());
            sendToClient({
              type: 'transcript',
              role: 'aria',
              text: currentAriaChunkText.trim(),
              turnId: turn ? turn.id : undefined,
              isFinal: true,
              timestamp: new Date().toISOString()
            });
          }
          currentAriaChunkText = '';
          sendToClient({ type: 'status', state: 'listening' });
        }
      }

      // 3. Tool Calls from Gemini (Function Execution)
      if (response.toolCall && Array.isArray(response.toolCall.functionCalls)) {
        console.log(`[GeminiRelay] Received ${response.toolCall.functionCalls.length} tool calls from Gemini.`);
        sendToClient({ type: 'status', state: 'thinking' });

        const functionResponses = [];

        for (const call of response.toolCall.functionCalls) {
          console.log(`[ToolCall] Function: ${call.name} (ID: ${call.id})`, call.args);

          let toolOutput = {};
          if (call.name === 'get_order_details') {
            const orderId = call.args?.order_id;
            toolOutput = getOrderDetails(orderId);
            console.log(`[ToolCall Result] For ${orderId}:`, toolOutput.status);

            // Record in transcript manager
            transcriptManager.recordToolCall(call.id, 'get_order_details', call.args, toolOutput);

            // Notify client UI in real time
            sendToClient({
              type: 'tool_event',
              tool: 'get_order_details',
              args: call.args,
              result: toolOutput,
              timestamp: new Date().toISOString()
            });
          } else {
            toolOutput = { error: `Function ${call.name} is not supported.` };
          }

          functionResponses.push({
            id: call.id,
            name: call.name,
            response: {
              output: toolOutput
            }
          });
        }

        // Send toolResponse frame back to Gemini Live
        const toolResponsePayload = {
          toolResponse: {
            functionResponses
          }
        };

        console.log('[GeminiRelay] Returning toolResponse to Gemini Live.');
        sendToGemini(toolResponsePayload);
      }

      // 4. Tool Call Cancellation
      if (response.toolCallCancellation) {
        console.log('[GeminiRelay] Tool calls cancelled by Gemini:', response.toolCallCancellation.ids);
      }

      // 5. GoAway Notice
      if (response.goAway) {
        console.warn('[GeminiRelay] Gemini Live sent GoAway signal. Session will terminate soon.');
      }

    } catch (parseErr) {
      console.error('[GeminiRelay Error] Failed to parse message from Gemini:', parseErr);
    }
  });

  geminiWs.on('error', (err) => {
    console.error('[GeminiRelay Error] Upstream Gemini WebSocket error:', err.message);
    sendToClient({
      type: 'error',
      message: `Gemini Live connection error: ${err.message}`
    });
  });

  geminiWs.on('close', (code, reason) => {
    console.log(`[GeminiRelay] Upstream Gemini WebSocket closed (code: ${code}, reason: ${reason?.toString()})`);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (!isSessionEnded) {
      if (code !== 1000) {
        sendToClient({
          type: 'error',
          message: 'Gemini Live upstream connection closed. Click "Start Voice Call" to reconnect.'
        });
      }
      finalizeSession();
    }
  });

  /**
   * Finalize the call session, generate summary outcome, and close sockets
   */
  const finalizeSession = async () => {
    if (isSessionEnded) return;
    isSessionEnded = true;

    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    console.log('[GeminiRelay] Finalizing session. Generating structured call outcome...');
    sendToClient({ type: 'status', state: 'ended' });

    try {
      const turns = transcriptManager.getTurns();
      const toolEvents = transcriptManager.getToolEvents();

      // Generate structured call summary
      const outcome = await generateCallSummary(turns, toolEvents);

      console.log('[GeminiRelay] Generated Call Outcome:', outcome);

      sendToClient({
        type: 'call_outcome',
        data: outcome
      });
    } catch (summaryErr) {
      console.error('[GeminiRelay Error] Failed generating summary:', summaryErr);
      // Fallback outcome
      sendToClient({
        type: 'call_outcome',
        data: {
          customer_intent: 'general_inquiry',
          order_id: null,
          resolution_status: 'in_progress',
          call_summary: 'Customer called Aura Skincare support. Call concluded before full resolution.'
        }
      });
    }

    // Close upstream Gemini WebSocket cleanly
    if (geminiWs && (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING)) {
      try {
        geminiWs.close(1000, 'Session Ended by Client');
      } catch (e) {
        /* ignore */
      }
    }
  };

  /**
   * Client WebSocket Event Listeners
   */
  clientWs.on('message', (message, isBinary) => {
    try {
      // 1. Binary PCM Audio data
      if (isBinary) {
        const base64Data = Buffer.from(message).toString('base64');
        const realtimeInputPayload = {
          realtimeInput: {
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Data
            }
          }
        };

        if (isSetupComplete && geminiWs.readyState === WebSocket.OPEN) {
          sendToGemini(realtimeInputPayload);
        } else if (audioInputQueue.length < 50) {
          audioInputQueue.push(realtimeInputPayload);
        }
        return;
      }

      // 2. JSON Control Messages
      const parsed = JSON.parse(message.toString('utf8'));

      // A. Audio chunk as base64 string
      if (parsed.type === 'audio' && parsed.pcm) {
        const realtimeInputPayload = {
          realtimeInput: {
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: parsed.pcm
            }
          }
        };

        if (isSetupComplete && geminiWs.readyState === WebSocket.OPEN) {
          sendToGemini(realtimeInputPayload);
        } else if (audioInputQueue.length < 50) {
          audioInputQueue.push(realtimeInputPayload);
        }
        return;
      }

      // B. Text input (for testing, fallback, or text queries)
      if (parsed.type === 'text_input' && parsed.text) {
        console.log(`[Client] Text query sent: "${parsed.text}"`);
        const textPayload = {
          realtimeInput: {
            text: parsed.text
          }
        };

        const turn = transcriptManager.addTurn('user', parsed.text);
        sendToClient({
          type: 'transcript',
          role: 'user',
          text: parsed.text,
          turnId: turn ? turn.id : undefined,
          isFinal: true,
          timestamp: turn ? turn.timestamp : new Date().toISOString()
        });

        if (isSetupComplete && geminiWs.readyState === WebSocket.OPEN) {
          sendToGemini(textPayload);
        }
        return;
      }

      // C. End Call
      if (parsed.type === 'end_call') {
        console.log('[Client] Received end_call command from client.');
        finalizeSession();
        return;
      }

      // D. Heartbeat / Ping from client
      if (parsed.type === 'ping') {
        sendToClient({ type: 'pong', timestamp: Date.now() });
        return;
      }

    } catch (err) {
      console.error('[GeminiRelay Error] Handling client message:', err);
    }
  });

  clientWs.on('close', (code, reason) => {
    console.log(`[WebSocket] Client disconnected (code: ${code}, reason: ${reason?.toString()})`);
    finalizeSession();
  });

  clientWs.on('error', (err) => {
    console.error('[WebSocket Error] Client socket error:', err);
    finalizeSession();
  });
}

export default {
  handleGeminiLiveRelay,
  TOOLS_CONFIG
};
