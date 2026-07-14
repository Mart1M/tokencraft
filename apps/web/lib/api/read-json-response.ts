export async function readJsonResponse<T>(response: Response) {
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    return { error: "Authentication required. Refresh the page and try again." };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    if (response.redirected) {
      return { error: "Authentication required. Refresh the page and try again." };
    }

    return { error: `Request failed (${response.status}). Please try again.` };
  }

  const payload = (await response.json().catch(() => null)) as ({ error?: string } & T) | null;

  if (!response.ok) {
    return { error: payload?.error ?? `Request failed (${response.status}). Please try again.` };
  }

  if (!payload) {
    return { error: "Request failed. Please try again." };
  }

  return { data: payload as T };
}
