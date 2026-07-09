import { getPrisma } from './PrismaManager';
import { DEFAULT_SETTINGS } from '../../shared/constants';

export class SettingsManager {
  static async get(key: string): Promise<string | null> {
    const prisma = getPrisma();
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting?.value || null;
  }

  static async set(key: string, value: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  static async getAll(): Promise<Record<string, string>> {
    const prisma = getPrisma();
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  static async updateAll(settings: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      await SettingsManager.set(key, value);
    }
  }

  static async reset(): Promise<void> {
    await SettingsManager.updateAll(DEFAULT_SETTINGS as unknown as Record<string, string>);
  }

  static async getNumber(key: string, defaultVal: number): Promise<number> {
    const val = await SettingsManager.get(key);
    return val ? parseInt(val, 10) : defaultVal;
  }

  static async getBoolean(key: string, defaultVal: boolean): Promise<boolean> {
    const val = await SettingsManager.get(key);
    return val ? val === 'true' : defaultVal;
  }
}
