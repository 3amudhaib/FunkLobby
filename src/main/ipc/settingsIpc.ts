import { ipcMain } from 'electron';
import { SettingsManager } from '../managers/SettingsManager';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerSettingsIpc() {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return await SettingsManager.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, async (_event, settings: Record<string, string>) => {
    await SettingsManager.updateAll(settings);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RESET_SETTINGS, async () => {
    await SettingsManager.reset();
    return { success: true };
  });
}
