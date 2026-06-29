import path from "path";

function databaseFileFromUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Backup is only supported for SQLite file databases.");
  }

  const filePath = databaseUrl.slice("file:".length);
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

export function getDatabasePath() {
  return databaseFileFromUrl(process.env.DATABASE_URL ?? "file:./dev.db");
}

export function getDataDir() {
  return path.dirname(getDatabasePath());
}

export function getUploadDir() {
  return process.env.UPLOAD_DIR?.trim() || path.join(getDataDir(), "uploads");
}

export function getBackupDir() {
  const configured = process.env.BACKUP_DIR?.trim();
  if (configured) return path.resolve(configured);
  return path.join(getDataDir(), "backups");
}
