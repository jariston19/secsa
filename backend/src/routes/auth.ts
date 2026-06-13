import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getUser } from "../lib/auth.js";

const loginSchema = z.object({
  email: z.string().email(),
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
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        yearLevel: user.yearLevel,
      },
    };
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request) => {
    const jwtUser = getUser(request);
    const user = await prisma.user.findUnique({
      where: { id: jwtUser.id },
      select: { id: true, email: true, name: true, role: true, yearLevel: true },
    });
    return { user };
  });
}
