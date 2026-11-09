import env from '../config/env.js';

const INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

// Human-readable India time of the moment the line is printed, e.g. "9 Nov 2026, 9:30:00 pm IST"
const stamp = (): string =>
  `${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' })} IST`;

// Calls our own public /health URL. Going through the public address (not in-process) is deliberate: it proves
// the whole path works, and the inbound request counts as traffic, which keeps a free Render instance from idling out.
const runCheck = async (baseUrl: string): Promise<void> => {
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(15_000) });
    const body = (await res.json().catch(() => null)) as { db?: string } | null;
    const line = `[health] ${stamp()} | ${res.ok ? 'OK' : 'DEGRADED'} | HTTP ${res.status} | db: ${body?.db ?? 'unknown'} | ${Date.now() - started} ms`;
    if (res.ok) console.log(line);
    else console.error(line);
  } catch (err) {
    console.error(`[health] ${stamp()} | FAILED | ${(err as Error).message}`);
  }
};

const startHealthMonitor = (port: number): void => {
  const baseUrl = env.healthCheckUrl || `http://localhost:${port}`;
  console.log(`[health] ${stamp()} | monitor started, checking ${baseUrl}/health every ${INTERVAL_MS / 60000} minutes`);
  void runCheck(baseUrl);
  setInterval(() => void runCheck(baseUrl), INTERVAL_MS);
};

export { startHealthMonitor };
