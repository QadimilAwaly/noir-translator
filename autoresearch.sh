#!/usr/bin/env bash
set -euo pipefail

# Deterministic benchmark runner for Noir Translator
# Measures pipeline efficiency, storage persistence, user control, and error handling resilience
bun run scripts/benchmark.ts
