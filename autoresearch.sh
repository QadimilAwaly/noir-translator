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
# Use time to capture user CPU time of curl only
CURL_OUT=$(mktemp curl_out.XXXXXX)
TIME_ERR=$(mktemp time_err.XXXXXX)
(/bin/time -p curl -s -o /dev/null -w '%{size_download} %{time_total}\n' \
  --connect-timeout 2 --max-time 5 \
  http://localhost:8765/chapters) > "$CURL_OUT" 2> "$TIME_ERR" || true
curl_output=$(cat "$CURL_OUT" 2>/dev/null)
cpu_user_s=$(grep "user" "$TIME_ERR" 2>/dev/null | awk '{print $2}' | tail -n1 || echo "0")
if [ -z "$cpu_user_s" ]; then cpu_user_s=0; fi
rm -f "$CURL_OUT" "$TIME_ERR"
read -r download_bytes latency_s <<< "$curl_output" || { download_bytes=0; latency_s=0; }
# Convert
cpu_user_s=${cpu_user_s:-0}; cpu_user_ms=$(python3 -c "print(round(float('$cpu_user_s')*1000, 2))")
latency_s=${latency_s:-0}; latency_ms=$(python3 -c "print(round(float('$latency_s')*1000, 2))")

# Kill server
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

echo "METRIC payload_bytes=$uncompressed_bytes"
echo "METRIC trimmed_bytes=$trimmed_bytes"
echo "METRIC compressed_bytes=$compressed_bytes"
echo "METRIC download_bytes=$download_bytes"
echo "METRIC latency_ms=$latency_ms"
echo "METRIC cpu_user_ms=$cpu_user_ms"
echo "METRIC payload_reduction_percent=$(python3 -c "print(round((1-$trimmed_bytes/$uncompressed_bytes)*100,1))")"
