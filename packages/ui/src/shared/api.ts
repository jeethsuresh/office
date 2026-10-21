export type Folder = { id: string; name: string; parentId: string };
export type DocumentMeta = {
  id: string;
  name: string;
  folderId: string;
  createdAt: string;
  updatedAt: string;
};
export type Workspace = {
  id: string;
  folders: Folder[];
  documents: DocumentMeta[];
};
export class WorkspaceAPI {
  constructor(readonly baseURL = location.origin) {}
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const res = await fetch(new URL("/api" + path, this.baseURL), {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" ? { "X-Gravitas-CSRF": "1" } : {}) },
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
    });
    const value = await res.json();
    if (!res.ok) {
      if (res.status === 401) window.dispatchEvent(new Event("office:unauthorized"));
      throw new Error(value.error ?? "The workspace could not be reached");
    }
    return value;
  }
  list() {
    return this.request<Workspace>("/workspace");
  }
  createDocument(name: string, folderId: string) {
    return this.request<DocumentMeta>("/documents", "POST", { name, folderId });
  }
  createFolder(name: string, parentId: string) {
    return this.request<Folder>("/folders", "POST", { name, parentId });
  }
  updateDocument(
    id: string,
    values: Partial<Pick<DocumentMeta, "name" | "folderId">>,
  ) {
    return this.request<DocumentMeta>(`/documents/${id}`, "PATCH", values);
  }
  updateFolder(id: string, values: Partial<Pick<Folder, "name" | "parentId">>) {
    return this.request<Folder>(`/folders/${id}`, "PATCH", values);
  }
  deleteDocument(id: string) {
    return this.request(`/documents/${id}`, "DELETE");
  }
  deleteFolder(id: string) {
    return this.request(`/folders/${id}`, "DELETE");
  }
}
export function relativeTime(value: string) {
  const n = Math.max(0, Date.now() - Date.parse(value));
  if (n < 60000) return "just now";
  if (n < 3600000) return `${Math.floor(n / 60000)}m ago`;
  if (n < 86400000) return `${Math.floor(n / 3600000)}h ago`;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
