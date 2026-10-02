/**
 * src/utils/audioConversion.js
 * High-performance Web Audio PCM conversion, downsampling, and Base64 utilities
 * for Aura Skincare Voice Agent ("Aria").
 *
 * Handles:
 * - Float32 <-> 16-bit linear PCM conversion with saturation clipping protection
 * - Linear interpolation downsampling to 16,000 Hz from arbitrary mic sample rates (44.1kHz / 48kHz)
 * - Bidirectional binary ArrayBuffer <-> Base64 encoding/decoding optimized for both browser & Node
 */

/**
 * Converts normalized Float32 audio samples [-1.0, 1.0] to 16-bit linear PCM Little-Endian ArrayBuffer.
 * Enforces saturation clipping protection so out-of-range samples (+1.5, -2.0) clamp to [-32768, 32767].
 *
 * @param {Float32Array|Array<number>} float32Array - Array of normalized float audio samples
 * @returns {ArrayBuffer} ArrayBuffer containing 16-bit linear PCM Little-Endian bytes
 */
export function floatTo16BitPCM(float32Array) {
  if (!float32Array || float32Array.length === 0) {
    return new ArrayBuffer(0);
  }

  const length = float32Array.length;
  const buffer = new ArrayBuffer(length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < length; i++) {
    // Symmetrical clamp between -1.0 and 1.0 to prevent integer overflow distortion
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    // Scale: positive samples mapped to 0x7FFF (32767), negative samples to 0x8000 (-32768)
    const intSample = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7FFF);
    // Hard bound clamp safeguard
    const clamped = Math.max(-32768, Math.min(32767, intSample));
    view.setInt16(i * 2, clamped, true); // true = Little-Endian
  }

  return buffer;
}

/**
 * Converts 16-bit linear PCM audio bytes back to normalized Float32Array [-1.0, 1.0].
 * Accepts ArrayBuffer, Int16Array, Uint8Array, or Node Buffer.
 *
 * @param {ArrayBuffer|Int16Array|Uint8Array|Buffer} pcmBuffer - Linear PCM 16-bit Little-Endian data
 * @returns {Float32Array} Normalized float samples in [-1.0, 1.0] range
 */
export function pcm16ToFloat32(pcmBuffer) {
  if (!pcmBuffer) {
    return new Float32Array(0);
  }

  let int16Array;

  if (pcmBuffer instanceof Int16Array) {
    int16Array = pcmBuffer;
  } else if (pcmBuffer instanceof ArrayBuffer) {
    int16Array = new Int16Array(pcmBuffer);
  } else if (ArrayBuffer.isView(pcmBuffer)) {
    // Uint8Array or Node Buffer
    const sampleCount = Math.floor(pcmBuffer.byteLength / 2);
    int16Array = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, sampleCount);
  } else {
    return new Float32Array(0);
  }

  const sampleCount = int16Array.length;
  const float32 = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const val = int16Array[i];
    float32[i] = val < 0 ? val / 0x8000 : val / 0x7FFF;
  }

  return float32;
}

/**
 * Downsamples audio from arbitrary source sample rate (e.g. 48kHz, 44.1kHz)
 * down to 16,000 Hz using linear window averaging.
 *
 * @param {Float32Array} audioBuffer - Source float audio buffer
 * @param {number} sourceSampleRate - Input sample rate in Hz (e.g. 44100, 48000)
 * @returns {Float32Array} Resampled audio at 16,000 Hz
 */
export function downsampleTo16kHz(audioBuffer, sourceSampleRate) {
  return downsampleAudio(audioBuffer, sourceSampleRate, 16000);
}

/**
 * Generic audio resampling/downsampling using linear window averaging interpolation.
 *
 * @param {Float32Array} sourceBuffer - Source float samples
 * @param {number} sourceRate - Original sample rate (e.g. 48000)
 * @param {number} targetRate - Target sample rate (e.g. 16000)
 * @returns {Float32Array} Resampled audio buffer
 */
export function downsampleAudio(sourceBuffer, sourceRate, targetRate) {
  if (!sourceBuffer || sourceBuffer.length === 0) {
    return new Float32Array(0);
  }

  if (sourceRate <= 0 || targetRate <= 0) {
    throw new Error(`Sample rates must be positive numbers. Received sourceRate=${sourceRate}, targetRate=${targetRate}`);
  }

  if (sourceRate === targetRate) {
    return new Float32Array(sourceBuffer);
  }

  const ratio = sourceRate / targetRate;
  const newLength = Math.round(sourceBuffer.length / ratio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetSource = 0;

  while (offsetResult < result.length) {
    const nextOffsetSource = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;

    for (let i = offsetSource; i < nextOffsetSource && i < sourceBuffer.length; i++) {
      accum += sourceBuffer[i];
      count++;
    }

    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetSource = nextOffsetSource;
  }

  return result;
}

/**
 * High-efficiency conversion from ArrayBuffer / Uint8Array to Base64 string.
 * Optimized for chunked binary streaming over WebSocket in both Browser and Node.
 *
 * @param {ArrayBuffer|Uint8Array|Buffer} buffer
 * @returns {string} Base64 encoded string
 */
export function arrayBufferToBase64(buffer) {
  if (!buffer) return '';

  let bytes;
  if (buffer instanceof Uint8Array) {
    bytes = buffer;
  } else if (buffer instanceof ArrayBuffer) {
    bytes = new Uint8Array(buffer);
  } else if (ArrayBuffer.isView(buffer)) {
    bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else {
    return '';
  }

  if (bytes.length === 0) return '';

  // Node.js runtime fast path
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }

  // Browser runtime chunked path (avoids call stack size exceeded)
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

/**
 * High-efficiency conversion from Base64 string to ArrayBuffer.
 * Works seamlessly in both Browser and Node environments.
 *
 * @param {string} base64 - Base64 encoded audio string
 * @returns {ArrayBuffer} Decoded binary ArrayBuffer
 */
export function base64ToArrayBuffer(base64) {
  if (!base64 || typeof base64 !== 'string') {
    return new ArrayBuffer(0);
  }

  // Node.js runtime fast path
  if (typeof Buffer !== 'undefined') {
    const nodeBuf = Buffer.from(base64, 'base64');
    return nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength);
  }

  // Browser runtime path
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Aliases for interoperability
export const pcmToBase64 = arrayBufferToBase64;
export const base64ToPcm = base64ToArrayBuffer;

export default {
  floatTo16BitPCM,
  pcm16ToFloat32,
  downsampleTo16kHz,
  downsampleAudio,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  pcmToBase64,
  base64ToPcm
};
