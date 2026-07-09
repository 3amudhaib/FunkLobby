import { ipcMain } from 'electron';
import { DownloadManager } from '../managers/DownloadManager';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerDownloadIpc() {
  ipcMain.handle(IPC_CHANNELS.START_DOWNLOAD, async (_event, params) => {
    const { modId, url, fileName, hash } = params;
    return await DownloadManager.startDownload(modId, url, fileName, hash);
  });

  ipcMain.handle(IPC_CHANNELS.PAUSE_DOWNLOAD, async (_event, id: string) => {
    await DownloadManager.pauseDownload(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RESUME_DOWNLOAD, async (_event, id: string) => {
    await DownloadManager.resumeDownload(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CANCEL_DOWNLOAD, async (_event, id: string) => {
    await DownloadManager.cancelDownload(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.RETRY_DOWNLOAD, async (_event, id: string) => {
    await DownloadManager.retryDownload(id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_QUEUE, async () => {
    return await DownloadManager.getQueue();
  });
}
