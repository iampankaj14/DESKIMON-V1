/**
 * key_discovery.js
 *
 * Scans the loaded env object for keys matching the pattern:
 *   PREFIX_1, PREFIX_2, ..., PREFIX_N
 *
 * Stops at the first gap. Returns an array of non-empty values.
 *
 * Usage:
 *   const { discoverKeys } = require('./config/key_discovery');
 *   const groqKeys   = discoverKeys('GROQ_KEY', env);
 *   const geminiKeys = discoverKeys('GEMINI_KEY', env);
 *   const elKeys     = discoverKeys('ELEVENLABS_KEY', env);
 *
 * .env.local convention:
 *   GROQ_KEY_1=gsk_aaa...
 *   GROQ_KEY_2=gsk_bbb...
 *   GEMINI_KEY_1=AIza...
 *   ELEVENLABS_KEY_1=abc123...
 *
 * @param {string} prefix     - e.g. 'GROQ_KEY'
 * @param {object} env        - parsed env object (from server_daemon.js loader)
 * @param {object} [fallback] - single legacy key value to use if no _N keys found
 * @returns {string[]}        - array of key strings, empty array if none found
 */
function discoverKeys(prefix, env = {}, fallback = null) {
  const keys = [];
  let i = 1;

  while (true) {
    const val = env[`${prefix}_${i}`] || process.env[`${prefix}_${i}`];
    if (!val || val.trim() === '') break;
    keys.push(val.trim());
    i++;

    // Safety cap: never read more than 20 keys per prefix
    if (i > 20) break;
  }

  if (keys.length === 0 && fallback && fallback.trim() !== '') {
    // Graceful fallback to single legacy key (backward compat during migration)
    console.log(`[KeyDiscovery] No ${prefix}_N keys found. Using legacy fallback key.`);
    return [fallback.trim()];
  }

  if (keys.length === 0) {
    console.warn(`[KeyDiscovery] WARNING: No keys found for prefix "${prefix}". Check your .env.local file.`);
    return [];
  }

  console.log(`[KeyDiscovery] "${prefix}": found ${keys.length} key(s).`);
  return keys;
}

module.exports = { discoverKeys };
