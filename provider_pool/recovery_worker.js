/**
 * recovery_worker.js
 *
 * Background worker that periodically:
 *  1. Checks all pools for keys whose cooldown has expired
 *  2. Runs a lightweight health check on each expired key
 *  3. Restores healthy keys to IDLE state
 *
 * Runs every 30 seconds (or customized interval) via setInterval.
 */

const RECOVERY_INTERVAL_MS = 30_000; // 30 seconds

class RecoveryWorker {
  constructor() {
    this.pools = [];     // Array of { pool: PoolManager, healthCheckFn: async(keyValue) => bool }
    this.intervalId = null;
  }

  /**
   * Register a pool with its health check function.
   * @param {PoolManager} pool
   * @param {Function} healthCheckFn  async (keyValue: string) => boolean
   */
  register(pool, healthCheckFn) {
    this.pools.push({ pool, healthCheckFn });
    console.log(`[RecoveryWorker] Registered pool: ${pool.poolId}`);
  }

  /**
   * Start the background recovery loop.
   */
  start(intervalMs = RECOVERY_INTERVAL_MS) {
    if (this.intervalId) return; // Already running
    this.intervalId = setInterval(() => this._runCycle(), intervalMs);
    console.log(`[RecoveryWorker] Started background recovery. Checking every ${intervalMs / 1000}s.`);
  }

  /**
   * Stop the recovery loop (useful for graceful shutdown or tests).
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[RecoveryWorker] Stopped.');
    }
  }

  async _runCycle() {
    for (const { pool, healthCheckFn } of this.pools) {
      try {
        await pool.runRecovery(healthCheckFn);
      } catch (err) {
        console.error(`[RecoveryWorker] Unhandled error in pool ${pool.poolId}: ${err.message}`);
      }
    }
  }
}

// Export a singleton
const recoveryWorker = new RecoveryWorker();
module.exports = recoveryWorker;
