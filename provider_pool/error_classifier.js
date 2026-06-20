/**
 * error_classifier.js
 *
 * Classifies a raw provider error into a canonical ErrorType.
 * This drives cooldown duration in pool_manager.js.
 */

const ERROR_TYPE = {
  RATE_LIMITED:     'RATE_LIMITED',       // HTTP 429 (transient)
  QUOTA_EXHAUSTED:  'QUOTA_EXHAUSTED',    // HTTP 429 + quota message (24h cooldown)
  AUTH_INVALID:     'AUTH_INVALID',       // HTTP 401 / 403 (key is dead)
  SERVER_ERROR:     'SERVER_ERROR',       // HTTP 5xx (transient)
  TIMEOUT:          'TIMEOUT',            // Network timeout
  NETWORK:          'NETWORK',            // Connection refused, DNS fail
  UNKNOWN:          'UNKNOWN'
};

/**
 * @param {Error} error - Raw error thrown by a provider call
 * @returns {string} One of ERROR_TYPE values
 */
function classifyError(error) {
  const message = (error?.message || '').toLowerCase();

  // Parse HTTP status from error message patterns like "HTTP 429"
  const statusMatch = message.match(/http (\d{3})/);
  const status = statusMatch ? parseInt(statusMatch[1]) : null;

  if (status === 401 || status === 403) return ERROR_TYPE.AUTH_INVALID;

  if (status === 429) {
    // Distinguish quota exhaustion from rate limiting
    if (message.includes('quota') || message.includes('exhausted') || message.includes('limit exceeded')) {
      return ERROR_TYPE.QUOTA_EXHAUSTED;
    }
    return ERROR_TYPE.RATE_LIMITED;
  }

  if (status >= 500 && status < 600) return ERROR_TYPE.SERVER_ERROR;

  if (message.includes('timeout') || message.includes('timed out')) return ERROR_TYPE.TIMEOUT;

  if (message.includes('econnrefused') || message.includes('enotfound') ||
      message.includes('fetch failed') || message.includes('network')) {
    return ERROR_TYPE.NETWORK;
  }

  return ERROR_TYPE.UNKNOWN;
}

module.exports = { classifyError, ERROR_TYPE };
