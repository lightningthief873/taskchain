const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";

export async function verifyPrivyToken(accessToken: string): Promise<{ token: string; user: { id: string; walletAddress: string; username: string | null } }> {
  const res = await fetch(`${API_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((err as { error?: string }).error ?? "Auth failed");
  }
  return res.json();
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tc_token");
}

export function setStoredToken(token: string): void {
  localStorage.setItem("tc_token", token);
}

export function clearStoredToken(): void {
  localStorage.removeItem("tc_token");
}

export function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
