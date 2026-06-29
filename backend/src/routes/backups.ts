import type { FastifyInstance } from "fastify";
import { Role } from "@prisma/client";
import { z } from "zod";
import { getUser, requireRoles } from "../lib/auth.js";
import {
  createDatabaseBackup,
  deleteBackupFile,
  getDatabaseSnapshot,
  listBackupFiles,
  restoreDatabaseBackup,
} from "../services/databaseBackup.js";
import { verifyUserPassword } from "../services/subjectTopicDelete.js";

const restoreBackupSchema = z.object({
  password: z.string().min(1),
});

export async function backupRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const [database, backups] = await Promise.all([getDatabaseSnapshot(), listBackupFiles()]);

    return {
      database,
      backups,
      lastBackup: backups[0] ?? null,
      backupDirConfigured: true,
    };
  });

  app.post("/", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const backup = await createDatabaseBackup();
    return reply.code(201).send({ backup });
  });

  app.post("/:filename/restore", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const { filename } = request.params as { filename: string };
    const body = restoreBackupSchema.parse(request.body);

    const validPassword = await verifyUserPassword(user.id, body.password);
    if (!validPassword) {
      return reply.code(403).send({ error: "Incorrect password." });
    }

    const result = await restoreDatabaseBackup(filename);

    reply.send({
      ...result,
      message:
        "Database restored. The backend will restart momentarily to reload the restored data.",
    });

    setTimeout(() => {
      process.exit(0);
    }, 750);
  });

  app.delete("/:filename", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const { filename } = request.params as { filename: string };
    const body = restoreBackupSchema.parse(request.body);

    const validPassword = await verifyUserPassword(user.id, body.password);
    if (!validPassword) {
      return reply.code(403).send({ error: "Incorrect password." });
    }

    const result = await deleteBackupFile(filename);
    return reply.send(result);
  });
}
