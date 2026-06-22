import { mkdir } from "fs/promises";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { requireEnv } from "./lib/env.js";
import { uploadDir } from "./lib/paths.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { subjectRoutes } from "./routes/subjects.js";
import { topicRoutes } from "./routes/topics.js";
import { questionRoutes } from "./routes/questions.js";
import { questionSetRoutes } from "./routes/questionSets.js";
import { examRoutes } from "./routes/exams.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { programRoutes } from "./routes/programs.js";

const app = Fastify({ logger: true });

await mkdir(uploadDir, { recursive: true });

await app.register(cors, { origin: true });
await app.register(jwt, { secret: requireEnv("JWT_SECRET") });
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
await app.register(fastifyStatic, {
  root: uploadDir,
  prefix: "/uploads/",
});

app.decorate("authenticate", async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: "Unauthorized" });
  }
});

app.setErrorHandler((error, _request, reply) => {
  const err = error as { statusCode?: number; message?: string };
  const statusCode = err.statusCode ?? 500;
  reply.code(statusCode).send({
    error: err.message || "Internal Server Error",
  });
});

app.get("/health", async () => ({ status: "ok" }));

await app.register(authRoutes, { prefix: "/api/auth" });
await app.register(userRoutes, { prefix: "/api/users" });
await app.register(subjectRoutes, { prefix: "/api/subjects" });
await app.register(topicRoutes, { prefix: "/api/topics" });
await app.register(questionRoutes, { prefix: "/api/questions" });
await app.register(questionSetRoutes, { prefix: "/api/question-sets" });
await app.register(examRoutes, { prefix: "/api/exams" });
await app.register(analyticsRoutes, { prefix: "/api/analytics" });
await app.register(programRoutes, { prefix: "/api/programs" });

const port = Number(process.env.PORT || 3001);
await app.listen({ port, host: "0.0.0.0" });
