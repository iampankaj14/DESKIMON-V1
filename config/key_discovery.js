/**
 * key_discovery.js
 *
 * Scans process.env (or an override object) for keys matching the pattern PREFIX_1, PREFIX_2, ... PREFIX_N.
 * Stops at the first gap. This allows adding/removing provider keys purely through
 * environment variable changes — no code modification required.
 *
 * Usage:
 *   const { discoverKeys } = require('./config/key_discovery');
 *   const groqKeys = discoverKeys('GROQ_KEY');     // reads GROQ_KEY_1, GROQ_KEY_2, ...
 *   const geminiKeys = discoverKeys('GEMINI_KEY');
 */

/**
 * @param {string} prefix - Environment variable prefix (e.g. 'GROQ_KEY')
 * @param {object} [envOverride] - Optional env object (for testing). Defaults to process.env.
 * @returns {string[]} Array of non-empty key values found
 */
function discoverKeys(prefix, envOverride = null) {
  const env = envOverride || process.env;
  const keys = [];
  let i = 1;

  while (true) {
    const val = env[`${prefix}_${i}`];
    if (!val || val.trim() === '') break;
    keys.push(val.trim());
    i++;
  }

  if (keys.length === 0) {
    console.warn(`[KeyDiscovery] No keys found for prefix "${prefix}".`);
  } else {
    console.log(`[KeyDiscovery] Discovered ${keys.length} key(s) for prefix "${prefix}".`);
  }

  return keys;
}

module.exports = { discoverKeys };
