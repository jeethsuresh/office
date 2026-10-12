import { useState } from "react";
import { Modal } from "../shared/Modal";
import { WorkspaceAPI, type Workspace } from "../shared/api";
import type { ItemAction } from "./Sidebar";
export type WorkspaceAction =
  | { kind: "new-document"; parent: string }
  | { kind: "new-folder"; parent: string }
  | ItemAction;
export function WorkspaceDialog({
  action,
  workspace,
  api,
  onClose,
  onDone,
}: {
  action: WorkspaceAction;
  workspace: Workspace;
  api: WorkspaceAPI;
  onClose: () => void;
  onDone: (id?: string) => void;
}) {
  const editing = action.kind === "document" || action.kind === "folder";
  const document = action.kind === "document" || action.kind === "new-document";
  const [name, setName] = useState(editing ? action.item.name : "");
  const [parent, setParent] = useState(
    editing
      ? "folderId" in action.item
        ? action.item.folderId
        : action.item.parentId
      : action.parent,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      let id: string | undefined;
      if (action.kind === "new-document")
        id = (await api.createDocument(name, parent)).id;
      else if (action.kind === "new-folder")
        await api.createFolder(name, parent);
      else if (action.kind === "document")
        await api.updateDocument(action.item.id, { name, folderId: parent });
      else await api.updateFolder(action.item.id, { name, parentId: parent });
      onDone(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!editing) return;
    setBusy(true);
    try {
      document
        ? await api.deleteDocument(action.item.id)
        : await api.deleteFolder(action.item.id);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function path(id: string): string {
    const f = workspace.folders.find((f) => f.id === id);
    return f ? `${f.parentId ? path(f.parentId) + " / " : ""}${f.name}` : "";
  }
  return (
    <Modal
      title={
        editing
          ? `Edit ${document ? "document" : "folder"}`
          : `New ${document ? "document" : "folder"}`
      }
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="field-label">
          Name
          <input
            autoFocus
            className="field"
            placeholder={document ? "Document name" : "Folder name"}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field-label">
          {document ? "In folder" : "Parent folder"}
          <select
            className="field"
            aria-label={document ? "In folder" : "Parent folder"}
            value={parent}
            onChange={(e) => setParent(e.target.value)}
          >
            <option value="">Workspace root</option>
            {workspace.folders
              .filter(
                (f) => action.kind !== "folder" || f.id !== action.item.id,
              )
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {path(f.id)}
                </option>
              ))}
          </select>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {editing && (
            <button
              type="button"
              className="text-button danger"
              onClick={() => setDeleting(true)}
            >
              Delete {document ? "document" : "folder"}
            </button>
          )}
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" disabled={busy || !name.trim()}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create"}
          </button>
        </div>
        {deleting && (
          <div className="delete-confirm">
            <p>
              {document
                ? "Delete this document and all its blocks? This cannot be undone."
                : "Only empty folders can be deleted."}
            </p>
            <button
              type="button"
              className="danger-button"
              disabled={busy}
              onClick={() => void remove()}
            >
              Delete permanently
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setDeleting(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
