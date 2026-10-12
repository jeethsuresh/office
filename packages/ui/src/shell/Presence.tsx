import { useId, useState } from "react";
import type { DocumentSession, User } from "@office/collaboration";
import { useSession } from "../shared/hooks";

export function Presence({ session }: { session: DocumentSession }) {
  useSession(session);
  const [open, setOpen] = useState(false);
  const id = useId();
  const peers = [...session.awareness.getStates()]
    .map(([id, state]) => ({ id, user: state.user as User }))
    .filter((peer) => peer.user);
  return (
    <div
      className="presence"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        className="presence-avatars"
        aria-label={`${peers.length} ${peers.length === 1 ? "person" : "people"} in this document`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        {peers.slice(0, 4).map((peer) => (
          <span
            key={peer.id}
            title={peer.user.name}
            style={{ background: peer.user.color }}
          >
            {peer.user.name.slice(0, 1).toUpperCase()}
          </span>
        ))}
        {peers.length > 4 && (
          <span className="presence-overflow">+{peers.length - 4}</span>
        )}
      </button>
      {open && (
        <div className="presence-names" id={id} role="tooltip">
          <strong>In this document</strong>
          <ul>
            {peers.map((peer) => (
              <li key={peer.id}>
                <i style={{ background: peer.user.color }} />
                <span>
                  {peer.user.name || "Guest"}
                  {peer.id === session.doc.clientID && <small> (you)</small>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
