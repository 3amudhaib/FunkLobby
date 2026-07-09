import { getPrisma } from './PrismaManager';

export class LogManager {
  static async info(message: string, details?: any) {
    await LogManager.log('info', message, details);
  }

  static async warn(message: string, details?: any) {
    await LogManager.log('warn', message, details);
  }

  static async error(message: string, details?: any) {
    await LogManager.log('error', message, details);
  }

  static async debug(message: string, details?: any) {
    await LogManager.log('debug', message, details);
  }

  private static dbReady = false;
  private static pendingLogs: Array<{ level: string; message: string; details?: any }> = [];

  static markDbReady() {
    this.dbReady = true;
    for (const log of this.pendingLogs) {
      this.logToDb(log.level, log.message, log.details).catch(() => {});
    }
    this.pendingLogs = [];
  }

  private static async logToDb(level: string, message: string, details?: any) {
    if (!this.dbReady) {
      this.pendingLogs.push({ level, message, details });
      return;
    }
    const prisma = getPrisma();
    await prisma.log.create({
      data: { level, message, details: details ? JSON.stringify(details) : null },
    });
  }

  private static async log(level: string, message: string, details?: any) {
    try {
      await this.logToDb(level, message, details);
    } catch {
      console.error(`[${level.toUpperCase()}] ${message}`, details || '');
    }
  }

  static async getLogs(level?: string) {
    try {
      const prisma = getPrisma();
      const where = level && level !== 'all' ? { level } : {};
      return await prisma.log.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
    } catch {
      return [];
    }
  }
}
