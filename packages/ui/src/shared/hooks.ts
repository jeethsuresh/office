import { useEffect, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import type { DocumentSession } from "@office/collaboration";
export function useShared<T extends Y.AbstractType<any>>(shared: T): T {
  const [, render] = useState(0);
  useEffect(() => {
    const update = () => render((n) => n + 1);
    shared.observeDeep(update);
    update();
    return () => shared.unobserveDeep(update);
  }, [shared]);
  return shared;
}
export function useSession(session: DocumentSession) {
  const [version, setVersion] = useState(0);
  useEffect(() => session.subscribe(() => setVersion((v) => v + 1)), [session]);
  return { status: session.status, hydrated: session.hydrated, version };
}
export function useMedia(query: string) {
  return useSyncExternalStore(
    (listener) => {
      const media = matchMedia(query);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
