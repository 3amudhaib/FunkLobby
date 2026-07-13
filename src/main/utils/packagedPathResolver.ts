import fs from 'fs';
import path from 'path';
import { app } from 'electron';

interface ResolvePathOptions {
  appPath?: string;
  resourcesPath?: string;
  isPackaged?: boolean;
  exists?: (candidate: string) => boolean;
}

export function resolvePackagedAssetPath(relativeSegments: string[], options: ResolvePathOptions = {}): string {
  const appPath = options.appPath ?? app.getAppPath();
  const resourcesPath = options.resourcesPath ?? process.resourcesPath;
  const isPackaged = options.isPackaged ?? app.isPackaged;
  const exists = options.exists ?? ((candidate: string) => fs.existsSync(candidate));

  const candidates: string[] = [];

  if (isPackaged) {
    candidates.push(path.join(resourcesPath, ...relativeSegments));
    candidates.push(path.join(appPath, ...relativeSegments));
  } else {
    candidates.push(path.join(appPath, ...relativeSegments));
    candidates.push(path.join(resourcesPath, ...relativeSegments));
  }

  for (const candidate of candidates) {
    if (exists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export function getSafeChildProcessOptions(cwd: string) {
  return {
    cwd,
    windowsHide: false,
    shell: process.platform === 'win32',
    detached: false,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: undefined,
    },
  };
}
