import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { PrismaClient } from '../../../dist/generated/prisma-client';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    const isDev = !app.isPackaged;
    const dbPath = isDev
      ? path.join(app.getAppPath(), 'prisma', 'funklobby.db')
      : path.join(app.getPath('userData'), 'funklobby.db');

    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${dbPath}`,
        },
      },
    });
  }
  return prisma;
}

export async function initDatabase() {
  const client = getPrisma();
  await client.$connect();

  try {
    const tables = await client.$queryRawUnsafe<{ cnt: number }[]>(
      "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table'"
    );
    const tableCount = tables[0]?.cnt || 0;

    if (tableCount === 0) {
      await pushSchema();
    } else {
      await migrateSchema(client);
    }

    const existingSettings = await client.setting.findFirst().catch(() => null);
    if (!existingSettings) {
      await seedDatabase(client);
    }
  } catch (err) {
    console.error('Database initialization error:', err);
    try {
      await pushSchema();
      await seedDatabase(client);
    } catch (seedErr) {
      console.error('Fallback init failed:', seedErr);
    }
  }
}

async function migrateSchema(client: PrismaClient) {
  const modColumns = ['coverPath', 'customCover', 'detectedEngines'];
  for (const col of modColumns) {
    try {
      const type = col === 'customCover' ? 'INTEGER' : col === 'detectedEngines' ? 'TEXT NOT NULL DEFAULT \'[]\'' : 'TEXT';
      await client.$executeRawUnsafe(`ALTER TABLE Mod ADD COLUMN ${col} ${type};`);
    } catch {
      // Column already exists — ensure no NULL values for detectedEngines
      if (col === 'detectedEngines') {
        try {
          await client.$executeRawUnsafe(`UPDATE Mod SET detectedEngines = '[]' WHERE detectedEngines IS NULL;`);
        } catch {}
      }
    }
  }
  const engineColumns = [
    'description', 'author', 'repoUrl', 'websiteUrl', 'downloadUrl',
    'releaseUrl', 'installPath', 'exePath', 'logoUrl', 'features', 'platforms',
    'license', 'status', 'error', 'installedAt', 'lastUpdatedAt', 'backupPath',
    'importSource',
  ];
  for (const col of engineColumns) {
    try {
      await client.$executeRawUnsafe(`ALTER TABLE Engine ADD COLUMN ${col} TEXT;`);
    } catch {
      // column already exists, ignore
    }
  }
  try {
    await client.$executeRawUnsafe(`UPDATE Engine SET installPath = path WHERE installPath IS NULL AND path IS NOT NULL;`);
  } catch {
    // path column may not exist, ignore
  }
  try {
    await client.$executeRawUnsafe(`UPDATE Engine SET status = 'installed' WHERE status IS NULL AND installPath IS NOT NULL;`);
  } catch {
    // status column may not exist, ignore
  }
}

async function pushSchema() {
  const prisma = getPrisma();

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS Mod (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      version TEXT NOT NULL,
      description TEXT NOT NULL,
      engine TEXT NOT NULL,
      tags TEXT NOT NULL,
      category TEXT NOT NULL,
      homepage TEXT NOT NULL,
      bannerUrl TEXT NOT NULL,
      thumbnailUrl TEXT NOT NULL,
      fileSize INTEGER NOT NULL,
      downloadCount INTEGER NOT NULL DEFAULT 0,
      sourceUrl TEXT NOT NULL,
      sourceType TEXT NOT NULL,
      isInstalled INTEGER NOT NULL DEFAULT 0,
      installedAt TEXT,
      updatedAt TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT '',
      dependencies TEXT NOT NULL,
      requirements TEXT NOT NULL,
      changelog TEXT NOT NULL,
      screenshots TEXT NOT NULL,
      videos TEXT NOT NULL,
      characters TEXT NOT NULL,
      songs TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      isFeatured INTEGER NOT NULL DEFAULT 0,
      isTrending INTEGER NOT NULL DEFAULT 0,
      isPopular INTEGER NOT NULL DEFAULT 0,
      isFavorited INTEGER NOT NULL DEFAULT 0,
      coverPath TEXT,
      customCover INTEGER NOT NULL DEFAULT 0,
      detectedEngines TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS Download (
      id TEXT PRIMARY KEY,
      modId TEXT NOT NULL,
      url TEXT NOT NULL,
      fileName TEXT NOT NULL,
      filePath TEXT NOT NULL,
      totalBytes INTEGER NOT NULL,
      downloadedBytes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      speed REAL NOT NULL DEFAULT 0,
      eta INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT '',
      hash TEXT,
      FOREIGN KEY (modId) REFERENCES Mod(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS Install (
      id TEXT PRIMARY KEY,
      modId TEXT NOT NULL,
      profileId TEXT NOT NULL,
      enginePath TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'installed',
      enabled INTEGER NOT NULL DEFAULT 1,
      lastPlayedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT '',
      backupPath TEXT,
      FOREIGN KEY (modId) REFERENCES Mod(id) ON DELETE CASCADE,
      FOREIGN KEY (profileId) REFERENCES Profile(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS Profile (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      isDefault INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS Engine (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      version TEXT,
      description TEXT,
      author TEXT,
      repoUrl TEXT,
      websiteUrl TEXT,
      downloadUrl TEXT,
      releaseUrl TEXT,
      installPath TEXT,
      exePath TEXT,
      logoUrl TEXT,
      features TEXT,
      platforms TEXT,
      license TEXT,
      status TEXT NOT NULL DEFAULT 'not_installed',
      error TEXT,
      isCustom INTEGER NOT NULL DEFAULT 0,
      isDetected INTEGER NOT NULL DEFAULT 0,
      importSource TEXT,
      installedAt TEXT,
      lastUpdatedAt TEXT,
      backupPath TEXT,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS Setting (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS Log (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      createdAt TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS Collection (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      coverUrl TEXT,
      modIds TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );
  `;

  const statements = createTableSQL.split(';').filter(s => s.trim().length > 0);
  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt + ';');
    } catch (e) {
      console.error('SQL error:', e);
    }
  }
}

function nowISO(): string {
  return new Date().toISOString();
}

async function seedDatabase(client: any) {
  const now = nowISO();
  await client.setting.createMany({
    data: [
      { key: 'theme', value: 'dark' },
      { key: 'language', value: 'en' },
      { key: 'downloadFolder', value: '' },
      { key: 'gameFolder', value: '' },
      { key: 'engineFolders', value: '[]' },
      { key: 'defaultEngine', value: 'psych' },
      { key: 'concurrentDownloads', value: '3' },
      { key: 'animations', value: 'true' },
      { key: 'notifications', value: 'true' },
      { key: 'autoUpdate', value: 'true' },
      { key: 'autoUpdateMods', value: 'true' },
    ],
  }).catch((err: any) => {
    console.error('Failed to seed settings:', err);
  });

  const existingProfile = await client.profile.findFirst().catch(() => null);
  if (!existingProfile) {
    await client.profile.create({
      data: {
        name: 'Default',
        description: 'Default profile',
        isDefault: true,
        color: '#3b82f6',
        createdAt: now,
        updatedAt: now,
      },
    }).catch((err: any) => {
      console.error('Failed to create default profile:', err);
    });
  }
}

export async function closeDatabase() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
