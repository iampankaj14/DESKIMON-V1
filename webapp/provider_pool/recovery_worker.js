/**
 * recovery_worker.js
 *
 * Background worker that calls pool.tick() on all registered pools
 * every 30 seconds to promote cooled-down keys back to IDLE.
 *
 * No HTTP health checks — tick() uses local timestamps only.
 * Zero network calls, zero latency impact.
 */

const TICK_INTERVAL_MS = 30_000; // 30 seconds

class RecoveryWorker {
  constructor() {
    this.pools      = [];
    this.intervalId = null;
  }

  /** Register a pool to be ticked. */
  register(pool) {
    this.pools.push(pool);
  }

  /** Start the background tick loop. Safe to call multiple times. */
  start() {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this._tick(), TICK_INTERVAL_MS);
    // Allow Node.js to exit even if this interval is running
    if (this.intervalId.unref) this.intervalId.unref();
    console.log(`[RecoveryWorker] Started. Ticking every ${TICK_INTERVAL_MS / 1000}s.`);
  }

  /** Stop the tick loop (e.g. for graceful shutdown). */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[RecoveryWorker] Stopped.');
    }
  }

  _tick() {
    for (const pool of this.pools) {
      try {
        pool.tick();
      } catch (err) {
        console.error(`[RecoveryWorker] Error ticking pool ${pool.poolId}: ${err.message}`);
      }
    }
  }
}

// Singleton — one worker manages all pools
const recoveryWorker = new RecoveryWorker();
module.exports = recoveryWorker;
