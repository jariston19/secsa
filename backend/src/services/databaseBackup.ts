import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { prisma } from "../lib/prisma.js";
import {
  getBackupDir,
  getDataDir,
  getDatabasePath,
  getUploadDir,
} from "../lib/databasePaths.js";

const execFileAsync = promisify(execFile);

const BACKUP_FILENAME_PATTERN =
  /^secsa-backup(?:-\d{8}(?:-\d{4})?)?\.tgz$|^secsa-backup-\d{8}\.tar\.gz$/;

export type BackupFileInfo = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
};

export type DatabaseSnapshot = {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  counts: {
    users: number;
    questions: number;
    examAttempts: number;
  };
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatBackupTimestamp(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function buildBackupFilename(date = new Date()) {
  return `secsa-backup-${formatBackupTimestamp(date)}.tgz`;
}

export function assertSafeBackupFilename(filename: string) {
  const base = path.basename(filename);
  if (base !== filename) {
    throw new Error("Invalid backup filename.");
  }
  if (!BACKUP_FILENAME_PATTERN.test(base)) {
    throw new Error("Unsupported backup filename.");
  }
  return base;
}

async function checkpointDatabase() {
  // wal_checkpoint returns rows; must use $queryRawUnsafe, not $executeRawUnsafe.
  await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
}

async function runTar(args: string[]) {
  await execFileAsync("tar", args, { windowsHide: true });
}

async function fileInfo(filePath: string): Promise<BackupFileInfo | null> {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return null;
    return {
      filename: path.basename(filePath),
      sizeBytes: fileStat.size,
      createdAt: fileStat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getDatabaseSnapshot(): Promise<DatabaseSnapshot> {
  const dbPath = getDatabasePath();
  const dbStat = await stat(dbPath);
  const [users, questions, examAttempts] = await Promise.all([
    prisma.user.count(),
    prisma.question.count(),
    prisma.examAttempt.count(),
  ]);

  return {
    path: dbPath,
    sizeBytes: dbStat.size,
    modifiedAt: dbStat.mtime.toISOString(),
    counts: { users, questions, examAttempts },
  };
}

export async function listBackupFiles(): Promise<BackupFileInfo[]> {
  const backupDir = await ensureBackupDir();
  const entries = await readdir(backupDir);
  const files = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".tgz") || entry.endsWith(".tar.gz"))
      .map((entry) => fileInfo(path.join(backupDir, entry)))
  );

  return files
    .filter((entry): entry is BackupFileInfo => Boolean(entry))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function ensureBackupDir() {
  const backupDir = getBackupDir();
  await mkdir(backupDir, { recursive: true });
  return backupDir;
}

export async function createDatabaseBackup() {
  await checkpointDatabase();

  const dataDir = getDataDir();
  const dbPath = getDatabasePath();
  const uploadDir = getUploadDir();
  const backupDir = await ensureBackupDir();
  const filename = buildBackupFilename();
  const archivePath = path.join(backupDir, filename);

  const relativeDbName = path.relative(dataDir, dbPath) || path.basename(dbPath);
  const relativeUploadDir = path.relative(dataDir, uploadDir);

  const tarArgs = ["-czf", archivePath, "-C", dataDir, relativeDbName];
  if (relativeUploadDir && relativeUploadDir !== "." && !relativeUploadDir.startsWith("..")) {
    try {
      await stat(uploadDir);
      tarArgs.push(relativeUploadDir);
    } catch {
      // uploads folder may not exist yet
    }
  }

  await runTar(tarArgs);

  const created = await fileInfo(archivePath);
  if (!created) {
    throw new Error("Backup file was not created.");
  }

  return created;
}

async function copyDirectoryContents(sourceDir: string, targetDir: string) {
  await mkdir(targetDir, { recursive: true });
  let entries: string[] = [];

  try {
    entries = await readdir(sourceDir);
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      if (entry === ".gitkeep") return;
      await copyFile(path.join(sourceDir, entry), path.join(targetDir, entry));
    })
  );
}

async function extractBackupArchive(archivePath: string, extractDir: string) {
  await mkdir(extractDir, { recursive: true });
  await runTar(["-xzf", archivePath, "-C", extractDir]);
}

export async function restoreDatabaseBackup(filename: string) {
  const backupDir = await ensureBackupDir();
  const safeName = assertSafeBackupFilename(filename);
  const archivePath = path.join(backupDir, safeName);
  await stat(archivePath);

  const safetyBackup = await createDatabaseBackup();
  const extractDir = path.join(backupDir, `.restore-${formatBackupTimestamp()}`);
  const dbPath = getDatabasePath();
  const uploadDir = getUploadDir();
  const dataDir = getDataDir();

  try {
    await extractBackupArchive(archivePath, extractDir);

    const extractedDbCandidates = [
      path.join(extractDir, path.basename(dbPath)),
      path.join(extractDir, "prod.db"),
      path.join(extractDir, "dev.db"),
    ];
    const extractedDbPath = await (async () => {
      for (const candidate of extractedDbCandidates) {
        try {
          const fileStat = await stat(candidate);
          if (fileStat.isFile()) return candidate;
        } catch {
          // try next candidate
        }
      }
      throw new Error("Backup archive does not contain a database file.");
    })();

    await prisma.$disconnect();

    const backupCurrentDbPath = `${dbPath}.restore-bak`;
    await copyFile(dbPath, backupCurrentDbPath);
    try {
      await copyFile(extractedDbPath, dbPath);
    } catch (error) {
      await copyFile(backupCurrentDbPath, dbPath);
      throw error;
    } finally {
      await rm(backupCurrentDbPath, { force: true });
    }

    const extractedUploadDir = path.join(extractDir, path.relative(dataDir, uploadDir));
    const legacyExtractedUploadDir = path.join(extractDir, "uploads");
    const sourceUploadDir = await (async () => {
      for (const candidate of [extractedUploadDir, legacyExtractedUploadDir]) {
        try {
          const dirStat = await stat(candidate);
          if (dirStat.isDirectory()) return candidate;
        } catch {
          // try next candidate
        }
      }
      return null;
    })();

    if (sourceUploadDir) {
      await rm(uploadDir, { recursive: true, force: true });
      await mkdir(path.dirname(uploadDir), { recursive: true });
      await copyDirectoryContents(sourceUploadDir, uploadDir);
    }

    return {
      restoredFrom: safeName,
      safetyBackup: safetyBackup.filename,
      requiresRestart: true,
    };
  } catch (error) {
    await prisma.$connect().catch(() => {});
    throw error;
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
}

export async function deleteBackupFile(filename: string) {
  const backupDir = await ensureBackupDir();
  const safeName = assertSafeBackupFilename(filename);
  await rm(path.join(backupDir, safeName), { force: true });
  return { deleted: safeName };
}

export function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}
