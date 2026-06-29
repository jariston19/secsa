import { useCallback, useEffect, useState } from "react";
import ListPanel from "./ListPanel";
import ModalPagination from "./ModalPagination";
import PasswordConfirmDialog from "./PasswordConfirmDialog";
import { usePagination } from "../hooks/usePagination";
import { api } from "../lib/api";

type BackupFile = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
};

type BackupStatus = {
  database: {
    path: string;
    sizeBytes: number;
    modifiedAt: string;
    counts: {
      users: number;
      questions: number;
      examAttempts: number;
    };
  };
  backups: BackupFile[];
  lastBackup: BackupFile | null;
};

interface Props {
  token: string | null;
  onUpdated: (message: string, isError?: boolean) => void;
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString();
}

async function waitForBackendRecovery(token: string | null) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      await api("/backups", {}, token);
      return true;
    } catch {
      // backend still restarting
    }
  }
  return false;
}

export default function BackupRestorePanel({ token, onUpdated }: Props) {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: (password: string) => Promise<void>;
  } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<BackupStatus>("/backups", {}, token);
      setStatus(data);
    } catch (err) {
      onUpdated(err instanceof Error ? err.message : "Failed to load backup status.", true);
    } finally {
      setLoading(false);
    }
  }, [onUpdated, token]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const backups = status?.backups ?? [];
  const {
    paginatedItems: paginatedBackups,
    page,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    totalItems,
  } = usePagination(backups, { pageSize: 10, resetKey: backups.length });

  async function createBackup() {
    setCreating(true);
    try {
      const data = await api<{ backup: BackupFile }>(
        "/backups",
        { method: "POST" },
        token
      );
      onUpdated(`Backup created: ${data.backup.filename}`);
      await loadStatus();
    } catch (err) {
      onUpdated(err instanceof Error ? err.message : "Failed to create backup.", true);
    } finally {
      setCreating(false);
    }
  }

  function requestRestore(filename: string) {
    setPasswordPrompt({
      title: "Restore database?",
      confirmLabel: "Restore",
      message: `Restore from "${filename}"?\n\nA fresh safety backup will be created first. The app will restart and reload the restored database.`,
      onConfirm: async (password) => {
        setBusyFile(filename);
        try {
          await api(
            `/backups/${encodeURIComponent(filename)}/restore`,
            {
              method: "POST",
              body: JSON.stringify({ password }),
            },
            token
          );
          onUpdated("Database restore started. Waiting for the backend to restart…");
          const recovered = await waitForBackendRecovery(token);
          if (recovered) {
            onUpdated("Database restored successfully.");
            window.location.reload();
            return;
          }
          onUpdated(
            "Restore was requested, but the backend has not come back yet. Refresh the page in a moment.",
            true
          );
        } catch (err) {
          onUpdated(err instanceof Error ? err.message : "Failed to restore backup.", true);
        } finally {
          setBusyFile(null);
        }
      },
    });
  }

  function requestDelete(filename: string) {
    setPasswordPrompt({
      title: "Delete backup file?",
      confirmLabel: "Delete",
      message: `Delete "${filename}"?\n\nThis cannot be undone.`,
      onConfirm: async (password) => {
        setBusyFile(filename);
        try {
          await api(
            `/backups/${encodeURIComponent(filename)}`,
            {
              method: "DELETE",
              body: JSON.stringify({ password }),
            },
            token
          );
          onUpdated(`Deleted backup ${filename}.`);
          await loadStatus();
        } catch (err) {
          onUpdated(err instanceof Error ? err.message : "Failed to delete backup.", true);
        } finally {
          setBusyFile(null);
        }
      },
    });
  }

  return (
    <section className="card backup-restore-panel">
      <div className="backup-restore-panel-top">
      <div className="saved-panel-header">
        <div>
          <h2>Backup / Restore</h2>
          <p className="muted section-desc">
            Create snapshots of the SQLite database and uploaded question images. Restore requires
            your password and restarts the backend.
          </p>
        </div>
        <div className="saved-panel-header-end">
          <button
            type="button"
            className="btn"
            onClick={() => createBackup().catch(() => {})}
            disabled={creating || loading}
          >
            {creating ? "Creating backup…" : "Create backup now"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading backup status…</p>
      ) : status ? (
          <div className="backup-restore-summary">
            <article className="backup-restore-card">
              <h3>Current database</h3>
              <dl>
                <div>
                  <dt>Last modified</dt>
                  <dd>{formatWhen(status.database.modifiedAt)}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{formatBytes(status.database.sizeBytes)}</dd>
                </div>
                <div>
                  <dt>Users</dt>
                  <dd>{status.database.counts.users}</dd>
                </div>
                <div>
                  <dt>Questions</dt>
                  <dd>{status.database.counts.questions}</dd>
                </div>
                <div>
                  <dt>Exam attempts</dt>
                  <dd>{status.database.counts.examAttempts}</dd>
                </div>
              </dl>
            </article>

            <article className="backup-restore-card">
              <h3>Last backup</h3>
              {status.lastBackup ? (
                <dl>
                  <div>
                    <dt>File</dt>
                    <dd>{status.lastBackup.filename}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatWhen(status.lastBackup.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{formatBytes(status.lastBackup.sizeBytes)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="muted">No backups yet.</p>
              )}
            </article>
          </div>
      ) : null}
      </div>

      {!loading && status ? (
          <ListPanel
            className="backup-restore-list-panel"
            footer={
              <ModalPagination
                page={page}
                totalPages={totalPages}
                pageStart={pageStart}
                pageEnd={pageEnd}
                totalItems={totalItems}
                onPageChange={setPage}
                itemNoun="backup"
              />
            }
          >
            <div className="modal-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Backup file</th>
                    <th>Created</th>
                    <th>Size</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No backup files found in the backup folder.
                      </td>
                    </tr>
                  ) : (
                    paginatedBackups.map((backup) => (
                      <tr key={backup.filename}>
                        <td>{backup.filename}</td>
                        <td>{formatWhen(backup.createdAt)}</td>
                        <td>{formatBytes(backup.sizeBytes)}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              type="button"
                              className="btn secondary btn-sm"
                              disabled={busyFile === backup.filename}
                              onClick={() => requestRestore(backup.filename)}
                            >
                              {busyFile === backup.filename ? "Working…" : "Restore"}
                            </button>
                            <button
                              type="button"
                              className="btn danger btn-sm"
                              disabled={busyFile === backup.filename}
                              onClick={() => requestDelete(backup.filename)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ListPanel>
      ) : null}

      {passwordPrompt ? (
        <PasswordConfirmDialog
          title={passwordPrompt.title}
          message={passwordPrompt.message}
          confirmLabel={passwordPrompt.confirmLabel}
          onComplete={(password) => {
            const prompt = passwordPrompt;
            setPasswordPrompt(null);
            if (password) {
              prompt.onConfirm(password).catch(() => {});
            }
          }}
        />
      ) : null}
    </section>
  );
}
