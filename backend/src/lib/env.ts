export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Set it in backend/.env or your deployment environment.`);
  }
  return value;
}
