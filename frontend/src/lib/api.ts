const API_BASE = "/api";

export async function api<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Network error — check your connection to the server.");
  }

  let data: { error?: string; details?: string[] };
  try {
    data = await response.json();
  } catch {
    throw new Error(response.ok ? "Invalid server response" : "Request failed");
  }

  if (!response.ok) {
    const detailText =
      Array.isArray(data.details) && data.details.length > 0
        ? `\n${data.details.join("\n")}`
        : "";
    throw new Error(`${data.error || "Request failed"}${detailText}`);
  }

  return data as T;
}
