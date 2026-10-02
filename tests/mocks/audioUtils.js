/**
 * tests/mocks/audioUtils.js
 * Authentic Web Audio and PCM processing utilities for testing
 * Aura Skincare Voice Agent ("Aria").
 *
 * Implements:
 * - 16-bit linear PCM conversion (Float32 to signed 16-bit Little-Endian)
 * - Linear PCM to Float32 normalization
 * - Linear interpolation audio resampling / downsampling
 * - Base64 PCM encoding and decoding
 * - Test vector generator (synthetic sine wave, silence)
 */

/**
 * Converts Float32Array [-1.0, 1.0] audio samples to 16-bit linear PCM buffer (Little-Endian).
 * Clamps out-of-bound samples to prevent integer overflow distortion.
 *
 * @param {Float32Array|Array<number>} float32Array
 * @returns {Buffer} Buffer containing 16-bit PCM bytes
 */
export function floatTo16BitPCM(float32Array) {
  if (!float32Array || float32Array.length === 0) {
    return Buffer.alloc(0);
  }

  const length = float32Array.length;
  const buffer = Buffer.alloc(length * 2);

  for (let i = 0; i < length; i++) {
    // Clamp to [-1.0, 1.0]
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    // Scale: positive samples to 0x7FFF (32767), negative to 0x8000 (-32768)
    const intSample = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7FFF);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, intSample)), i * 2);
  }

  return buffer;
}

/**
 * Converts 16-bit linear PCM buffer (Little-Endian) to Float32Array [-1.0, 1.0].
 *
 * @param {Buffer|Uint8Array} pcmBuffer
 * @returns {Float32Array}
 */
export function pcm16ToFloat32(pcmBuffer) {
  if (!pcmBuffer || pcmBuffer.length === 0) {
    return new Float32Array(0);
  }

  const sampleCount = Math.floor(pcmBuffer.length / 2);
  const float32 = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const int16 = pcmBuffer.readInt16LE(i * 2);
    float32[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7FFF;
  }

  return float32;
}

/**
 * Resamples / downsamples audio from sourceSampleRate to targetSampleRate
 * using linear interpolation.
 *
 * @param {Float32Array} sourceBuffer - Source audio samples
 * @param {number} sourceRate - Original sample rate (e.g. 48000 or 44100)
 * @param {number} targetRate - Target sample rate (e.g. 16000 or 24000)
 * @returns {Float32Array} Resampled audio samples
 */
export function downsampleAudio(sourceBuffer, sourceRate, targetRate) {
  if (!sourceBuffer || sourceBuffer.length === 0) {
    return new Float32Array(0);
  }

  if (sourceRate === targetRate) {
    return new Float32Array(sourceBuffer);
  }

  if (sourceRate <= 0 || targetRate <= 0) {
    throw new Error('Sample rates must be positive numbers.');
  }

  const ratio = sourceRate / targetRate;
  const newLength = Math.round(sourceBuffer.length / ratio);
  const result = new Float32Array(newLength);

  let offsetResult = 0;
  let offsetSource = 0;

  while (offsetResult < result.length) {
    const nextOffsetSource = Math.round((offsetResult + 1) * ratio);
    // Linear average / interpolation
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
 * Encodes PCM buffer or byte array into standard Base64 string.
 *
 * @param {Buffer|Uint8Array} buffer
 * @returns {string} Base64 representation
 */
export function pcmToBase64(buffer) {
  if (!buffer) return '';
  return Buffer.isBuffer(buffer) ? buffer.toString('base64') : Buffer.from(buffer).toString('base64');
}

/**
 * Decodes Base64 string into raw PCM Buffer.
 *
 * @param {string} base64String
 * @returns {Buffer} Raw PCM buffer
 */
export function base64ToPcm(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    return Buffer.alloc(0);
  }
  return Buffer.from(base64String, 'base64');
}

/**
 * Generates synthetic sine wave samples for audio test vectors.
 *
 * @param {number} frequencyHz - Tone frequency (e.g. 440 Hz for concert A)
 * @param {number} durationSec - Duration in seconds
 * @param {number} sampleRate - Sample rate in Hz (e.g. 16000)
 * @param {number} [amplitude=0.5] - Normalized amplitude [0.0, 1.0]
 * @returns {Float32Array}
 */
export function generateSineWave(frequencyHz, durationSec, sampleRate = 16000, amplitude = 0.5) {
  const numSamples = Math.floor(sampleRate * durationSec);
  const samples = new Float32Array(numSamples);
  const angularFreq = 2 * Math.PI * frequencyHz;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    samples[i] = amplitude * Math.sin(angularFreq * t);
  }

  return samples;
}

export default {
  floatTo16BitPCM,
  pcm16ToFloat32,
  downsampleAudio,
  pcmToBase64,
  base64ToPcm,
  generateSineWave
};
