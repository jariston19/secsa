import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser } from "../lib/auth.js";
import { normalizeUserEmail } from "../services/userDuplicates.js";

const loginSchema = z.object({
  email: z.string().trim().email().transform(normalizeUserEmail),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    if (!user || !user.isActive) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      yearLevel: user.yearLevel,
      programCourse: user.programCourse,
      qaUnlimited: user.qaUnlimited,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        yearLevel: user.yearLevel,
        programCourse: user.programCourse,
        qaUnlimited: user.qaUnlimited,
      },
    };
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request) => {
    const jwtUser = getUser(request);
    const user = await prisma.user.findUnique({
      where: { id: jwtUser.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        yearLevel: true,
        programCourse: true,
        qaUnlimited: true,
      },
    });
    return { user };
  });
}
