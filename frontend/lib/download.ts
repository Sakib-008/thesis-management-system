import { API_URL } from "./apiClient";
import { getToken } from "./auth";
// Fetches a file from the API (with the login token) and saves it. A plain link cannot send the token.
export async function downloadFile(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${getToken() ?? ""}` } });
  if (!res.ok) {
    let detail = "The file could not be downloaded";
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      // the answer was not JSON; keep the general message
    }
    throw new Error(detail);
  }
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}