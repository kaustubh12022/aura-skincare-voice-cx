/**
 * tests/mocks/mockGeminiLiveServer.js
 * Standalone, deterministic Mock WebSocket Server simulating
 * Google Gemini Multimodal Live API (v1beta BidiGenerateContent).
 *
 * Implements:
 * - RFC 6455 compliant WebSocket server using Node.js core 'http' and 'crypto'
 * - Receives and validates BidiGenerateContentSetup
 * - Acknowledges setup with { setupComplete: true }
 * - Receives realtimeInput.mediaChunks (16kHz PCM audio chunks)
 * - Emits toolCall events for get_order_details
 * - Receives toolResponse frames with functionResponses
 * - Emits serverContent.modelTurn with 24kHz audio and text parts
 * - Emits serverContent.interrupted = true when barge-in is triggered
 * - Emits serverContent.turnComplete = true
 */

import http from 'http';
import crypto from 'crypto';
import { EventEmitter } from 'events';

const WS_MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/**
 * Encodes a text or binary payload into an RFC 6455 unmasked WebSocket frame
 * for sending from server to client.
 *
 * @param {string|Buffer} data - Payload string or Buffer
 * @param {boolean} [isBinary=false]
 * @returns {Buffer} Raw frame buffer
 */
function encodeWsFrame(data, isBinary = false) {
  const isBuffer = Buffer.isBuffer(data);
  const payload = isBuffer ? data : Buffer.from(String(data), 'utf8');
  const length = payload.length;

  let header;
  const opcode = isBinary ? 0x82 : 0x81; // FIN + opcode (1 = text, 2 = binary)

  if (length < 126) {
    header = Buffer.alloc(2);
    header[0] = opcode;
    header[1] = length; // Mask bit = 0
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

/**
 * Decodes RFC 6455 masked frames from client socket stream.
 */
class WebSocketStreamParser extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);

    this.socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.processBuffer();
    });

    this.socket.on('close', () => this.emit('close'));
    this.socket.on('error', (err) => this.emit('error', err));
  }

  processBuffer() {
    while (this.buffer.length >= 2) {
      const firstByte = this.buffer[0];
      const secondByte = this.buffer[1];

      const opcode = firstByte & 0x0f;
      const isMasked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7f;

      let offset = 2;

      if (payloadLength === 126) {
        if (this.buffer.length < 4) return; // Wait for extended length
        payloadLength = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (this.buffer.length < 10) return; // Wait for 64-bit length
        payloadLength = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }

      const maskLength = isMasked ? 4 : 0;
      const totalFrameSize = offset + maskLength + payloadLength;

      if (this.buffer.length < totalFrameSize) {
        return; // Wait for full frame
      }

      let maskingKey = null;
      if (isMasked) {
        maskingKey = this.buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      const rawPayload = this.buffer.subarray(offset, offset + payloadLength);
      const unmaskedPayload = Buffer.alloc(payloadLength);

      if (isMasked && maskingKey) {
        for (let i = 0; i < payloadLength; i++) {
          unmaskedPayload[i] = rawPayload[i] ^ maskingKey[i % 4];
        }
      } else {
        rawPayload.copy(unmaskedPayload);
      }

      // Advance buffer past this frame
      this.buffer = this.buffer.subarray(totalFrameSize);

      if (opcode === 0x01) {
        // Text frame
        this.emit('message', unmaskedPayload.toString('utf8'), false);
      } else if (opcode === 0x02) {
        // Binary frame
        this.emit('message', unmaskedPayload, true);
      } else if (opcode === 0x08) {
        // Close frame
        this.socket.end(encodeWsFrame(Buffer.alloc(0)));
        this.emit('close');
        return;
      } else if (opcode === 0x09) {
        // Ping -> Pong
        this.socket.write(Buffer.from([0x8a, 0x00]));
      }
    }
  }

  send(data) {
    if (this.socket.writable) {
      const isBin = Buffer.isBuffer(data);
      this.socket.write(encodeWsFrame(data, isBin));
    }
  }

  close() {
    try {
      this.socket.end();
    } catch (e) {
      /* ignore */
    }
  }
}

/**
 * MockGeminiLiveServer Class
 */
export class MockGeminiLiveServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.port = options.port || 0;
    this.autoAcknowledgeSetup = options.autoAcknowledgeSetup !== false;
    this.autoReply = options.autoReply || false;
    this.server = null;
    this.activeSockets = new Set();
    this.activeParsers = new Set();

    // History for test assertions
    this.receivedSetup = null;
    this.receivedMediaChunks = [];
    this.receivedToolResponses = [];
    this.receivedMessages = [];
  }

  /**
   * Starts the mock HTTP and WebSocket server.
   * @param {number} [port=0]
   * @returns {Promise<number>} Resolved listening port
   */
  start(port = this.port) {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Mock Gemini Live WebSocket Server');
      });

      this.server.on('upgrade', (req, socket) => {
        const key = req.headers['sec-websocket-key'];
        if (!key) {
          socket.destroy();
          return;
        }

        const acceptKey = crypto
          .createHash('sha1')
          .update(key + WS_MAGIC_STRING)
          .digest('base64');

        const headers = [
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${acceptKey}`,
          '\r\n'
        ];

        socket.write(headers.join('\r\n'));
        this.handleNewConnection(socket);
      });

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(port, '127.0.0.1', () => {
        const addr = this.server.address();
        this.port = typeof addr === 'object' && addr ? addr.port : port;
        resolve(this.port);
      });
    });
  }

  /**
   * Internal connection handler
   */
  handleNewConnection(socket) {
    this.activeSockets.add(socket);
    const parser = new WebSocketStreamParser(socket);
    this.activeParsers.add(parser);

    this.emit('connection', parser);

    parser.on('message', (data, isBinary) => {
      this.handleIncomingMessage(parser, data, isBinary);
    });

    parser.on('close', () => {
      this.activeSockets.delete(socket);
      this.activeParsers.delete(parser);
      this.emit('clientDisconnected');
    });

    socket.on('close', () => {
      this.activeSockets.delete(socket);
      this.activeParsers.delete(parser);
    });
  }

  /**
   * Internal message handler
   */
  handleIncomingMessage(parser, data, isBinary) {
    if (isBinary) {
      this.receivedMediaChunks.push(data);
      this.emit('mediaChunk', data);
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(data);
      this.receivedMessages.push(parsed);
      this.emit('rawMessage', parsed);
    } catch (e) {
      this.emit('parseError', data);
      return;
    }

    // 1. Setup frame: BidiGenerateContentSetup
    if (parsed.setup) {
      this.receivedSetup = parsed.setup;
      this.emit('setup', parsed.setup);

      if (this.autoAcknowledgeSetup) {
        // Respond with setupComplete
        setTimeout(() => {
          this.broadcastJson({ setupComplete: true });
          this.emit('setupComplete');
        }, 10);
      }
      return;
    }

    // 2. Realtime input audio / media chunks (PCM audio)
    if (parsed.realtimeInput) {
      if (parsed.realtimeInput.audio) {
        this.receivedMediaChunks.push(parsed.realtimeInput.audio);
        this.emit('mediaChunk', parsed.realtimeInput.audio);
        this.emit('audio', parsed.realtimeInput.audio);
      }
      if (parsed.realtimeInput.mediaChunks) {
        for (const chunk of parsed.realtimeInput.mediaChunks) {
          this.receivedMediaChunks.push(chunk);
          this.emit('mediaChunk', chunk);
        }
      }
      this.emit('realtimeInput', parsed.realtimeInput);
      return;
    }

    // 3. Tool response
    if (parsed.toolResponse) {
      this.receivedToolResponses.push(parsed.toolResponse);
      this.emit('toolResponse', parsed.toolResponse);
      return;
    }
  }

  /**
   * Sends a JSON object to all active clients or a specific parser.
   * @param {object} obj
   * @param {WebSocketStreamParser} [targetParser]
   */
  broadcastJson(obj, targetParser = null) {
    const text = JSON.stringify(obj);
    if (targetParser) {
      targetParser.send(text);
      return;
    }
    for (const parser of this.activeParsers) {
      parser.send(text);
    }
  }

  /**
   * Triggers a tool call for get_order_details or any custom function.
   *
   * @param {string} orderId - Order identifier (e.g. 'ORD-101')
   * @param {string} [callId] - Optional call ID
   * @param {string} [functionName='get_order_details']
   */
  emitToolCall(orderId, callId = null, functionName = 'get_order_details') {
    const id = callId || `call_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const payload = {
      toolCall: {
        functionCalls: [
          {
            id,
            name: functionName,
            args: { order_id: orderId }
          }
        ]
      }
    };
    this.broadcastJson(payload);
    return id;
  }

  /**
   * Emits an agent model turn containing audio and/or text parts.
   *
   * @param {object} options
   * @param {string} [options.text] - Spoken text transcript
   * @param {string} [options.audioPcmBase64] - Base64 encoded 24kHz PCM audio
   * @param {boolean} [options.isTurnComplete=false]
   */
  emitModelTurn({ text = '', audioPcmBase64 = null, isTurnComplete = false } = {}) {
    const parts = [];

    if (audioPcmBase64) {
      parts.push({
        inlineData: {
          mimeType: 'audio/pcm;rate=24000',
          data: audioPcmBase64
        }
      });
    }

    if (text) {
      parts.push({
        text
      });
    }

    const payload = {
      serverContent: {
        modelTurn: {
          parts
        },
        turnComplete: isTurnComplete,
        interrupted: false
      }
    };

    if (text) {
      payload.serverContent.outputTranscription = {
        text
      };
    }

    this.broadcastJson(payload);
  }

  /**
   * Emits barge-in / interruption signal to prompt client audio flush.
   */
  emitInterrupted() {
    const payload = {
      serverContent: {
        interrupted: true
      }
    };
    this.broadcastJson(payload);
  }

  /**
   * Emits turn complete event.
   */
  emitTurnComplete() {
    const payload = {
      serverContent: {
        turnComplete: true
      }
    };
    this.broadcastJson(payload);
  }

  /**
   * Emits user input transcription event.
   * @param {string} text
   */
  emitInputTranscription(text) {
    const payload = {
      serverContent: {
        inputTranscription: {
          text
        }
      }
    };
    this.broadcastJson(payload);
  }

  /**
   * Helper for tests: wait for a specific condition or message with timeout.
   *
   * @param {Function} predicate - (message) => boolean
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<any>}
   */
  waitForMessage(predicate, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      // Check already received messages
      for (const msg of this.receivedMessages) {
        if (predicate(msg)) return resolve(msg);
      }

      const timer = setTimeout(() => {
        this.removeListener('rawMessage', listener);
        reject(new Error(`waitForMessage timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const listener = (msg) => {
        if (predicate(msg)) {
          clearTimeout(timer);
          this.removeListener('rawMessage', listener);
          resolve(msg);
        }
      };

      this.on('rawMessage', listener);
    });
  }

  /**
   * Returns WebSocket URL for clients to connect to this mock server.
   * @returns {string}
   */
  getWsUrl() {
    return `ws://127.0.0.1:${this.port}/ws`;
  }

  /**
   * Clears all recorded message and chunk history.
   */
  clearHistory() {
    this.receivedSetup = null;
    this.receivedMediaChunks = [];
    this.receivedToolResponses = [];
    this.receivedMessages = [];
  }

  /**
   * Stops the server and closes all active sockets.
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve) => {
      for (const parser of this.activeParsers) {
        parser.close();
      }
      this.activeParsers.clear();

      for (const socket of this.activeSockets) {
        try {
          socket.destroy();
        } catch (e) {
          /* ignore */
        }
      }
      this.activeSockets.clear();

      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default MockGeminiLiveServer;
