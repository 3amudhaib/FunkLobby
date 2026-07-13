import { ipcMain } from 'electron';
import { SettingsManager } from '../managers/SettingsManager';
import { ThemeIconManager } from '../managers/ThemeIconManager';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerSettingsIpc() {
  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return await SettingsManager.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_SETTINGS, async (_event, settings: Record<string, string>) => {
    await SettingsManager.updateAll(settings);
    if (settings.theme) {
      await ThemeIconManager.setTheme(settings.theme);
      await ThemeIconManager.saveTheme(settings.theme);
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RESET_SETTINGS, async () => {
    await SettingsManager.reset();
    await ThemeIconManager.setTheme('dark');
    await ThemeIconManager.saveTheme('dark');
    return { success: true };
  });
}
