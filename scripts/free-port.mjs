import { execSync } from 'child_process';
const port = process.argv[2] || '5173';
try {
  const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', timeout: 5000 });
  const pids = new Set();
  for (const line of output.trim().split('\n')) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }
  for (const pid of pids) {
    try { execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore', timeout: 3000 }); } catch {}
  }
} catch {}
