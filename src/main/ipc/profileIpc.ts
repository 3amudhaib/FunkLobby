import { ipcMain } from 'electron';
import { getPrisma } from '../managers/PrismaManager';
import { IPC_CHANNELS } from '../../shared/constants';

export function registerProfileIpc() {
  ipcMain.handle(IPC_CHANNELS.CREATE_PROFILE, async (_event, name: string, description?: string) => {
    const prisma = getPrisma();
    const count = await prisma.profile.count();
    return await prisma.profile.create({
      data: {
        name,
        description: description || null,
        isDefault: count === 0,
        color: `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`,
      },
    });
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_PROFILE, async (_event, id: string) => {
    const prisma = getPrisma();
    const profile = await prisma.profile.findUnique({ where: { id } });
    if (!profile) throw new Error('Profile not found');
    if (profile.isDefault) throw new Error('Cannot delete default profile');

    const defaultProfile = await prisma.profile.findFirst({ where: { isDefault: true } });
    if (defaultProfile) {
      await prisma.install.updateMany({
        where: { profileId: id },
        data: { profileId: defaultProfile.id },
      });
    }

    await prisma.profile.delete({ where: { id } });
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_PROFILES, async () => {
    const prisma = getPrisma();
    return await prisma.profile.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { installs: true } } },
    });
  });

  ipcMain.handle(IPC_CHANNELS.SET_DEFAULT_PROFILE, async (_event, id: string) => {
    const prisma = getPrisma();
    await prisma.profile.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    await prisma.profile.update({ where: { id }, data: { isDefault: true } });
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SWITCH_PROFILE, async (_event, id: string) => {
    const prisma = getPrisma();
    const profile = await prisma.profile.findUnique({ where: { id } });
    if (!profile) throw new Error('Profile not found');
    await prisma.profile.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    await prisma.profile.update({ where: { id }, data: { isDefault: true } });
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_PROFILE, async (_event, id: string, data: any) => {
    const prisma = getPrisma();
    const allowed = ['name', 'description', 'color', 'isDefault'];
    const sanitized: Record<string, any> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) sanitized[key] = data[key];
    }
    if (Object.keys(sanitized).length === 0) throw new Error('No valid fields to update');
    return await prisma.profile.update({ where: { id }, data: sanitized });
  });
}
