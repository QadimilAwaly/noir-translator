#!/usr/bin/env bash
set -euo pipefail

# Deterministic benchmark runner for Noir Translator Latency Optimization
# Measures end-to-end pipeline latency across storage I/O, context filtering, prompt assembly, error handling, and chapter operations
# Strict constraint: No browser storage or caching allowed
bun run scripts/benchmark.ts
