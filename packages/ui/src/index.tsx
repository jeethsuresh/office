import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  FileText,
  Menu,
  MoreHorizontal,
  PanelLeft,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { DocumentSession, type User } from "@office/collaboration";
import {
  WorkspaceAPI,
  relativeTime,
  type Workspace,
  type DocumentMeta,
} from "./shared/api";
import { useMedia, useSession } from "./shared/hooks";
import { Modal } from "./shared/Modal";
import { Sidebar } from "./shell/Sidebar";
import { DocumentView } from "./shell/DocumentView";
import { WorkspaceDialog, type WorkspaceAction } from "./shell/WorkspaceDialog";
import { WorkspaceBrowser } from "./shell/WorkspaceBrowser";
import { Presence } from "./shell/Presence";
import { OfficeDataProvider } from "./shared/OfficeData";
const empty: Workspace = { id: "", folders: [], documents: [] };
type Route =
  { view: "workspace"; folder: string } | { view: "document"; id: string };
function readRoute(): Route {
  const params = new URLSearchParams(location.hash.slice(1));
  return params.get("view") === "workspace"
    ? { view: "workspace", folder: params.get("folder") ?? "" }
    : { view: "document", id: params.get("document") ?? "" };
}
function currentUser(): User {
  try {
    const stored = JSON.parse(localStorage.getItem("office:user") ?? "null");
    if (stored?.name && stored?.color) return stored;
  } catch {}
  const color = ["#4f83cf", "#cf6658", "#6d947d", "#9a78b1", "#a08027"][
    Math.floor(Math.random() * 5)
  ];
  const user = {
    name: `Guest ${Math.floor(Math.random() * 900) + 100}`,
    color,
  };
  localStorage.setItem("office:user", JSON.stringify(user));
  return user;
}
function SessionHeader({
  session,
  onShare,
}: {
  session: DocumentSession;
  onShare: () => void;
}) {
  const { status } = useSession(session);
  return (
    <>
      <span
        className={`sync-state ${status}`}
        title={session.error || "Content syncs automatically"}
      >
        <i />
        {status === "synced"
          ? "All changes saved"
          : status === "saving"
            ? "Saving…"
            : status === "connecting"
              ? "Connecting…"
              : status === "offline"
                ? "Saved on this device"
                : "Sync needs attention"}
      </span>
      <Presence session={session} />
      <button className="share-button" onClick={onShare}>
        <Users size={15} />
        <span>Share</span>
        <ArrowUpRight size={14} />
      </button>
    </>
  );
}
function ConnectedDocument({
  id,
  workspaceID,
  api,
  user,
  onSession,
  documents,
}: {
  id: string;
  workspaceID: string;
  api: WorkspaceAPI;
  user: User;
  onSession: (session: DocumentSession | null) => void;
  documents: DocumentMeta[];
}) {
  const [session] = useState(
    () =>
      new DocumentSession(id, api.baseURL, user, workspaceID || api.baseURL),
  );
  useEffect(() => {
    onSession(session);
    return () => {
      onSession(null);
      session.destroy();
    };
  }, [session]);
  useEffect(() => session.setUser(user), [user, session]);
  return (
    <OfficeDataProvider
      session={session}
      documents={documents}
      api={api}
      user={user}
      namespace={workspaceID || api.baseURL}
    >
      <DocumentView session={session} />
    </OfficeDataProvider>
  );
}
export function App() {
  const api = useMemo(() => new WorkspaceAPI(), []);
  const mobile = useMedia("(max-width: 760px)");
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    try {
      return (
        JSON.parse(
          localStorage.getItem(`office:workspace:${api.baseURL}`) ?? "null",
        ) ?? empty
      );
    } catch {
      return empty;
    }
  });
  const [route, setRoute] = useState(readRoute);
  const selected = route.view === "document" ? route.id : "";
  const [sidebar, setSidebar] = useState(true);
  const showSidebar = route.view === "document" && sidebar;
  const [action, setAction] = useState<WorkspaceAction | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(currentUser);
  const [share, setShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [session, setSession] = useState<DocumentSession | null>(null);
  const refresh = useCallback(async () => {
    try {
      const data = await api.list();
      setWorkspace(data);
      localStorage.setItem(
        `office:workspace:${api.baseURL}`,
        JSON.stringify(data),
      );
      setError("");
      setLoaded(true);
      const requested = readRoute();
      if (
        requested.view === "document" &&
        requested.id &&
        !data.documents.some((d) => d.id === requested.id)
      ) {
        const next = data.documents[0]?.id ?? "";
        setRoute({ view: "document", id: next });
        history.replaceState(
          null,
          "",
          next ? `#document=${next}` : location.pathname,
        );
      }
      return data;
    } catch (e) {
      setError((e as Error).message);
      setLoaded(true);
      return null;
    }
  }, [api]);
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => clearInterval(interval);
  }, [refresh]);
  useEffect(() => {
    if (!loaded || route.view !== "document") return;
    if (!selected && workspace.documents.length) {
      const next = workspace.documents[0].id;
      setRoute({ view: "document", id: next });
      history.replaceState(null, "", `#document=${next}`);
    } else if (!workspace.documents.length && selected)
      setRoute({ view: "document", id: "" });
  }, [workspace.documents, loaded, selected, route.view]);
  useEffect(() => {
    if (
      loaded &&
      route.view === "workspace" &&
      route.folder &&
      !workspace.folders.some((folder) => folder.id === route.folder)
    ) {
      setRoute({ view: "workspace", folder: "" });
      history.replaceState(null, "", "#view=workspace");
    }
  }, [route, loaded, workspace.folders]);
  useEffect(() => {
    const hash = () => {
      setRoute(readRoute());
      void refresh();
    };
    window.addEventListener("hashchange", hash);
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const browserSearch =
          globalThis.document.querySelector<HTMLInputElement>(
            '[aria-label="Search this folder"]',
          );
        if (browserSearch) {
          browserSearch.focus();
          return;
        }
        setSidebar(true);
        setTimeout(
          () =>
            globalThis.document
              .querySelector<HTMLInputElement>(
                '[aria-label="Search documents"]',
              )
              ?.focus(),
          50,
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("keydown", key);
    };
  }, []);
  useEffect(() => {
    if (mobile) setSidebar(false);
  }, [mobile]);
  function select(id: string) {
    setRoute({ view: "document", id });
    location.hash = `document=${id}`;
    if (mobile) setSidebar(false);
  }
  function browse(folder = "") {
    setRoute({ view: "workspace", folder });
    location.hash = `view=workspace${folder ? `&folder=${encodeURIComponent(folder)}` : ""}`;
    if (mobile) setSidebar(false);
  }
  const document = workspace.documents.find((d) => d.id === selected);
  const folder = document
    ? workspace.folders.find((f) => f.id === document.folderId)
    : null;
  function saveUser(name: string) {
    const next = { ...user, name };
    setUser(next);
    localStorage.setItem("office:user", JSON.stringify(next));
  }
  return (
    <div
      className={`office-app ${showSidebar ? "sidebar-open" : "sidebar-closed"} ${mobile ? "mobile-profile" : "desktop-profile"}`}
    >
      {showSidebar && (
        <>
          {mobile && (
            <button
              className="sidebar-scrim"
              aria-label="Close document menu"
              onClick={() => setSidebar(false)}
            />
          )}
          <Sidebar
            workspace={workspace}
            selected={selected}
            onSelect={select}
            onCreateDocument={(parent) =>
              setAction({ kind: "new-document", parent })
            }
            onCreateFolder={(parent) =>
              setAction({ kind: "new-folder", parent })
            }
            onManage={setAction}
            onWorkspace={() => browse()}
            onClose={() => setSidebar(false)}
          />
        </>
      )}
      <main className="main-area">
        <header className="topbar">
          {route.view === "document" && (
            <button
              className="icon-button"
              aria-label="Toggle sidebar"
              onClick={() => setSidebar(!sidebar)}
            >
              {mobile ? <Menu size={19} /> : <PanelLeft size={18} />}
            </button>
          )}
          <div className="breadcrumb">
            <button
              className="workspace-home-link"
              onClick={() => browse(folder?.id ?? "")}
            >
              {folder?.name ?? "Workspace"}
            </button>
            {route.view === "document" && (
              <>
                <ChevronRight size={13} />
                <button
                  className="document-name"
                  onClick={() =>
                    document && setAction({ kind: "document", item: document })
                  }
                >
                  {document?.name ?? "Document"}
                </button>
              </>
            )}
          </div>
          <div className="topbar-right">
            {document && session && (
              <SessionHeader session={session} onShare={() => setShare(true)} />
            )}
            {route.view === "document" && (
              <button
                className="icon-button"
                aria-label="Document options"
                disabled={!document}
                onClick={() =>
                  document && setAction({ kind: "document", item: document })
                }
              >
                <MoreHorizontal size={20} />
              </button>
            )}
          </div>
        </header>
        {error && (
          <div className="connection-banner" role="status">
            <WifiOff size={15} />
            {workspace.documents.length
              ? "Server unavailable. Existing content remains editable on this device."
              : error}
            <button onClick={() => void refresh()}>Retry</button>
          </div>
        )}
        {route.view === "document" && (
          <div className="document-caption">
            <span>
              <FileText size={13} /> Document
            </span>
            <span>
              {document ? `Updated ${relativeTime(document.updatedAt)}` : ""}
            </span>
          </div>
        )}
        {route.view === "workspace" ? (
          <WorkspaceBrowser
            workspace={workspace}
            folderID={route.folder}
            onFolder={browse}
            onDocument={select}
            onAction={setAction}
          />
        ) : document ? (
          <ConnectedDocument
            key={`${api.baseURL}:${document.id}`}
            id={document.id}
            workspaceID={workspace.id}
            api={api}
            user={user}
            onSession={setSession}
            documents={workspace.documents}
          />
        ) : (
          <div className="workspace-empty">
            <h1>{loaded ? "Document not found" : "Loading workspace…"}</h1>
            {loaded && (
              <button
                className="primary-button"
                onClick={() => setAction({ kind: "new-document", parent: "" })}
              >
                Create a document
              </button>
            )}
          </div>
        )}
      </main>
      {action && (
        <WorkspaceDialog
          action={action}
          workspace={workspace}
          api={api}
          onClose={() => setAction(null)}
          onDone={(id) => {
            setAction(null);
            void refresh().then(() => {
              if (id) select(id);
            });
          }}
        />
      )}
      {share && (
        <Modal title="Share document" onClose={() => setShare(false)}>
          <p className="muted">
            Open this document in another browser on this server to edit
            together.
          </p>
          <label className="field-label">
            Your name
            <input
              className="field"
              value={user.name}
              maxLength={40}
              onChange={(e) => saveUser(e.target.value)}
            />
          </label>
          <div className="share-link">
            <code>{`${location.origin}/#document=${selected}`}</code>
            <button
              className="icon-button"
              aria-label="Copy document link"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `${location.origin}/#document=${selected}`,
                  );
                  setCopied(true);
                } catch {
                  setError(
                    "Copy is unavailable. Select the link and copy it manually.",
                  );
                }
              }}
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}
            </button>
          </div>
          <p className="modal-footnote">
            For another device, run Office’s web server on your network and open
            its address on both devices.
          </p>
          <div className="modal-actions">
            <button className="primary-button" onClick={() => setShare(false)}>
              Keep creating
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
