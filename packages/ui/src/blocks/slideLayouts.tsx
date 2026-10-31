import { useLayoutEffect, useRef, useState, type ComponentType } from "react";
import type { DocumentSession } from "@office/collaboration";
import { updateText, type SharedRecord } from "@office/model";
import * as Y from "yjs";
import { useShared } from "../shared/hooks";
import { DocEditor } from "./DocEditor";
import { CanvasEditor } from "./CanvasEditor";
import { SlashPopover, type SlashState } from "../shared/References";
import { useOfficeData } from "../shared/OfficeData";
import { LOCAL_ORIGIN } from "@office/model";
export type SlideProps = {
  slide: SharedRecord;
  session: DocumentSession;
  readOnly?: boolean;
};
export function SharedText({
  text,
  label,
  className,
  readOnly = false,
}: {
  text: Y.Text;
  label: string;
  className?: string;
  readOnly?: boolean;
}) {
  useShared(text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const value = text.toString();
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);
  const data = useOfficeData(),
    [slash, setSlash] = useState<SlashState | null>(null);
  return (
    <>
      <textarea
        ref={ref}
        className={`shared-text ${className ?? ""}`}
        aria-label={label}
        value={value}
        placeholder={readOnly ? undefined : label}
        readOnly={readOnly}
        tabIndex={readOnly ? -1 : undefined}
        rows={1}
        onChange={(event) => {
          updateText(text, event.target.value);
          const before = event.target.value.slice(
            0,
            event.target.selectionStart,
          );
          const match = /(?:^|\s)(\/\w*)$/.exec(before);
          const bounds = event.currentTarget.getBoundingClientRect();
          setSlash(
            match
              ? {
                  query: match[1],
                  from: before.length - match[1].length,
                  to: before.length,
                  x: bounds.left,
                  y: bounds.bottom,
                }
              : null,
          );
        }}
        onKeyDown={(event) => {
          if (slash && event.key === "Enter") {
            event.preventDefault();
            (
              event.currentTarget
                .closest(".slide-card")
                ?.querySelector<HTMLButtonElement>(
                  ".slash-command-list button",
                ) ??
              document.querySelector<HTMLButtonElement>(
                "[data-office-portal] .slash-command-list button",
              )
            )?.click();
          }
        }}
      />
      {slash && (
        <SlashPopover
          state={slash}
          onClose={() => setSlash(null)}
          onLink={(urn) => {
            const slide = text.parent as Y.Map<any>;
            text.doc?.transact(() => {
              if (!slide.has("links")) slide.set("links", new Y.Map<string>());
              slide.get("links").set(crypto.randomUUID(), urn);
              updateText(
                text,
                text.toString().slice(0, slash.from) +
                  text.toString().slice(slash.to),
              );
            }, LOCAL_ORIGIN);
            setSlash(null);
          }}
        />
      )}
    </>
  );
}
function TitleSlide({ slide, readOnly }: SlideProps) {
  useShared(slide);
  return (
    <div className="title-slide">
      <SharedText
        text={slide.get("title")}
        label="Slide title"
        className="title-slide-title"
        readOnly={readOnly}
      />
      <SharedText
        text={slide.get("subtitle")}
        label="Slide subtitle"
        className="title-slide-subtitle"
        readOnly={readOnly}
      />
      <span className="slide-decoration" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
function ContentSlide({ slide, session, readOnly }: SlideProps) {
  useShared(slide);
  return (
    <div className="content-slide">
      <SharedText
        text={slide.get("title")}
        label="Slide title"
        className="content-slide-title"
        readOnly={readOnly}
      />
      <div className="slide-content-body">
        {slide.get("contentKind") === "canvas" ? (
          <CanvasEditor
            shapes={slide.get("shapes")}
            session={session}
            scope={slide.get("id")}
            compact
            readOnly={readOnly}
          />
        ) : (
          <DocEditor
            fragment={slide.get("content")}
            session={session}
            compact
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  );
}
// Add an entry here to add a layout. Each receives a shared slide record + session.
// Initialize additional Yjs fields in createSlide() if your layout needs them.
export const slideLayouts: Record<
  string,
  { label: string; component: ComponentType<SlideProps> }
> = {
  title: { label: "Title slide", component: TitleSlide },
  content: { label: "Content slide", component: ContentSlide },
};
