import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  Grid2X2,
  List,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { relativeTime, type Workspace } from "../shared/api";
import type { WorkspaceAction } from "./WorkspaceDialog";
import type { ItemAction } from "./Sidebar";

type Sort = "name" | "type" | "updated";
export function WorkspaceBrowser({
  workspace,
  folderID,
  onFolder,
  onDocument,
  onAction,
}: {
  workspace: Workspace;
  folderID: string;
  onFolder: (id: string) => void;
  onDocument: (id: string) => void;
  onAction: (action: WorkspaceAction) => void;
}) {
  const [mode, setMode] = useState(() =>
    localStorage.getItem("office:browser-mode") === "icons" ? "icons" : "list",
  );
  const [sort, setSort] = useState<Sort>(() => {
    const value = localStorage.getItem("office:browser-sort");
    return value === "type" || value === "updated" ? value : "name";
  });
  const [descending, setDescending] = useState(
    () => localStorage.getItem("office:browser-descending") === "true",
  );
  const [search, setSearch] = useState("");
  useEffect(() => setSearch(""), [folderID]);
  const current = workspace.folders.find((folder) => folder.id === folderID);
  const ancestors = [];
  const seen = new Set<string>();
  for (
    let folder = current;
    folder && !seen.has(folder.id);
    folder = workspace.folders.find((item) => item.id === folder!.parentId)
  ) {
    seen.add(folder.id);
    ancestors.unshift(folder);
  }
  const items: ItemAction[] = [
    ...workspace.folders
      .filter((folder) => folder.parentId === folderID)
      .map((item) => ({ kind: "folder" as const, item })),
    ...workspace.documents
      .filter((doc) => doc.folderId === folderID)
      .map((item) => ({ kind: "document" as const, item })),
  ];
  const visible = items
    .filter(({ item }) =>
      item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
    )
    .sort((a, b) => {
      const name = a.item.name.localeCompare(b.item.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      const result =
        sort === "type"
          ? a.kind.localeCompare(b.kind) || name
          : sort === "updated"
            ? (a.kind === "document" ? Date.parse(a.item.updatedAt) : 0) -
                (b.kind === "document" ? Date.parse(b.item.updatedAt) : 0) ||
              name
            : name;
      return (
        (descending ? -1 : 1) * result || a.item.id.localeCompare(b.item.id)
      );
    });
  function chooseSort(value: Sort) {
    setSort(value);
    localStorage.setItem("office:browser-sort", value);
  }
  function toggleDirection() {
    setDescending(!descending);
    localStorage.setItem("office:browser-descending", String(!descending));
  }
  function chooseMode(value: string) {
    setMode(value);
    localStorage.setItem("office:browser-mode", value);
  }
  function column(value: Sort, label: string) {
    return (
      <th
        scope="col"
        aria-sort={
          sort === value ? (descending ? "descending" : "ascending") : "none"
        }
      >
        <button
          onClick={() =>
            sort === value ? toggleDirection() : chooseSort(value)
          }
        >
          {label}
          {sort === value &&
            (descending ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
        </button>
      </th>
    );
  }
  function open(action: ItemAction) {
    setSearch("");
    action.kind === "folder"
      ? onFolder(action.item.id)
      : onDocument(action.item.id);
  }
  function itemButton(action: ItemAction) {
    const Icon = action.kind === "folder" ? Folder : FileText;
    return (
      <button
        className="browser-item-link"
        aria-label={`Open ${action.kind}: ${action.item.name}`}
        onClick={() => open(action)}
      >
        <Icon
          size={mode === "icons" ? 40 : 19}
          className={`browser-item-icon ${action.kind}`}
        />
        <span title={action.item.name}>{action.item.name}</span>
      </button>
    );
  }
  function manage(action: ItemAction) {
    return (
      <button
        className="icon-button browser-item-manage"
        aria-label={`Manage ${action.kind}: ${action.item.name}`}
        onClick={() => onAction(action)}
        title="Rename, move, or delete"
      >
        <MoreHorizontal size={18} />
      </button>
    );
  }
  return (
    <section className="workspace-browser" aria-label="Workspace browser">
      <div className="browser-heading">
        <div>
          <span className="eyebrow">A HOME FOR YOUR IDEAS</span>
          <h1>{current?.name ?? "Your workspace"}</h1>
          <p>
            {items.length} {items.length === 1 ? "item" : "items"}
            {current ? " in this folder" : " at the root"}
          </p>
        </div>
        <div className="browser-create">
          <button
            className="secondary-button"
            onClick={() => onAction({ kind: "new-folder", parent: folderID })}
          >
            <FolderPlus size={16} />
            New folder
          </button>
          <button
            className="primary-button"
            onClick={() => onAction({ kind: "new-document", parent: folderID })}
          >
            <Plus size={17} />
            New document
          </button>
        </div>
      </div>
      <nav className="browser-path" aria-label="Folder path">
        <button
          aria-current={!folderID ? "page" : undefined}
          onClick={() => {
            setSearch("");
            onFolder("");
          }}
        >
          Workspace
        </button>
        {ancestors.map((folder) => (
          <div key={folder.id}>
            <ChevronRight size={13} />
            <button
              aria-current={folder.id === folderID ? "page" : undefined}
              title={folder.name}
              onClick={() => {
                setSearch("");
                onFolder(folder.id);
              }}
            >
              {folder.name}
            </button>
          </div>
        ))}
        {current && (
          <button
            className="browser-up"
            aria-label="Up one folder"
            onClick={() => {
              setSearch("");
              onFolder(current.parentId);
            }}
          >
            Up one folder
          </button>
        )}
      </nav>
      <div className="browser-toolbar">
        <label className="browser-search">
          <Search size={16} />
          <input
            aria-label="Search this folder"
            placeholder="Search this folder…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="browser-sort">
          Sort by
          <select
            aria-label="Sort items by"
            value={sort}
            onChange={(event) => chooseSort(event.target.value as Sort)}
          >
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="updated">Updated</option>
          </select>
        </label>
        <button
          className="icon-button"
          aria-label={descending ? "Sort ascending" : "Sort descending"}
          onClick={toggleDirection}
        >
          {descending ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
        </button>
        <div className="browser-modes" aria-label="View mode">
          <button
            aria-label="List view"
            aria-pressed={mode === "list"}
            onClick={() => chooseMode("list")}
          >
            <List size={18} />
          </button>
          <button
            aria-label="Icon view"
            aria-pressed={mode === "icons"}
            onClick={() => chooseMode("icons")}
          >
            <Grid2X2 size={18} />
          </button>
        </div>
      </div>
      <div className="browser-items" data-view={mode}>
        {!visible.length ? (
          <div className="browser-empty">
            <Folder size={38} />
            <h2>
              {search ? "Nothing matches yet." : "Room for something new."}
            </h2>
            <p>
              {search
                ? "Try another name in this folder."
                : "Create a folder or document to get started."}
            </p>
          </div>
        ) : mode === "list" ? (
          <table className="browser-table">
            <thead>
              <tr>
                {column("name", "Name")}
                {column("type", "Type")}
                {column("updated", "Updated")}
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((action) => (
                <tr key={action.item.id} data-item-id={action.item.id}>
                  <td>{itemButton(action)}</td>
                  <td>{action.kind === "folder" ? "Folder" : "Document"}</td>
                  <td>
                    {action.kind === "document" ? (
                      <time
                        dateTime={action.item.updatedAt}
                        title={new Date(action.item.updatedAt).toLocaleString()}
                      >
                        {relativeTime(action.item.updatedAt)}
                      </time>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{manage(action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="browser-grid">
            {visible.map((action) => (
              <article
                className="browser-card"
                key={action.item.id}
                data-item-id={action.item.id}
              >
                {itemButton(action)}
                <div>
                  <small>
                    {action.kind === "folder"
                      ? "Folder"
                      : `Updated ${relativeTime(action.item.updatedAt)}`}
                  </small>
                  {manage(action)}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
