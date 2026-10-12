import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DocumentSession, type User } from "@office/collaboration";
import {
  DocumentAPI,
  documentTargets,
  outgoingLinks,
  resolveTarget,
  orderedBlocks,
  parseURN,
  referenceURL,
  sheetAxis,
  type Target,
  type Backlink,
} from "@office/model";
import {
  bindFormula,
  formatFormula,
  formulaReferences,
  type WorkbookSnapshot,
  type SheetSnapshot,
  type Formula,
} from "@office/spreadsheet/formula";
import type { Calculation } from "@office/spreadsheet";
import type { WorkspaceAPI, DocumentMeta } from "./api";
export class OfficeData {
  private sessions = new Map<string, DocumentSession>();
  private APIs = new Map<string, DocumentAPI>();
  private cleanup = new Map<string, () => void>();
  private listeners = new Set<() => void>();
  private worker = new Worker(
    new URL("../../../spreadsheet/src/worker.ts", import.meta.url),
    { type: "module" },
  );
  private serial = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private pending = new Set<() => void>();
  revision = 0;
  calculating = false;
  calculation: Calculation = { values: {}, functions: 0, evaluated: 0 };
  snapshot: WorkbookSnapshot = { sheets: [], targets: {}, epoch: 0 };
  error = "";
  constructor(
    readonly root: DocumentSession,
    private documents: DocumentMeta[],
    private api: WorkspaceAPI,
    private user: User,
    private namespace: string,
  ) {
    this.attach(root);
    this.worker.onmessage = (
      event: MessageEvent<{ id: number; result?: Calculation; error?: string }>,
    ) => {
      if (event.data.id !== this.serial || this.disposed) return;
      if (event.data.result) this.calculation = event.data.result;
      this.error = event.data.error ?? "";
      this.calculating = false;
      this.emit();
    };
    this.worker.onerror = () => {
      this.error = "The calculation worker could not start";
      this.calculating = false;
      this.emit();
    };
    this.recalculate();
  }
  private attach(session: DocumentSession) {
    this.sessions.set(session.id, session);
    const api = new DocumentAPI(session.id, session.doc);
    this.APIs.set(session.id, api);
    const content = api.subscribe(() => {
      this.emit();
      this.schedule();
    });
    const status = session.subscribe(() => {
      this.emit();
      this.schedule();
    });
    this.cleanup.set(session.id, () => {
      content();
      status();
      api.destroy();
    });
  }
  private emit = () => {
    this.revision++;
    this.listeners.forEach((listener) => listener());
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getRevision = () => this.revision;
  setDocuments(documents: DocumentMeta[]) {
    this.documents = documents;
    for (const [id, session] of this.sessions)
      if (
        id !== this.root.id &&
        !documents.some((document) => document.id === id)
      ) {
        this.cleanup.get(id)?.();
        this.cleanup.delete(id);
        this.APIs.delete(id);
        this.sessions.delete(id);
        session.destroy();
      }
    this.emit();
    this.schedule();
  }
  name(id: string) {
    return (
      this.documents.find((document) => document.id === id)?.name ??
      "Untitled document"
    );
  }
  async ensure(id: string): Promise<DocumentSession | null> {
    if (this.disposed || !this.documents.some((document) => document.id === id))
      return null;
    let session = this.sessions.get(id);
    if (!session) {
      session = new DocumentSession(
        id,
        this.api.baseURL,
        this.user,
        this.namespace,
        true,
      );
      this.attach(session);
    }
    if (session.hydrated) return session;
    const loaded = session;
    return new Promise((resolve) => {
      const cancel = () => {
        end();
        this.pending.delete(cancel);
        resolve(null);
      };
      const end = loaded.subscribe(() => {
        if (loaded.hydrated || this.disposed) {
          end();
          this.pending.delete(cancel);
          resolve(this.disposed ? null : loaded);
        }
      });
      this.pending.add(cancel);
    });
  }
  async loadTargets() {
    for (let at = 0; at < this.documents.length; at += 4)
      await Promise.all(
        this.documents
          .slice(at, at + 4)
          .map((document) => this.ensure(document.id)),
      );
    this.recalculate();
    this.emit();
  }
  targets(): Target[] {
    return this.documents.flatMap((document) => {
      const session = this.sessions.get(document.id);
      return session?.hydrated
        ? documentTargets(session.doc, document.id, document.name)
        : [
            {
              document: document.id,
              block: "_",
              identifier: "_",
              urn: `${document.id}:_:_`,
              kind: "document" as const,
              label: document.name,
              detail: "Document",
            },
          ];
    });
  }
  resolve(urn: string): Target | null {
    const ref = parseURN(urn);
    if (!ref) return null;
    const session = this.sessions.get(ref.document);
    if (
      !session?.hydrated ||
      !this.documents.some((document) => document.id === ref.document)
    )
      return null;
    const target = resolveTarget(session.doc, ref, this.name(ref.document));
    if (target?.kind === "cell")
      target.value = String(this.calculation.values[urn]?.value ?? "");
    return target;
  }
  backlinks(urn: string): Backlink[] {
    const ref = parseURN(urn);
    return [...this.sessions.values()]
      .flatMap((session) =>
        outgoingLinks(session.doc, session.id, this.name(session.id)),
      )
      .filter(
        (link) =>
          link.target === urn ||
          (ref?.identifier === "_" &&
            parseURN(link.target)?.document === ref.document &&
            (ref.block === "_" || parseURN(link.target)?.block === ref.block)),
      );
  }
  documentAPI(id: string) {
    return this.APIs.get(id);
  }
  async open(urn: string) {
    const ref = parseURN(urn);
    if (!ref) return;
    location.hash = referenceURL(urn).slice(1);
  }
  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.recalculate(), 16);
  }
  private recalculate() {
    if (this.disposed) return;
    const sheets: SheetSnapshot[] = [],
      targets: Record<string, string> = {};
    for (const session of this.sessions.values()) {
      for (const target of documentTargets(
        session.doc,
        session.id,
        this.name(session.id),
      ))
        if (target.kind !== "cell") targets[target.urn] = target.label;
      for (const block of orderedBlocks(session.doc))
        if (block.get("kind") === "sheet")
          sheets.push({
            document: session.id,
            block: block.get("id"),
            name: block.get("title"),
            rows: sheetAxis(block, "rows"),
            columns: sheetAxis(block, "columns"),
            cells: block.get("cells").toJSON(),
          });
    }
    this.snapshot = {
      sheets,
      targets,
      epoch: Math.floor(Date.now() / 60000) * 60000,
    };
    for (const sheet of sheets)
      for (const cell of Object.values(sheet.cells))
        for (const urn of formulaReferences(cell.formula)) {
          const reference = parseURN(urn);
          if (
            reference &&
            reference.document !== this.root.id &&
            !this.sessions.has(reference.document)
          )
            void this.ensure(reference.document);
        }
    this.calculating = true;
    this.worker.postMessage({ id: ++this.serial, snapshot: this.snapshot });
  }
  writeCells(
    document: string,
    block: string,
    edits: { identifier: string; input: string; formula?: Formula | null }[],
  ) {
    this.recalculate();
    const api = this.APIs.get(document),
      sheet = this.snapshot.sheets.find(
        (sheet) => sheet.document === document && sheet.block === block,
      );
    if (!api || !sheet) throw new Error("Spreadsheet is still loading");
    api.transact(
      edits.map((edit) => {
        let formula = edit.formula;
        if (formula === undefined)
          try {
            formula = bindFormula(edit.input, sheet, this.snapshot);
          } catch {
            formula = null;
          }
        return { type: "cell.set", block, ...edit, formula };
      }),
    );
  }
  formulaText(document: string, block: string, identifier: string) {
    const cell = this.snapshot.sheets.find(
      (sheet) => sheet.document === document && sheet.block === block,
    )?.cells[identifier];
    return cell?.formula
      ? formatFormula(cell.formula, this.snapshot)
      : (cell?.input ?? "");
  }
  destroy() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.worker.terminate();
    for (const cancel of [...this.pending]) cancel();
    for (const [id, session] of this.sessions) {
      this.cleanup.get(id)?.();
      if (id !== this.root.id) session.destroy();
    }
    this.listeners.clear();
  }
}
const Context = createContext<OfficeData | null>(null);
export function OfficeDataProvider({
  session,
  documents,
  api,
  user,
  namespace,
  children,
}: {
  session: DocumentSession;
  documents: DocumentMeta[];
  api: WorkspaceAPI;
  user: User;
  namespace: string;
  children: ReactNode;
}) {
  const [data] = useState(
    () => new OfficeData(session, documents, api, user, namespace),
  );
  useEffect(() => {
    data.setDocuments(documents);
  }, [documents, data]);
  useEffect(() => () => data.destroy(), [data]);
  return <Context.Provider value={data}>{children}</Context.Provider>;
}
export function useOfficeData() {
  const data = useContext(Context);
  if (!data) throw new Error("OfficeDataProvider is required");
  return data;
}
export function useOfficeRevision() {
  const data = useOfficeData();
  return useSyncExternalStore(data.subscribe, data.getRevision);
}
