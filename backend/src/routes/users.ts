import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { yearLevelSchema } from "../lib/yearLevel.js";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.nativeEnum(Role),
  yearLevel: yearLevelSchema.optional(),
});

export async function userRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN, Role.TEACHER]);

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        yearLevel: true,
        isActive: true,
        createdAt: true,
      },
    });

    return { users };
  });

  app.post("/", async (request, reply) => {
    const user = getUser(request);
    requireRoles(user, [Role.SUPERADMIN]);

    const body = createUserSchema.parse(request.body);
    if (body.role === Role.STUDENT && !body.yearLevel) {
      return reply.code(400).send({ error: "Students require a year level." });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const created = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name,
        role: body.role,
        yearLevel: body.role === Role.STUDENT ? body.yearLevel : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        yearLevel: true,
        isActive: true,
      },
    });

    return reply.code(201).send({ user: created });
  });
}
