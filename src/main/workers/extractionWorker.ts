import { parentPort, workerData } from 'worker_threads';
import extractZip from 'extract-zip';
import fsp from 'fs/promises';
import path from 'path';

interface ExtractJob {
  type: 'extract' | 'validate' | 'list' | 'copy_checksums';
  jobId: string;
  zipPath: string;
  destination?: string;
  files?: string[];
  expectedSizes?: Record<string, number>;
}

if (!parentPort) throw new Error('Must run as worker thread');

const worker = parentPort!;

async function listFilesRecursive(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function handleJob(job: ExtractJob) {
  const { jobId, zipPath, destination, files } = job;
  const jobType = job.type;

  try {
    if (jobType === 'validate') {
      let valid = false;
      try {
        const stat = await fsp.stat(zipPath);
        if (stat.size > 0) {
          const fd = await fsp.open(zipPath, 'r');
          const buf = Buffer.alloc(4);
          await fd.read(buf, 0, 4, 0);
          await fd.close();
          valid = buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
        }
      } catch {}

      worker.postMessage({ type: 'result', jobId, result: valid });
      return;
    }

    if (jobType === 'list') {
      const fileList = await listFilesRecursive(zipPath);
      worker.postMessage({ type: 'result', jobId, files: fileList });
      return;
    }

    if (jobType === 'extract') {
      await fsp.mkdir(destination!, { recursive: true });

      try {
        await extractZip(zipPath, { dir: destination! });
      } catch (err) {
        worker.postMessage({
          type: 'result', jobId, success: false,
          error: `Extraction failed: ${(err as Error).message}`,
        });
        return;
      }

      const extractedFiles = await listFilesRecursive(destination!);
      worker.postMessage({
        type: 'result', jobId, success: true, files: extractedFiles,
      });
      return;
    }

    if (jobType === 'copy_checksums') {
      const issues: string[] = [];
      const srcDir = zipPath;
      const destDir = destination!;
      const checkFiles = files || [];

      await fsp.mkdir(destDir, { recursive: true });

      for (const file of checkFiles) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);
        try {
          await fsp.mkdir(path.dirname(destPath), { recursive: true });
          await fsp.copyFile(srcPath, destPath);
        } catch (err) {
          issues.push(`Failed to copy ${file}: ${(err as Error).message}`);
        }
      }

      worker.postMessage({
        type: 'result', jobId, success: issues.length === 0, files: checkFiles, issues,
      });
      return;
    }

    worker.postMessage({
      type: 'result', jobId, success: false,
      error: `Unknown job type: ${jobType}`,
    });
  } catch (err) {
    worker.postMessage({
      type: 'result', jobId, success: false,
      error: (err as Error).message || 'Worker error',
    });
  }
}

handleJob(workerData as ExtractJob);