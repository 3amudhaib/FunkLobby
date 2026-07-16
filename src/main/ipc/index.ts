import { registerModIpc } from './modIpc';
import { registerDownloadIpc } from './downloadIpc';
import { registerEngineIpc } from './engineIpc';
import { registerProfileIpc } from './profileIpc';
import { registerSettingsIpc } from './settingsIpc';
import { registerFileIpc } from './fileIpc';
import { registerAppIpc } from './appIpc';
import { registerUpdateIpc } from './updateIpc';
import { registerDiscoverIpc } from './discoverIpc';
import { registerEasterEggIpc } from './easterEggIpc';

export function registerAllIpc() {
  registerModIpc();
  registerDownloadIpc();
  registerEngineIpc();
  registerProfileIpc();
  registerSettingsIpc();
  registerFileIpc();
  registerAppIpc();
  registerUpdateIpc();
  registerDiscoverIpc();
  registerEasterEggIpc();
}
