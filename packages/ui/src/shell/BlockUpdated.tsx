import { useEffect, useState } from "react";
import {
  blockUpdatedAt,
  blockUpdateClock,
  type SharedRecord,
} from "@office/model";
import { useShared } from "../shared/hooks";
import { relativeTime } from "../shared/api";
export function BlockUpdated({ block }: { block: SharedRecord }) {
  useShared(blockUpdateClock(block.doc!));
  useShared(block);
  const [, refresh] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => refresh((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  const value = blockUpdatedAt(block.doc!, block);
  return (
    <time
      className="block-updated"
      dateTime={value}
      title={
        value
          ? new Date(value).toLocaleString()
          : "No block timestamp recorded yet"
      }
    >
      Last updated {value ? relativeTime(value) : "—"}
    </time>
  );
}
