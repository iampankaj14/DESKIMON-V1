/**
 * cooldown_manager.js
 *
 * Utility functions for computing and checking cooldown timers.
 * Stateless — pure functions only.
 */

const BASE_COOLDOWN_MS  = 60_000;
const MAX_COOLDOWN_MS   = 600_000;
const QUOTA_COOLDOWN_MS = 86_400_000;

const { ERROR_TYPE } = require('./error_classifier');

/**
 * Computes the cooldown duration for a given error type and current backoff state.
 * @param {string} errorType
 * @param {number} currentCooldownMs - Previous cooldown in ms
 * @returns {number} New cooldown in ms
 */
function computeCooldown(errorType, currentCooldownMs = BASE_COOLDOWN_MS) {
  if (errorType === ERROR_TYPE.QUOTA_EXHAUSTED) {
    return QUOTA_COOLDOWN_MS;
  }
  // Exponential backoff for all transient errors
  return Math.min(currentCooldownMs * 2, MAX_COOLDOWN_MS);
}

/**
 * Returns true if a key's cooldown has expired and it should be health-checked.
 * @param {number|null} coolingUntil - Timestamp when cooldown ends
 * @returns {boolean}
 */
function isCooldownExpired(coolingUntil) {
  if (!coolingUntil) return true;
  return Date.now() >= coolingUntil;
}

/**
 * Returns human-readable summary of cooldown remaining.
 * @param {number|null} coolingUntil
 * @returns {string}
 */
function cooldownRemaining(coolingUntil) {
  if (!coolingUntil) return 'none';
  const remainMs = coolingUntil - Date.now();
  if (remainMs <= 0) return 'expired';
  const seconds = Math.ceil(remainMs / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.ceil(seconds / 60)}m`;
}

module.exports = {
  computeCooldown,
  isCooldownExpired,
  cooldownRemaining,
  BASE_COOLDOWN_MS,
  MAX_COOLDOWN_MS,
  QUOTA_COOLDOWN_MS
};
