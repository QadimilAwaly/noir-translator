#!/usr/bin/env bash
set -euo pipefail
# Benchmark: network payload size + latency over loopback (Tailscale tunnel proxy),
# with trimmed payload and compressed payload comparisons.
# Constraint: minimize additional CPU load (no compression-on-the-fly during fetch,
# only file-size measurement and single curl fetch for latency).

cd "$(dirname "$0")"

# Ensure fixture exists deterministically
if [ ! -f fixture_chapters.json ]; then
    python3 scripts/gen_fixture.py
fi

# Trimmed payload: remove heavy optional fields (metadata, refs, long text) to reduce bytes
python3 - << 'PY'
import json
with open("fixture_chapters.json") as f: data = json.load(f)
for c in data["chapters"]:
    c.pop("metadata", None)
    c.pop("glossary_refs", None)
    c.pop("references", None)
    # truncate content to first 200 chars (simulates lazy/load-on-demand)
    txt = c.get("konten_text", "")
    if isinstance(txt, str) and len(txt) > 200:
        c["konten_text"] = txt[:200] + "..."
with open("fixture_trimmed.json", "w") as f: json.dump(data, f)
PY

# Compressed payload sizes (no CPU during fetch; pure file measurement)
uncompressed_bytes=$(stat -c%s fixture_chapters.json)
trimmed_bytes=$(stat -c%s fixture_trimmed.json)
compressed_bytes=$(gzip -k -c fixture_chapters.json | wc -c)

# Start server in background
python3 scripts/serve_fixture.py &
SERVER_PID=$!
sleep 2

# Latency + download size over loopback (simulates Tailscale HTTP tunnel payload)
python3 scripts/measure_fetch.py http://localhost:8765/chapters

# Kill server
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "METRIC payload_bytes=$uncompressed_bytes"
echo "METRIC trimmed_bytes=$trimmed_bytes"
echo "METRIC compressed_bytes=$compressed_bytes"
echo "METRIC payload_reduction_percent=$(python3 -c "print(round((1-$trimmed_bytes/$uncompressed_bytes)*100,1))")"
