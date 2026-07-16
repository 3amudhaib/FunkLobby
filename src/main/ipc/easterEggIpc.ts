import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { EasterEggManager } from '../managers/EasterEggManager';

export function registerEasterEggIpc(): void {
  ipcMain.handle(IPC_CHANNELS.EASTER_EGG_TRIGGER, async (_event) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win) return;
    await EasterEggManager.trigger(win);
  });
}
