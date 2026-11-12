import { API_URL, ApiError } from "./apiClient";
import { getToken } from "./auth";

// Sends a form that contains a file. The browser sets the multipart header itself, so none is added here.
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    body: form,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") message = data.detail;
      else if (Array.isArray(data.detail)) message = data.detail.map((d: { msg: string }) => d.msg).join("; ");
    } catch {
      // the answer had no JSON body; keep the general message
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}