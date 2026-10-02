/**
 * tests/integration/websocketRelay.test.js
 * Comprehensive integration tests for WebSocket Relay and Gemini Live API Protocol.
 * Tests setup handshake, 16kHz audio streaming in, tool call dispatch/response,
 * 24kHz audio streaming out, barge-in interruption, and post-call outcome.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { WebSocketServer, WebSocket as NodeWebSocket } from 'ws';
import { MockGeminiLiveServer } from '../mocks/mockGeminiLiveServer.js';
import { loadOrderDatabase, loadSummarizer } from '../helpers/moduleLoader.js';
import { floatTo16BitPCM, pcmToBase64, generateSineWave } from '../mocks/audioUtils.js';
import { handleGeminiLiveRelay } from '../../server/geminiLiveRelay.js';

describe('WebSocket Relay & Gemini Live API Protocol Integration Tests', () => {
  let mockServer;
  let serverPort;
  let clientWs;

  beforeEach(async () => {
    mockServer = new MockGeminiLiveServer({ autoAcknowledgeSetup: true });
    serverPort = await mockServer.start();
  });

  afterEach(async () => {
    if (clientWs && clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
    await mockServer.stop();
  });

  // --- Handshake & Setup Frame ---

  it('TC-1.1.1 & TC-1.5.6: performs setup handshake and receives setupComplete acknowledgement', async () => {
    const wsUrl = `ws://127.0.0.1:${serverPort}`;
    clientWs = new WebSocket(wsUrl);

    const setupAckPromise = new Promise((resolve, reject) => {
      clientWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.setupComplete) resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      clientWs.onerror = reject;
    });

    await new Promise((resolve) => { clientWs.onopen = resolve; });

    // Send BidiGenerateContentSetup
    const setupFrame = {
      setup: {
        model: 'models/gemini-3.1-flash-live-preview',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Sulafat' }
            }
          },
          thinkingConfig: { thinkingLevel: 'minimal' }
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'get_order_details',
                parameters: {
                  type: 'OBJECT',
                  properties: { order_id: { type: 'STRING' } },
                  required: ['order_id']
                }
              }
            ]
          }
        ]
      }
    };

    clientWs.send(JSON.stringify(setupFrame));

    const ack = await setupAckPromise;
    expect(ack.setupComplete).toBe(true);

    // Verify mock server received and recorded setup details
    expect(mockServer.receivedSetup).toBeDefined();
    expect(mockServer.receivedSetup.model).toBe('models/gemini-3.1-flash-live-preview');
    expect(mockServer.receivedSetup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Sulafat');
    expect(mockServer.receivedSetup.generationConfig.thinkingConfig.thinkingLevel).toBe('minimal');
  });

  // --- Realtime Audio Streaming ---

  it('TC-1.2.1: streams 16kHz PCM audio chunks to Gemini Live', async () => {
    const wsUrl = `ws://127.0.0.1:${serverPort}`;
    clientWs = new WebSocket(wsUrl);
    await new Promise((resolve) => { clientWs.onopen = resolve; });

    // Generate 16kHz synthetic sine wave PCM chunk (100ms)
    const samples = generateSineWave(440, 0.1, 16000, 0.6);
    const pcmBuffer = floatTo16BitPCM(samples);
    const base64Audio = pcmToBase64(pcmBuffer);

    const audioPayload = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Audio
        }
      }
    };

    clientWs.send(JSON.stringify(audioPayload));

    // Wait for mock server to receive media chunk
    await new Promise((resolve) => {
      mockServer.once('mediaChunk', resolve);
    });

    expect(mockServer.receivedMediaChunks.length).toBeGreaterThan(0);
    const receivedChunk = mockServer.receivedMediaChunks[0];
    expect(receivedChunk.mimeType).toBe('audio/pcm;rate=16000');
    expect(receivedChunk.data).toBe(base64Audio);
  });

  // --- Tool Calling Execution Roundtrip ---

  it('TC-1.5.1: handles get_order_details toolCall and verifies synchronous toolResponse', async () => {
    const { getOrderDetails } = await loadOrderDatabase();
    const wsUrl = `ws://127.0.0.1:${serverPort}`;
    clientWs = new WebSocket(wsUrl);
    await new Promise((resolve) => { clientWs.onopen = resolve; });

    // Client listens for tool call, executes lookup, and returns toolResponse
    clientWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.toolCall && msg.toolCall.functionCalls) {
        const functionResponses = [];
        for (const call of msg.toolCall.functionCalls) {
          if (call.name === 'get_order_details') {
            const result = getOrderDetails(call.args.order_id);
            functionResponses.push({
              id: call.id,
              name: call.name,
              response: { output: result }
            });
          }
        }
        clientWs.send(JSON.stringify({ toolResponse: { functionResponses } }));
      }
    };

    // Mock server issues tool call for ORD-101
    const callId = mockServer.emitToolCall('ORD-101');

    // Wait for tool response to arrive at mock server
    const toolResp = await new Promise((resolve) => {
      mockServer.once('toolResponse', resolve);
    });

    expect(toolResp).toBeDefined();
    expect(toolResp.functionResponses).toHaveLength(1);
    const resp = toolResp.functionResponses[0];
    expect(resp.id).toBe(callId);
    expect(resp.name).toBe('get_order_details');
    expect(resp.response.output.found).toBe(true);
    expect(resp.response.output.order_id).toBe('ORD-101');
    expect(resp.response.output.customer_name).toBe('Priya Sharma');
    expect(resp.response.output.order_status).toBe('Out for Delivery');
  });

  // --- Downstream Audio Output & Model Turn ---

  it('TC-1.2.2: receives downstream 24kHz audio and text in modelTurn', async () => {
    const wsUrl = `ws://127.0.0.1:${serverPort}`;
    clientWs = new WebSocket(wsUrl);
    await new Promise((resolve) => { clientWs.onopen = resolve; });

    // Generate 24kHz audio buffer
    const samples = generateSineWave(440, 0.05, 24000, 0.5);
    const pcm24k = pcmToBase64(floatTo16BitPCM(samples));
    const ariaText = 'Hello! Welcome to Aura Skincare.';

    const messagePromise = new Promise((resolve) => {
      clientWs.onmessage = (event) => {
        resolve(JSON.parse(event.data));
      };
    });

    mockServer.emitModelTurn({
      text: ariaText,
      audioPcmBase64: pcm24k,
      isTurnComplete: true
    });

    const received = await messagePromise;
    expect(received.serverContent).toBeDefined();
    expect(received.serverContent.modelTurn).toBeDefined();

    const parts = received.serverContent.modelTurn.parts;
    expect(parts.some(p => p.inlineData && p.inlineData.mimeType === 'audio/pcm;rate=24000')).toBe(true);
    expect(parts.some(p => p.text === ariaText)).toBe(true);
  });

  // --- Barge-In Interruption ---

  it('TC-1.2.3: receives interrupted signal when user interrupts agent speech', async () => {
    const wsUrl = `ws://127.0.0.1:${serverPort}`;
    clientWs = new WebSocket(wsUrl);
    await new Promise((resolve) => { clientWs.onopen = resolve; });

    const interruptPromise = new Promise((resolve) => {
      clientWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.serverContent && data.serverContent.interrupted === true) {
          resolve(data);
        }
      };
    });

    // Mock server signals interruption
    mockServer.emitInterrupted();

    const msg = await interruptPromise;
    expect(msg.serverContent.interrupted).toBe(true);
  });

  // --- Post-Call Summarization ---

  it('TC-1.8.1: generates schema-compliant structured outcome upon call termination', async () => {
    const { generateCallSummary } = await loadSummarizer();

    const session = {
      transcript: [
        { role: 'user', text: 'Hi, can you check the status of my order ORD-101?' },
        { role: 'aria', text: 'Hello Priya! Your order ORD-101 for the Vitamin C Serum is currently Out for Delivery with BlueDart.' }
      ],
      toolCalls: [
        {
          tool: 'get_order_details',
          args: { order_id: 'ORD-101' },
          result: { order_id: 'ORD-101', status: 'Out for Delivery' }
        }
      ]
    };

    const outcome = await generateCallSummary(session);

    expect(outcome).toBeDefined();
    expect(outcome.customer_intent).toBe('order_tracking');
    expect(outcome.order_id).toBe('ORD-101');
    expect(outcome.resolution_status).toBe('resolved');
    expect(outcome.call_summary).toContain('ORD-101');
    expect(outcome.call_summary.length).toBeGreaterThan(20);
  });

  // --- Relay Server & End Call Control Message ---

  it('TC-1.6.2: client sending end_call triggers session termination and post-call summary payload through handleGeminiLiveRelay', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    const prevUrl = process.env.GEMINI_LIVE_WS_URL;
    process.env.GEMINI_API_KEY = 'test-api-key-mock';
    process.env.GEMINI_LIVE_WS_URL = `ws://127.0.0.1:${serverPort}`;

    const relayServer = http.createServer();
    const relayWss = new WebSocketServer({ server: relayServer, path: '/ws' });
    relayWss.on('connection', (ws, req) => {
      handleGeminiLiveRelay(ws, req);
    });

    await new Promise((resolve) => relayServer.listen(0, '127.0.0.1', resolve));
    const relayPort = relayServer.address().port;

    const testClientWs = new NodeWebSocket(`ws://127.0.0.1:${relayPort}/ws`);

    try {
      await new Promise((resolve) => testClientWs.on('open', resolve));

      // Wait until relay reports listening (which indicates upstream setup complete)
      await new Promise((resolve) => {
        const handler = (data) => {
          try {
            const msg = JSON.parse(data.toString('utf8'));
            if (msg.type === 'status' && msg.state === 'listening') {
              testClientWs.off('message', handler);
              resolve();
            }
          } catch (e) {
            /* ignore */
          }
        };
        testClientWs.on('message', handler);
      });

      // Verify that relay sent inputAudioTranscription and outputAudioTranscription in setup
      expect(mockServer.receivedSetup).toBeDefined();
      expect(mockServer.receivedSetup.inputAudioTranscription).toBeDefined();
      expect(mockServer.receivedSetup.outputAudioTranscription).toBeDefined();

      // Send text input to add context to transcript
      testClientWs.send(JSON.stringify({
        type: 'text_input',
        text: 'Where is my order ORD-101?'
      }));

      // Setup promise for ended status and call_outcome
      const outcomePromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for call_outcome on end_call')), 5000);
        let receivedEnded = false;
        let receivedOutcome = null;

        const checkDone = () => {
          if (receivedEnded && receivedOutcome) {
            clearTimeout(timer);
            resolve(receivedOutcome);
          }
        };

        testClientWs.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString('utf8'));
            if (msg.type === 'status' && msg.state === 'ended') {
              receivedEnded = true;
              checkDone();
            }
            if (msg.type === 'call_outcome') {
              receivedOutcome = msg;
              checkDone();
            }
          } catch (e) {
            /* ignore */
          }
        });
      });

      // Send end_call JSON text frame (which was previously blocked by Buffer.isBuffer check)
      testClientWs.send(JSON.stringify({ type: 'end_call' }));

      const callOutcomeMsg = await outcomePromise;

      expect(callOutcomeMsg).toBeDefined();
      expect(callOutcomeMsg.type).toBe('call_outcome');
      expect(callOutcomeMsg.data).toBeDefined();
      expect(callOutcomeMsg.data.customer_intent).toBeDefined();
      expect(callOutcomeMsg.data.resolution_status).toBeDefined();
      expect(callOutcomeMsg.data.call_summary).toBeDefined();
      expect(callOutcomeMsg.data.call_summary.length).toBeGreaterThan(10);
    } finally {
      if (testClientWs.readyState === NodeWebSocket.OPEN) {
        testClientWs.close();
      }
      await new Promise((resolve) => relayWss.close(resolve));
      await new Promise((resolve) => relayServer.close(resolve));
      process.env.GEMINI_API_KEY = prevKey;
      process.env.GEMINI_LIVE_WS_URL = prevUrl;
    }
  });

  it('TC-1.2.4: relays binary PCM audio frames to Gemini Live as realtimeInput.audio', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    const prevUrl = process.env.GEMINI_LIVE_WS_URL;
    process.env.GEMINI_API_KEY = 'test-api-key-mock';
    process.env.GEMINI_LIVE_WS_URL = `ws://127.0.0.1:${serverPort}`;

    const relayServer = http.createServer();
    const relayWss = new WebSocketServer({ server: relayServer, path: '/ws' });
    relayWss.on('connection', (ws, req) => {
      handleGeminiLiveRelay(ws, req);
    });

    await new Promise((resolve) => relayServer.listen(0, '127.0.0.1', resolve));
    const relayPort = relayServer.address().port;

    const testClientWs = new NodeWebSocket(`ws://127.0.0.1:${relayPort}/ws`);

    try {
      await new Promise((resolve) => testClientWs.on('open', resolve));

      // Wait until relay reports listening
      await new Promise((resolve) => {
        const handler = (data) => {
          try {
            const msg = JSON.parse(data.toString('utf8'));
            if (msg.type === 'status' && msg.state === 'listening') {
              testClientWs.off('message', handler);
              resolve();
            }
          } catch (e) {
            /* ignore */
          }
        };
        testClientWs.on('message', handler);
      });

      // Clear any prior media chunks
      mockServer.receivedMediaChunks = [];

      // Send binary PCM chunk from client
      const samples = generateSineWave(440, 0.05, 16000, 0.5);
      const pcmBuffer = floatTo16BitPCM(samples);
      const expectedBase64 = pcmToBase64(pcmBuffer);

      const mediaChunkPromise = new Promise((resolve) => {
        mockServer.once('mediaChunk', resolve);
      });

      testClientWs.send(pcmBuffer, { binary: true });

      const chunk = await mediaChunkPromise;
      expect(chunk).toBeDefined();
      expect(chunk.mimeType).toBe('audio/pcm;rate=16000');
      expect(chunk.data).toBe(expectedBase64);
    } finally {
      if (testClientWs.readyState === NodeWebSocket.OPEN) {
        testClientWs.close();
      }
      await new Promise((resolve) => relayWss.close(resolve));
      await new Promise((resolve) => relayServer.close(resolve));
      process.env.GEMINI_API_KEY = prevKey;
      process.env.GEMINI_LIVE_WS_URL = prevUrl;
    }
  });
});
