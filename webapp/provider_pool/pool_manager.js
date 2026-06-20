/**
 * pool_manager.js
 *
 * Manages a pool of API keys for one provider (STT, LLM, or TTS).
 *
 * Key states:
 *   IDLE         → available, will be selected by round-robin
 *   COOLING_DOWN → failed, on timed cooldown
 *   DEAD         → auth failed (401/403), requires manual key replacement
 *
 * Selection: round-robin across IDLE keys only.
 * Cooldown:  exponential backoff starting at 60s, capped at 10min.
 *            Quota/payment errors: 24h cooldown.
 *            Auth errors: DEAD immediately (no retry).
 */

const { classifyError, ERROR_TYPE } = require('./error_classifier');

const KEY_STATE = {
  IDLE:         'IDLE',
  COOLING_DOWN: 'COOLING_DOWN',
  DEAD:         'DEAD'
};

const BASE_COOLDOWN_MS  = 60_000;       //  1 minute
const MAX_COOLDOWN_MS   = 600_000;      // 10 minutes
const QUOTA_COOLDOWN_MS = 86_400_000;   // 24 hours

class PoolManager {
  /**
   * @param {string}   poolId - Human-readable name: 'STT_GROQ', 'LLM_GEMINI', 'TTS_ELEVENLABS'
   * @param {string[]} keys   - Array of API key strings
   */
  constructor(poolId, keys) {
    this.poolId  = poolId;
    this.rrIndex = 0;

    this._keys = (keys || []).map((value, idx) => ({
      index:        idx + 1,
      value,
      state:        KEY_STATE.IDLE,
      failCount:    0,
      cooldownMs:   BASE_COOLDOWN_MS,
      coolingUntil: null,
      usageCount:   0,
      lastErrorType: null
    }));

    if (this._keys.length === 0) {
      console.warn(`[Pool:${poolId}] WARNING: initialized with 0 keys. All calls will fail.`);
    } else {
      console.log(`[Pool:${poolId}] Initialized with ${this._keys.length} key(s).`);
    }
  }

  // ─── Public ─────────────────────────────────────────────────────────────

  /** Get the next IDLE key using round-robin. Returns null if no keys available. */
  getNextKey() {
    const idle = this._keys.filter(k => k.state === KEY_STATE.IDLE);
    if (idle.length === 0) return null;

    const key = idle[this.rrIndex % idle.length];
    this.rrIndex = (this.rrIndex + 1) % idle.length;
    return key;
  }

  /** Record a successful call. Resets key's backoff. */
  markSuccess(keyIndex) {
    const key = this._find(keyIndex);
    if (!key) return;
    key.state        = KEY_STATE.IDLE;
    key.failCount    = 0;
    key.cooldownMs   = BASE_COOLDOWN_MS;
    key.coolingUntil = null;
    key.usageCount++;
    key.lastErrorType = null;
  }

  /** Record a failed call. Applies cooldown or marks DEAD. */
  markFailure(keyIndex, error) {
    const key = this._find(keyIndex);
    if (!key) return;

    const errorType = classifyError(error);
    key.failCount++;
    key.lastErrorType = errorType;

    if (errorType === ERROR_TYPE.AUTH_INVALID) {
      key.state = KEY_STATE.DEAD;
      console.error(`[Pool:${this.poolId}] Key #${keyIndex} → DEAD (${errorType}). Replace this key.`);
      return;
    }

    const cooldown = (errorType === ERROR_TYPE.QUOTA_EXHAUSTED)
      ? QUOTA_COOLDOWN_MS
      : Math.min(key.cooldownMs * 2, MAX_COOLDOWN_MS);

    key.cooldownMs   = cooldown;
    key.coolingUntil = Date.now() + cooldown;
    key.state        = KEY_STATE.COOLING_DOWN;

    const cooldownSec = Math.round(cooldown / 1000);
    console.warn(`[Pool:${this.poolId}] Key #${keyIndex} → COOLING (${errorType}) for ${cooldownSec}s. Failures: ${key.failCount}.`);
  }

  /** Promote keys whose cooldown has expired back to IDLE. Call every 30s. */
  tick() {
    const now = Date.now();
    for (const key of this._keys) {
      if (key.state === KEY_STATE.COOLING_DOWN && key.coolingUntil && now >= key.coolingUntil) {
        key.state        = KEY_STATE.IDLE;
        key.coolingUntil = null;
        key.failCount    = 0;
        key.cooldownMs   = BASE_COOLDOWN_MS;
        console.log(`[Pool:${this.poolId}] Key #${key.index} → IDLE (cooldown expired, recovered).`);
      }
    }
  }

  /** Pool status summary for health endpoint. */
  getStatus() {
    return {
      poolId:   this.poolId,
      total:    this._keys.length,
      idle:     this._keys.filter(k => k.state === KEY_STATE.IDLE).length,
      cooling:  this._keys.filter(k => k.state === KEY_STATE.COOLING_DOWN).length,
      dead:     this._keys.filter(k => k.state === KEY_STATE.DEAD).length,
      keys:     this._keys.map(k => ({
        index:        k.index,
        state:        k.state,
        failCount:    k.failCount,
        usageCount:   k.usageCount,
        coolingUntilMs: k.coolingUntil,
        lastErrorType:  k.lastErrorType
      }))
    };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  _find(index) {
    return this._keys.find(k => k.index === index) || null;
  }
}

/**
 * Calls the provider with automatic key rotation on failure.
 * Tries every IDLE key before giving up.
 *
 * @param {PoolManager} pool
 * @param {Function}    callFn   async (keyValue: string) => any
 * @returns {{ ok: boolean, data: any, error: string|null }}
 */
async function callWithFailover(pool, callFn) {
  const tried = new Set();

  while (true) {
    const key = pool.getNextKey();

    if (!key || tried.has(key.index)) {
      console.error(`[Pool:${pool.poolId}] All keys exhausted. Tried: [${[...tried].join(',')}]`);
      return { ok: false, data: null, error: 'ALL_KEYS_EXHAUSTED' };
    }

    tried.add(key.index);

    try {
      const result = await callFn(key.value);
      pool.markSuccess(key.index);
      return { ok: true, data: result, error: null };
    } catch (err) {
      pool.markFailure(key.index, err);

      // Check if any IDLE keys remain to try
      const remaining = pool._keys.filter(
        k => k.state === KEY_STATE.IDLE && !tried.has(k.index)
      );
      if (remaining.length === 0) {
        console.error(`[Pool:${pool.poolId}] No more IDLE keys. Last error: ${err.message}`);
        return { ok: false, data: null, error: err.message };
      }
      // Loop and try next key
    }
  }
}

module.exports = { PoolManager, callWithFailover, KEY_STATE };
