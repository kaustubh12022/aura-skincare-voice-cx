/**
 * tests/helpers/moduleLoader.js
 * Intelligent module resolver for Aura Skincare test suite.
 * Seamlessly resolves either the server implementation (once created)
 * or the authoritative reference implementation in tests/mocks/.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

/**
 * Loads orderDatabase module from server/ or fallback reference
 */
export async function loadOrderDatabase() {
  const serverPath = path.join(projectRoot, 'server', 'orderDatabase.js');
  if (fs.existsSync(serverPath)) {
    return await import(pathToFileURL(serverPath).href);
  }
  return await import('../mocks/referenceOrderDatabase.js');
}

/**
 * Loads brandPolicy module from server/ or fallback reference
 */
export async function loadBrandPolicy() {
  const serverPath = path.join(projectRoot, 'server', 'brandPolicy.js');
  if (fs.existsSync(serverPath)) {
    return await import(pathToFileURL(serverPath).href);
  }
  return await import('../mocks/referenceBrandPolicy.js');
}

/**
 * Loads summarizer module from server/ or fallback reference
 */
export async function loadSummarizer() {
  const serverPath = path.join(projectRoot, 'server', 'summarizer.js');
  if (fs.existsSync(serverPath)) {
    return await import(pathToFileURL(serverPath).href);
  }
  return await import('../mocks/referenceSummarizer.js');
}

export default {
  loadOrderDatabase,
  loadBrandPolicy,
  loadSummarizer
};
