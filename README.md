# API Key Rotation and Failover System

A lightweight, robust key rotation system in Node.js designed to survive rate limits, quota exhaustions, and authorization failures without downtime.

## Features
- **Dynamic Key Discovery**: Scan and load sequential environment keys (`KEY_1`, `KEY_2`, ...) without hardcoding.
- **Failover Wrapper**: Run your API calls inside a `callWithFailover` function which automatically handles errors, marks failures, and switches keys.
- **Error Classification**: Distinguishes between transient rate-limiting errors (exponential backoff), quota exhaustion (24-hour backoff), and invalid keys (marked `DEAD`).
- **Self-Healing Recovery Worker**: Background daemon checks keys on cooling down and runs a lightweight healthcheck to promote them back to the active pool when healthy.

## Project Structure
```
key-rotation-system/
├── config/
│   └── key_discovery.js     # Dynamically scans env keys
├── provider_pool/
│   ├── error_classifier.js  # Classifies error strings into canonical types
│   ├── cooldown_manager.js  # Cooldown calculations
│   ├── pool_manager.js      # Core pool tracking & round-robin logic
│   └── recovery_worker.js   # Periodic checks of keys on cooldown
├── demo.js                  # Simulation of error scenarios & failovers
└── package.json             # Node.js project file
```

## Running the Demo
You can run the simulated run:
```bash
node demo.js
```
This demo shows:
1. Dynamic key discovery loading keys.
2. A rate-limited key (#1) being cooled down, and the call automatically failing over to Key #2.
3. An unauthorized key (#2) being marked as permanent `DEAD`.
4. Key #3 successfully handling the request.
5. The next request directly using Key #3 because Key #1 is cooling down and Key #2 is DEAD.
6. A recovery check running to promote Key #1 back to `IDLE` status.
7. Subsequent calls successfully utilizing the recovered Key #1.
