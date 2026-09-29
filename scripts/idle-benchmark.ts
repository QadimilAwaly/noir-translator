import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import { setTimeout as delay } from 'timers/promises';

interface ProcStats {
  utime: number;
  stime: number;
  rssMb: number;
  vol: number;
  invol: number;
  fds: number;
  threads: number;
}

const PORT = 3999;
const TEST_ENV = {
  ...process.env,
  PORT: String(PORT),
  HOST: '127.0.0.1',
  NODE_ENV: 'production',
};

function readProcStats(pid: number): ProcStats {
  const statParts = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(' ');
  const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
  const fds = fs.readdirSync(`/proc/${pid}/fd`).length;

  const utime = parseInt(statParts[13], 10) || 0;
  const stime = parseInt(statParts[14], 10) || 0;
  const rssKbMatch = status.match(/VmRSS:\s+(\d+)\s+kB/);
  const rssMb = rssKbMatch ? parseInt(rssKbMatch[1], 10) / 1024 : (parseInt(statParts[23], 10) * 4096) / (1024 * 1024);

  const volMatch = status.match(/voluntary_ctxt_switches:\s+(\d+)/);
  const involMatch = status.match(/nonvoluntary_ctxt_switches:\s+(\d+)/);
  const threadsMatch = status.match(/Threads:\s+(\d+)/);

  return {
    utime,
    stime,
    rssMb,
    vol: volMatch ? parseInt(volMatch[1], 10) : 0,
    invol: involMatch ? parseInt(involMatch[1], 10) : 0,
    fds,
    threads: threadsMatch ? parseInt(threadsMatch[1], 10) : 1,
  };
}

function httpRequest(options: {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  agent?: http.Agent;
}): Promise<{ status: number; data: string }> {
  const { promise, resolve, reject } = Promise.withResolvers<{ status: number; data: string }>();
  const req = http.request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: options.path,
      method: options.method || 'GET',
      headers: options.headers || {},
      agent: options.agent,
    },
    (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode || 0, data }));
    }
  );
  req.on('error', reject);
  if (options.body) req.write(options.body);
  req.end();
  return promise;
}

async function run() {
  // 1. Compile server bundle
  let buildStderr = '';
  const esbuild = spawn(
    './node_modules/.bin/esbuild',
    [
      'server.ts',
      '--bundle',
      '--platform=node',
      '--format=esm',
      '--packages=external',
      '--sourcemap',
      '--outfile=dist/server.js',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  esbuild.stderr?.on('data', (d) => {
    buildStderr += d.toString();
  });
  const { promise: buildPromise, resolve: resolveBuild } = Promise.withResolvers<number>();
  esbuild.on('close', (code) => resolveBuild(code ?? 1));
  const buildExitCode = await buildPromise;

  if (buildExitCode !== 0) {
    throw new Error(`esbuild compilation failed with exit code ${buildExitCode}: ${buildStderr}`);
  }


  // 2. Launch server
  const server = spawn('node', ['--expose-gc', 'dist/server.js'], {
    env: TEST_ENV,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const pid = server.pid;
  if (!pid) {
    throw new Error('Failed to obtain server PID');
  }

  // Wait for server ready
  const { promise: readyPromise, resolve: resolveReady, reject: rejectReady } = Promise.withResolvers<void>();
  const readyTimer = setTimeout(() => rejectReady(new Error('Server failed to start within 10s')), 10000);
  server.stdout?.on('data', (chunk: Buffer) => {
    if (chunk.toString().includes('Listening on http://')) {
      clearTimeout(readyTimer);
      resolveReady();
    }
  });
  server.on('exit', (code) => {
    clearTimeout(readyTimer);
    rejectReady(new Error(`Server exited prematurely with code ${code}`));
  });
  await readyPromise;

  try {
    // 3. Settle startup
    await delay(500);
    const coldStats = readProcStats(pid);

    // 4. Activity burst (simulate realistic mobile client usage)
    const agent = new http.Agent({ keepAlive: true, maxSockets: 5 });
    const burstStart = Date.now();
    const NUM_REQUESTS = 30;

    for (let i = 0; i < NUM_REQUESTS; i++) {
      if (i % 2 === 0) {
        await httpRequest({ path: '/api/config', agent });
      } else {
        await httpRequest({ path: '/api/storage', agent });
      }
    }

    // 1 state sync write
    const testNovelId = `bench-idle-${Date.now()}`;
    await httpRequest({
      path: '/api/storage/sync',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        novels: [
          {
            id: testNovelId,
            judul: 'Idle Benchmark Test',
            folder_path: '',
            bahasa_sumber: 'Inggris',
            bahasa_target: 'Indonesia',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
      agent,
    });

    const burstDurationMs = Date.now() - burstStart;
    const avgLatencyMs = burstDurationMs / (NUM_REQUESTS + 1);

    // Clean up novel
    await httpRequest({
      path: '/api/storage/delete-novel',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novel_id: testNovelId }),
      agent,
    });

    // Close client sockets
    agent.destroy();

    // 5. Idle transition settle
    await delay(1000);

    // 6. Sustained Idle Window (3000 ms)
    const s0 = readProcStats(pid);
    const IDLE_WINDOW_MS = 3000;
    await delay(IDLE_WINDOW_MS);
    const s1 = readProcStats(pid);

    // Compute idle deltas
    const deltaUtime = Math.max(0, s1.utime - s0.utime);
    const deltaStime = Math.max(0, s1.stime - s0.stime);
    const deltaCpuTicks = deltaUtime + deltaStime;
    const deltaVol = Math.max(0, s1.vol - s0.vol);
    const deltaInvol = Math.max(0, s1.invol - s0.invol);
    const totalContextSwitches = deltaVol + deltaInvol;
    const idleRssMb = s1.rssMb;
    const openFds = s1.fds;

    // Physics-grounded Mobile Idle Power Score:
    // P = (RSS * 0.08) + (open_fds * 0.20) + (context_switches * 0.50) + (cpu_ticks * 2.0)
    const idlePowerScore =
      idleRssMb * 0.08 + openFds * 0.2 + totalContextSwitches * 0.5 + deltaCpuTicks * 2.0;

    // Print METRIC output
    console.log(`METRIC idle_power_cost=${idlePowerScore.toFixed(2)}`);
    console.log(`METRIC idle_rss_mb=${idleRssMb.toFixed(2)}`);
    console.log(`METRIC open_fds=${openFds}`);
    console.log(`METRIC idle_context_switches=${totalContextSwitches}`);
    console.log(`METRIC idle_cpu_ticks=${deltaCpuTicks}`);
    console.log(`METRIC avg_latency_ms=${avgLatencyMs.toFixed(2)}`);
    console.log(`METRIC cold_rss_mb=${coldStats.rssMb.toFixed(2)}`);
  } finally {
    try {
      server.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
}

run().catch((err) => {
  console.error('Benchmark execution failed:', err);
  process.exit(1);
});
