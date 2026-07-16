import { ipcMain } from 'electron';
import { GameBananaSearch } from '../managers/GameBananaSearch';

export function registerDiscoverIpc() {
  ipcMain.handle('discover:getSection', async (_event, section: string) => {
    switch (section) {
      case 'trending':
        return await GameBananaSearch.getTrendingMods();
      case 'updated':
        return await GameBananaSearch.getRecentlyUpdatedMods();
      case 'popular':
        return await GameBananaSearch.getMostDownloadedMods();
      case 'favorites':
        return await GameBananaSearch.getCommunityFavoritesMods();
      case 'featured':
        return await GameBananaSearch.getFeaturedMods();
      case 'newest':
        return await GameBananaSearch.getRecentlyAddedMods();
      default:
        return [];
    }
  });

  ipcMain.handle('discover:getRichDetails', async (_event, gameBananaId: number) => {
    return await GameBananaSearch.getRichModDetails(gameBananaId);
  });

  ipcMain.handle('discover:search', async (_event, params: {
    query?: string; category?: string; engine?: string; sortBy?: string; page?: number; limit?: number;
  }) => {
    return await GameBananaSearch.searchMods({
      query: params.query,
      category: params.category === 'All' ? undefined : params.category,
      engine: params.engine || undefined,
      sortBy: params.sortBy || 'trending',
      page: params.page || 1,
      limit: params.limit || 30,
    });
  });

  ipcMain.handle('discover:downloadUrl', async (_event, gameBananaId: number) => {
    return await GameBananaSearch.getModDownloadUrl(gameBananaId);
  });

  ipcMain.handle('discover:getStats', async (_event, gameBananaId: number) => {
    return await GameBananaSearch.getModStats(gameBananaId);
  });

  ipcMain.handle('discover:getComments', async (_event, gameBananaId: number, page: number) => {
    return await GameBananaSearch.getModComments(gameBananaId, page);
  });
}
