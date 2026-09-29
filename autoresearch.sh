#!/usr/bin/env bash
set -euo pipefail

# Deterministic benchmark runner for Noir Translator Idle Power Optimization
# Measures idle power cost, memory footprint (RSS), open handles/file descriptors, context switches, and API responsiveness
bun run scripts/idle-benchmark.ts
