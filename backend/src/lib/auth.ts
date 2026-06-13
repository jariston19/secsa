import type { FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";

export interface JwtUser {
  id: string;
  email: string;
  role: Role;
  yearLevel?: number | null;
}

export function getUser(request: FastifyRequest): JwtUser {
  return request.user as JwtUser;
}

export function requireRoles(user: JwtUser, roles: Role[]) {
  if (!roles.includes(user.role)) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
}
