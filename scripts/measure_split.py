#!/usr/bin/env python3
import subprocess, sys, time, resource
urls = ["http://localhost:8765/chapters", "http://localhost:8765/chapters/1"]
usage_before = resource.getrusage(resource.RUSAGE_CHILDREN)
t1 = time.perf_counter()
down_bytes = 0
latency_s = 0.0
for url in urls:
    proc = subprocess.run(["curl","-s","-o","/dev/null","-w","%{size_download} %{time_total}\n","--connect-timeout","2","--max-time","5",url], capture_output=True, text=True)
    out = proc.stdout.strip().split()
    if out:
        down_bytes += int(out[0]) if out[0].isdigit() else 0
        if len(out) > 1:
            latency_s += float(out[1])
t2 = time.perf_counter()
usage_after = resource.getrusage(resource.RUSAGE_CHILDREN)
child_cpu = (usage_after.ru_utime-usage_before.ru_utime)+(usage_after.ru_stime-usage_before.ru_stime)
print(f"METRIC combined_payload_bytes={down_bytes}")
print(f"METRIC combined_latency_s={latency_s}")
print(f"METRIC combined_latency_ms={round(latency_s*1000,2)}")
print(f"METRIC combined_cpu_user_ms={round(child_cpu*1000,2)}")
