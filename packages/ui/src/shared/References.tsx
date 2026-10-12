import { useEffect, useState, useRef, type ReactNode } from "react";
import {
  FileText,
  Hash,
  Link2,
  MapPin,
  Presentation,
  Table2,
  X,
  Copy,
} from "lucide-react";
import {
  parseURN,
  referenceURN,
  cellID,
  resolveTarget,
  type Target,
} from "@office/model";
import { useOfficeData, useOfficeRevision } from "./OfficeData";
export type SlashCommand = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
};
export const slashCommands = new Map<string, SlashCommand>([
  [
    "link",
    {
      id: "link",
      title: "Link to…",
      description: "A document, heading, slide, pin, or cell",
      icon: <Link2 size={16} />,
    },
  ],
]);
export function registerSlashCommand(command: SlashCommand) {
  slashCommands.set(command.id, command);
  return () => {
    slashCommands.delete(command.id);
  };
}
const icons = {
  document: FileText,
  block: FileText,
  heading: Hash,
  slide: Presentation,
  pin: MapPin,
  cell: Table2,
};
export function ReferenceChip({
  urn,
  onRemove,
}: {
  urn: string;
  onRemove?: () => void;
}) {
  const data = useOfficeData();
  useOfficeRevision();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const ref = parseURN(urn);
    if (ref)
      void data.ensure(ref.document).finally(() => {
        if (active) setLoading(false);
      });
    else setLoading(false);
    return () => {
      active = false;
    };
  }, [data, urn]);
  const target = data.resolve(urn),
    Icon = icons[target?.kind ?? "block"];
  return (
    <span
      className={`reference-chip ${!target && !loading ? "reference-missing" : ""}`}
    >
      <button
        type="button"
        title={target ? `${target.detail} / ${target.label}\n${urn}` : urn}
        aria-label={
          target ? `Open reference: ${target.label}` : "Missing reference"
        }
        disabled={!target}
        onClick={() => void data.open(urn)}
      >
        <Icon size={13} />
        <span>
          {target?.label ??
            (loading ? "Loading reference…" : "Missing reference")}
          {target?.kind === "cell" && target.value !== ""
            ? ` · ${target.value}`
            : ""}
        </span>
      </button>
      {onRemove && (
        <button type="button" aria-label="Remove reference" onClick={onRemove}>
          <X size={12} />
        </button>
      )}
    </span>
  );
}
export function ReferencePicker({
  onSelect,
  onClose,
}: {
  onSelect: (urn: string) => void;
  onClose?: () => void;
}) {
  const data = useOfficeData();
  useOfficeRevision();
  const [query, setQuery] = useState(""),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as globalThis.Node)) onClose?.();
    };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, [onClose]);
  useEffect(() => {
    let active = true;
    void data.loadTargets().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [data]);
  const candidates = data.targets();
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const address = /(?:^|\s)([a-z]+[1-9]\d*)$/i.exec(query)?.[1];
  if (address) {
    for (const sheet of data.snapshot.sheets) {
      const match = /^([a-z]+)(\d+)$/i.exec(address)!;
      const column =
          [...match[1].toUpperCase()].reduce(
            (n, letter) => n * 26 + letter.charCodeAt(0) - 64,
            0,
          ) - 1,
        row = Number(match[2]) - 1;
      const id =
        sheet.rows[row] && sheet.columns[column]
          ? `${sheet.rows[row]}~${sheet.columns[column]}`
          : null;
      if (!id) continue;
      const urn = `${sheet.document}:${sheet.block}:${id}`,
        target = data.resolve(urn);
      if (target && !candidates.some((candidate) => candidate.urn === urn))
        candidates.push(target);
    }
  }
  const direct = parseURN(query.trim());
  if (direct) {
    const target = data.resolve(query.trim());
    if (target && !candidates.some((candidate) => candidate.urn === target.urn))
      candidates.push(target);
  }
  const targets = candidates
    .filter((target) =>
      direct
        ? target.urn === referenceURN(direct)
        : terms.every((term) =>
            `${target.label} ${target.detail}`.toLowerCase().includes(term),
          ),
    )
    .slice(0, 100);
  useEffect(() => {
    setSelected(0);
  }, [query]);
  useEffect(() => {
    list.current
      ?.querySelectorAll<HTMLElement>('[role="option"]')
      [selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <div
      ref={root}
      className="reference-picker"
      aria-label="Choose a link target"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose?.();
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setSelected((index) =>
            Math.max(
              0,
              Math.min(
                targets.length - 1,
                index + (event.key === "ArrowDown" ? 1 : -1),
              ),
            ),
          );
        }
        if (event.key === "Enter" && targets[selected]) {
          event.preventDefault();
          onSelect(targets[selected].urn);
        }
      }}
    >
      <div className="reference-picker-heading">
        <Link2 size={15} />
        <span>Insert link</span>
        {onClose && (
          <button aria-label="Close link picker" onClick={onClose}>
            <X size={14} />
          </button>
        )}
      </div>
      <input
        autoFocus
        aria-label="Search link targets"
        placeholder="Find a document, block, or element…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        role="combobox"
        aria-expanded="true"
        aria-controls="office-link-options"
        aria-autocomplete="list"
        aria-activedescendant={
          targets[selected] ? `link-option-${selected}` : undefined
        }
      />
      <div
        ref={list}
        className="reference-results"
        role="listbox"
        id="office-link-options"
        aria-label="Link targets"
      >
        {targets.map((target, index) => {
          const Icon = icons[target.kind];
          return (
            <button
              type="button"
              role="option"
              aria-selected={index === selected}
              id={`link-option-${index}`}
              key={target.urn}
              onMouseEnter={() => setSelected(index)}
              onClick={() => onSelect(target.urn)}
            >
              <Icon size={15} />
              <span>
                <strong>{target.label}</strong>
                <small>
                  {target.detail}
                  {target.kind === "cell" && target.value
                    ? ` · ${target.value}`
                    : ""}
                </small>
              </span>
              <em>{target.kind}</em>
            </button>
          );
        })}
        {!targets.length && (
          <p className="muted">
            {loading
              ? "Loading your workspace…"
              : "No matching targets. Try a sheet name and A1 for an empty cell."}
          </p>
        )}
      </div>
      <div className="reference-picker-footer">
        ↑ ↓ to browse · Enter to link · Escape to close
        {loading && <span>Loading…</span>}
      </div>
    </div>
  );
}
export type SlashState = {
  query: string;
  from: number;
  to: number;
  x: number;
  y: number;
};
export function SlashPopover({
  state,
  onLink,
  onClose,
  onCommand,
}: {
  state: SlashState;
  onLink: (urn: string) => void;
  onClose: () => void;
  onCommand?: (id: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as globalThis.Node)) onClose();
    };
    window.addEventListener("pointerdown", outside, true);
    return () => window.removeEventListener("pointerdown", outside, true);
  }, [onClose]);
  const matches = [...slashCommands.values()].filter((command) =>
    command.id.startsWith(state.query.replace(/^\//, "")),
  );
  return (
    <div
      ref={root}
      className="slash-popover"
      role="dialog"
      aria-label="Slash commands"
      style={{
        left: Math.max(8, Math.min(state.x, innerWidth - 368)),
        top: Math.max(8, Math.min(state.y + 8, innerHeight - 380)),
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      {picking ? (
        <ReferencePicker onSelect={onLink} onClose={onClose} />
      ) : (
        <div className="slash-command-list">
          {matches.map((command) => (
            <button
              key={command.id}
              onClick={() =>
                command.id === "link"
                  ? setPicking(true)
                  : onCommand?.(command.id)
              }
            >
              {command.icon}
              <span>
                <strong>{command.title}</strong>
                <small>{command.description}</small>
              </span>
            </button>
          ))}
          {!matches.length && <p className="muted">No matching commands.</p>}
          <button
            className="slash-dismiss"
            aria-label="Close slash commands"
            onClick={onClose}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
export function CopyReference({
  urn,
  label = "Copy reference",
}: {
  urn: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(urn);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
    >
      <Copy size={14} />
      {copied && <span>Copied</span>}
    </button>
  );
}
export function Backlinks({ urn }: { urn: string }) {
  const data = useOfficeData();
  useOfficeRevision();
  const [open, setOpen] = useState(false);
  const links = data.backlinks(urn);
  return (
    <div className="backlinks">
      <button
        aria-label="Show backlinks"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) void data.loadTargets();
        }}
      >
        <Link2 size={13} />
        {links.length} backlinks
      </button>
      {open && (
        <div className="backlink-results">
          <strong>Linked from</strong>
          {links.length ? (
            links.map((link, index) => (
              <button
                key={`${link.source.urn}-${index}`}
                onClick={() => void data.open(link.source.urn)}
              >
                {link.source.detail} / {link.source.label}
              </button>
            ))
          ) : (
            <p className="muted">No links point here yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
