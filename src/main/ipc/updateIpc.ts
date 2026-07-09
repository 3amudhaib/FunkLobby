import { ipcMain } from 'electron';
import { UpdateManager } from '../managers/UpdateManager';
import { UPDATE_IPC_CHANNELS } from '../../shared/updateTypes';

export function registerUpdateIpc() {
  ipcMain.handle(UPDATE_IPC_CHANNELS.GET_STATE, async () => {
    return await UpdateManager.getState();
  });

  ipcMain.handle(UPDATE_IPC_CHANNELS.CHECK, async (_event, force: boolean = false) => {
    return UpdateManager.check(force);
  });

  ipcMain.handle(UPDATE_IPC_CHANNELS.DOWNLOAD, async () => {
    return await UpdateManager.download();
  });

  ipcMain.handle(UPDATE_IPC_CHANNELS.INSTALL, async () => {
    return await UpdateManager.install();
  });

  ipcMain.handle(UPDATE_IPC_CHANNELS.SET_CHANNEL, async (_event, channel: string) => {
    await UpdateManager.setChannel(channel as 'stable' | 'beta');
  });

  ipcMain.handle(UPDATE_IPC_CHANNELS.SET_AUTO_UPDATE, async (_event, enabled: boolean) => {
    await UpdateManager.setAutoUpdate(enabled);
  });

  ipcMain.handle(UPDATE_IPC_CHANNELS.GET_CHANNEL, async () => {
    return (await UpdateManager.getState()).channel;
  });

  ipcMain.handle(UPDATE_IPC_CHANNELS.GET_AUTO_UPDATE, async () => {
    return (await UpdateManager.getState()).autoUpdate;
  });
}