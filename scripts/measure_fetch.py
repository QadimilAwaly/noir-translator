#!/usr/bin/env python3
import subprocess, sys, time, resource, os
url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/chapters"
# Measure child CPU via getrusage delta
t1 = time.perf_counter()
usage_before = resource.getrusage(resource.RUSAGE_CHILDREN)
proc = subprocess.run(
    ["curl", "-s", "-o", "/dev/null", "-w", "%{size_download} %{time_total}\n",
     "--connect-timeout", "2", "--max-time", "5", url],
    capture_output=True, text=True)
t2 = time.perf_counter()
usage_after = resource.getrusage(resource.RUSAGE_CHILDREN)
child_cpu_s = (usage_after.ru_utime - usage_before.ru_utime) + (usage_after.ru_stime - usage_before.ru_stime)
out = proc.stdout.strip()
parts = out.split()
download_bytes = int(parts[0]) if len(parts) > 0 else 0
latency_s = float(parts[1]) if len(parts) > 1 else 0.0
# Print metric lines
print(f"METRIC download_bytes={download_bytes}")
print(f"METRIC latency_s={latency_s}")
# Convert to ms
print(f"METRIC latency_ms={round(latency_s*1000,2)}")
# CPU user time approximate (child total CPU - sys) roughly; just report total child CPU ms
print(f"METRIC cpu_user_ms={round(child_cpu_s*1000,2)}")
