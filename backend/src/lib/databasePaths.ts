import path from "path";

/** Strip Prisma/SQLite URL query params (e.g. ?busy_timeout=10000). */
function sqliteFilePathFromUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Backup is only supported for SQLite file databases.");
  }

  let filePath = databaseUrl.slice("file:".length);
  const queryIndex = filePath.indexOf("?");
  if (queryIndex !== -1) {
    filePath = filePath.slice(0, queryIndex);
  }

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  // Prisma resolves relative SQLite paths from the schema directory (prisma/).
  const prismaDir = path.resolve(process.cwd(), "prisma");
  return path.resolve(prismaDir, filePath);
}

export function getDatabasePath() {
  return sqliteFilePathFromUrl(process.env.DATABASE_URL ?? "file:./dev.db");
}

export function getDataDir() {
  return path.dirname(getDatabasePath());
}

export function getUploadDir() {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  return path.join(path.resolve(process.cwd()), "uploads");
}

export function getBackupDir() {
  const configured = process.env.BACKUP_DIR?.trim();
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  return path.join(getDataDir(), "backups");
}
