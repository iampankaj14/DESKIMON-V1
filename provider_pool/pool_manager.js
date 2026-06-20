/**
 * pool_manager.js
 *
 * Manages a pool of API keys for one provider type (STT, LLM, or TTS).
 *
 * Key states:
 *   IDLE         → available for use
 *   COOLING_DOWN → failed, on cooldown timer
 *   RECOVERING   → cooldown expired, awaiting health check
 *   DEAD         → auth failed (401/403), manual intervention required
 *
 * Selection: round-robin across IDLE keys only.
 * Cooldown: exponential backoff. Rate-limited keys: 60s→120s→...→600s.
 *           Quota-exhausted keys: 24 hours.
 *           Auth-invalid keys: DEAD immediately.
 */

const { classifyError, ERROR_TYPE } = require('./error_classifier');

const KEY_STATE = {
  IDLE: 'IDLE',
  COOLING_DOWN: 'COOLING_DOWN',
  RECOVERING: 'RECOVERING',
  DEAD: 'DEAD'
};

const BASE_COOLDOWN_MS   = 60_000;       // 1 minute
const MAX_COOLDOWN_MS    = 600_000;      // 10 minutes cap for rate limits
const QUOTA_COOLDOWN_MS  = 86_400_000;  // 24 hours for quota exhaustion

class PoolManager {
  /**
   * @param {string} poolId  - Human-readable name: 'STT_GROQ', 'LLM_GEMINI', 'TTS_ELEVENLABS'
   * @param {string[]} keys  - Array of API key strings discovered from env
   */
  constructor(poolId, keys) {
    if (!keys || keys.length === 0) {
      console.warn(`[Pool:${poolId}] WARNING: No keys provided. Pool will always fail.`);
    }

    this.poolId = poolId;
    this.rrIndex = 0;  // Round-robin cursor

    // Internal state for each key
    this._keys = (keys || []).map((keyValue, idx) => ({
      index: idx + 1,           // 1-based for logging
      value: keyValue,
      state: KEY_STATE.IDLE,
      failCount: 0,
      cooldownMs: BASE_COOLDOWN_MS,
      coolingUntil: null,
      usageCount: 0,
      lastFailedAt: null,
      lastErrorType: null
    }));

    console.log(`[Pool:${poolId}] Initialized with ${this._keys.length} key(s).`);
  }

  /**
   * Get the next available key using round-robin.
   * Returns null if all keys are COOLING or DEAD.
   */
  getNextKey() {
    const available = this._keys.filter(k => k.state === KEY_STATE.IDLE);
    if (available.length === 0) return null;

    const key = available[this.rrIndex % available.length];
    this.rrIndex = (this.rrIndex + 1) % available.length;
    return key;
  }

  /**
   * Record a successful API call for a key.
   */
  markSuccess(keyIndex) {
    const key = this._findByIndex(keyIndex);
    if (!key) return;
    key.state = KEY_STATE.IDLE;
    key.failCount = 0;
    key.cooldownMs = BASE_COOLDOWN_MS; // reset backoff
    key.usageCount++;
    key.lastErrorType = null;
  }

  /**
   * Record a failed API call for a key. Applies appropriate cooldown.
   * @param {number} keyIndex
   * @param {Error} error - The raw error from the provider call
   */
  markFailure(keyIndex, error) {
    const key = this._findByIndex(keyIndex);
    if (!key) return;

    const errorType = classifyError(error);
    key.failCount++;
    key.lastFailedAt = Date.now();
    key.lastErrorType = errorType;

    if (errorType === ERROR_TYPE.AUTH_INVALID) {
      key.state = KEY_STATE.DEAD;
      console.error(`[Pool:${this.poolId}] Key #${keyIndex} is DEAD (AUTH_INVALID). Manual replacement needed.`);
      return;
    }

    if (errorType === ERROR_TYPE.QUOTA_EXHAUSTED) {
      key.cooldownMs = QUOTA_COOLDOWN_MS;
    } else {
      // RATE_LIMITED, SERVER_ERROR, TIMEOUT, NETWORK — exponential backoff
      key.cooldownMs = Math.min(key.cooldownMs * 2, MAX_COOLDOWN_MS);
    }

    key.state = KEY_STATE.COOLING_DOWN;
    key.coolingUntil = Date.now() + key.cooldownMs;
    console.warn(`[Pool:${this.poolId}] Key #${keyIndex} cooling down for ${key.cooldownMs / 1000}s. Reason: ${errorType}. Fail count: ${key.failCount}.`);
  }

  /**
   * Returns a summary of the pool's current state.
   */
  getStatus() {
    return {
      poolId: this.poolId,
      total: this._keys.length,
      idle: this._keys.filter(k => k.state === KEY_STATE.IDLE).length,
      cooling: this._keys.filter(k => k.state === KEY_STATE.COOLING_DOWN).length,
      recovering: this._keys.filter(k => k.state === KEY_STATE.RECOVERING).length,
      dead: this._keys.filter(k => k.state === KEY_STATE.DEAD).length,
      keys: this._keys.map(k => ({
        index: k.index,
        state: k.state,
        failCount: k.failCount,
        usageCount: k.usageCount,
        coolingUntilMs: k.coolingUntil
      }))
    };
  }

  /**
   * Called by recovery worker.
   * Promotes COOLING_DOWN keys whose cooldown has expired to RECOVERING,
   * then calls the health check callback and promotes to IDLE on success.
   *
   * @param {Function} healthCheckFn  async (keyValue) => boolean
   */
  async runRecovery(healthCheckFn) {
    const now = Date.now();
    for (const key of this._keys) {
      if (key.state === KEY_STATE.COOLING_DOWN && key.coolingUntil && now >= key.coolingUntil) {
        key.state = KEY_STATE.RECOVERING;
        console.log(`[Pool:${this.poolId}] Key #${key.index} cooldown expired. Running health check...`);

        try {
          const healthy = await healthCheckFn(key.value);
          if (healthy) {
            key.state = KEY_STATE.IDLE;
            key.failCount = 0;
            key.cooldownMs = BASE_COOLDOWN_MS;
            key.coolingUntil = null;
            console.log(`[Pool:${this.poolId}] Key #${key.index} RECOVERED → IDLE.`);
          } else {
            // Health check failed — extend cooldown
            key.cooldownMs = Math.min(key.cooldownMs * 2, MAX_COOLDOWN_MS);
            key.coolingUntil = Date.now() + key.cooldownMs;
            key.state = KEY_STATE.COOLING_DOWN;
            console.warn(`[Pool:${this.poolId}] Key #${key.index} health check failed. Extended cooldown to ${key.cooldownMs / 1000}s.`);
          }
        } catch (err) {
          key.cooldownMs = Math.min(key.cooldownMs * 2, MAX_COOLDOWN_MS);
          key.coolingUntil = Date.now() + key.cooldownMs;
          key.state = KEY_STATE.COOLING_DOWN;
          console.warn(`[Pool:${this.poolId}] Key #${key.index} health check threw. Extended cooldown. Error: ${err.message}`);
        }
      }
    }
  }

  _findByIndex(index) {
    return this._keys.find(k => k.index === index) || null;
  }
}

/**
 * Core failover function.
 * Calls the provider with automatic key rotation on failure.
 *
 * @param {PoolManager} pool
 * @param {Function} callFn  async (keyValue) => result
 * @returns {Promise<{ok: boolean, data: any, error: string|null}>}
 */
async function callWithFailover(pool, callFn) {
  const tried = new Set();

  while (true) {
    const key = pool.getNextKey();

    if (!key || tried.has(key.index)) {
      // All available keys tried or pool is empty
      console.error(`[Pool:${pool.poolId}] ALL KEYS FAILED. Tried keys: [${[...tried].join(', ')}]`);
      return { ok: false, data: null, error: 'ALL_KEYS_FAILED' };
    }

    tried.add(key.index);

    try {
      const result = await callFn(key.value);
      pool.markSuccess(key.index);
      return { ok: true, data: result, error: null };
    } catch (err) {
      pool.markFailure(key.index, err);

      // If all remaining keys are exhausted, stop
      const remaining = pool._keys.filter(k => k.state === KEY_STATE.IDLE && !tried.has(k.index));
      if (remaining.length === 0) {
        console.error(`[Pool:${pool.poolId}] No more keys to try. Last error: ${err.message}`);
        return { ok: false, data: null, error: 'ALL_KEYS_FAILED' };
      }
      // Otherwise loop and try next available key
    }
  }
}

module.exports = { PoolManager, callWithFailover, KEY_STATE };
