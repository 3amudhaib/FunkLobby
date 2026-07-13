import { ipcMain } from 'electron';
import { DownloadManager } from '../managers/DownloadManager';
import { getPrisma } from '../managers/PrismaManager';
import { LogManager } from '../managers/LogManager';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerDownloadIpc() {
  ipcMain.handle(IPC_CHANNELS.START_DOWNLOAD, async (_event, params) => {
    const { modId, url, fileName, hash } = params;

    // Ensure the Mod record exists to prevent Prisma P2003 foreign key error
    const prisma = getPrisma();
    const existingMod = await prisma.mod.findUnique({ where: { id: modId } });
    if (!existingMod) {
      await prisma.mod.create({
        data: {
          id: modId,
          title: (fileName || '').replace(/\.(zip|7z|rar)$/i, '') || 'Unknown Mod',
          author: 'Unknown',
          version: '1.0.0',
          description: '',
          engine: url.includes('gamebanana.com') ? 'psych' : 'standalone',
          category: 'Other',
          tags: '', homepage: '', bannerUrl: '', thumbnailUrl: '',
          fileSize: 0, downloadCount: 0,
          sourceUrl: url,
          sourceType: url.includes('gamebanana.com') ? 'gamebanana' : 'direct',
          dependencies: '', requirements: '', changelog: '',
          screenshots: '', videos: '', characters: '', songs: '',
          difficulty: 'Normal',
        },
      });
      LogManager.info('Created stub Mod record for download', { modId });
    }

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
