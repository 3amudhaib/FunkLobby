import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

export const asyncFs = {
  exists: async (p: string): Promise<boolean> => {
    try { await fsp.access(p, fs.constants.F_OK); return true; }
    catch { return false; }
  },

  stat: (p: string): Promise<fs.Stats> => fsp.stat(p),

  readFile: (p: string, encoding?: BufferEncoding): Promise<string> =>
    fsp.readFile(p, encoding) as Promise<string>,

  readBuffer: (p: string): Promise<Buffer> => fsp.readFile(p),

  writeFile: (p: string, data: string | Buffer): Promise<void> =>
    fsp.writeFile(p, data),

  readdir: (p: string, opts?: { withFileTypes?: boolean; recursive?: boolean }): Promise<(string | fs.Dirent)[]> =>
    opts?.withFileTypes ? fsp.readdir(p, { withFileTypes: true }) as Promise<fs.Dirent[]>
    : fsp.readdir(p) as Promise<string[]>,

  mkdir: (p: string, opts?: { recursive?: boolean }): Promise<string | undefined> =>
    fsp.mkdir(p, opts),

  rm: (p: string, opts?: { recursive?: boolean; force?: boolean }): Promise<void> =>
    fsp.rm(p, opts),

  copyFile: (src: string, dest: string): Promise<void> => fsp.copyFile(src, dest),

  unlink: (p: string): Promise<void> => fsp.unlink(p),

  rename: (src: string, dest: string): Promise<void> => fsp.rename(src, dest),

  readlink: (p: string): Promise<string> => fsp.readlink(p),

  lstat: (p: string): Promise<fs.Stats> => fsp.lstat(p),

  ensureDir: async (p: string): Promise<void> => {
    const exists = await asyncFs.exists(p);
    if (!exists) await fsp.mkdir(p, { recursive: true });
  },

  size: async (p: string): Promise<number> => {
    try { const s = await fsp.stat(p); return s.size; }
    catch { return 0; }
  },

  isDir: async (p: string): Promise<boolean> => {
    try { const s = await fsp.stat(p); return s.isDirectory(); }
    catch { return false; }
  },
};