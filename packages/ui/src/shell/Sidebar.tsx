import { useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Search,
  PanelLeftClose,
} from "lucide-react";
import {
  relativeTime,
  type Folder as FolderMeta,
  type Workspace,
  type DocumentMeta,
} from "../shared/api";
export type ItemAction =
  | { kind: "document"; item: DocumentMeta }
  | { kind: "folder"; item: FolderMeta };
export function Sidebar({
  workspace,
  selected,
  onSelect,
  onCreateDocument,
  onCreateFolder,
  onManage,
  onClose,
  onWorkspace,
}: {
  workspace: Workspace;
  selected: string;
  onSelect: (id: string) => void;
  onCreateDocument: (folder: string) => void;
  onCreateFolder: (parent: string) => void;
  onManage: (item: ItemAction) => void;
  onClose: () => void;
  onWorkspace: () => void;
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      return new Set(
        JSON.parse(localStorage.getItem("office:expanded") ?? '["studio"]'),
      );
    } catch {
      return new Set(["studio"]);
    }
  });
  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("office:expanded", JSON.stringify([...next]));
      return next;
    });
  }
  function docs(folder: string, depth: number) {
    return workspace.documents
      .filter((d) => d.folderId === folder)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => (
        <div
          key={d.id}
          className={`tree-document ${d.id === selected ? "selected" : ""}`}
          style={{ paddingLeft: 16 + depth * 14 }}
        >
          <button
            className="document-link"
            onClick={() => onSelect(d.id)}
            title={d.name}
          >
            <FileText size={16} />
            <span>{d.name}</span>
          </button>
          <button
            className="row-action"
            aria-label={`Manage ${d.name}`}
            onClick={() => onManage({ kind: "document", item: d })}
          >
            <MoreHorizontal size={16} />
          </button>
          <span className="document-time">{relativeTime(d.updatedAt)}</span>
        </div>
      ));
  }
  function folders(parent: string, depth: number): React.ReactNode {
    return workspace.folders
      .filter((f) => f.parentId === parent)
      .map((f) => (
        <div key={f.id}>
          <div className="tree-folder" style={{ paddingLeft: 12 + depth * 14 }}>
            <button
              className="folder-link"
              onClick={() => toggle(f.id)}
              aria-expanded={expanded.has(f.id)}
            >
              <ChevronRight
                size={13}
                className={expanded.has(f.id) ? "expanded" : ""}
              />
              {expanded.has(f.id) ? (
                <FolderOpen size={16} />
              ) : (
                <Folder size={16} />
              )}
              <span>{f.name}</span>
            </button>
            <button
              className="row-action"
              aria-label={`Add document to ${f.name}`}
              onClick={() => onCreateDocument(f.id)}
            >
              <Plus size={15} />
            </button>
            <button
              className="row-action"
              aria-label={`Manage folder ${f.name}`}
              onClick={() => onManage({ kind: "folder", item: f })}
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
          {expanded.has(f.id) && (
            <>
              {docs(f.id, depth + 1)}
              {folders(f.id, depth + 1)}
            </>
          )}
        </div>
      ));
  }
  const results = workspace.documents.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <button
          className="brand-home"
          aria-label="Open workspace"
          onClick={onWorkspace}
        >
          <div className="brand-mark">
            <i />
            <i />
            <i />
          </div>
          <span>
            office<span className="brand-dot">.</span>
          </span>
        </button>
        <button
          className="icon-button close-sidebar"
          aria-label="Close sidebar"
          onClick={onClose}
        >
          <PanelLeftClose size={17} />
        </button>
      </div>
      <div className="workspace-label">
        <span className="workspace-avatar">J</span>
        <div>Your workspace</div>
        <span className="local-pill">LOCAL</span>
      </div>
      <label className="search-box">
        <Search size={16} />
        <input
          aria-label="Search documents"
          placeholder="Find a document…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <kbd>⌘ K</kbd>
      </label>
      <button
        className="new-document-button"
        onClick={() => onCreateDocument("")}
      >
        <Plus size={17} />
        New document
        <ArrowUpRight size={15} />
      </button>
      <div className="sidebar-section-title">
        <span>YOUR DOCUMENTS</span>
        <button
          className="icon-button"
          aria-label="New folder"
          title="New folder"
          onClick={() => onCreateFolder("")}
        >
          <FolderPlus size={16} />
        </button>
      </div>
      <nav className="document-tree" aria-label="Documents">
        {search ? (
          <>
            {results.map((d) => (
              <button
                className={`search-result ${d.id === selected ? "selected" : ""}`}
                key={d.id}
                onClick={() => onSelect(d.id)}
              >
                <FileText size={16} />
                {d.name}
              </button>
            ))}
            {!results.length && (
              <p className="tree-empty">No documents match.</p>
            )}
          </>
        ) : (
          <>
            {folders("", 0)}
            {docs("", 0)}
            {!workspace.documents.length && (
              <p className="tree-empty">No documents</p>
            )}
          </>
        )}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-footer">
          <span>OFFICE / 0.1</span>
        </div>
      </div>
    </aside>
  );
}
