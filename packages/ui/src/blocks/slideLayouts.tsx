import type { ComponentType } from "react";
import type { DocumentSession } from "@office/collaboration";
import { updateText, type SharedRecord } from "@office/model";
import * as Y from "yjs";
import { useShared } from "../shared/hooks";
import { DocEditor } from "./DocEditor";
import { CanvasEditor } from "./CanvasEditor";
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
  return (
    <textarea
      className={`shared-text ${className ?? ""}`}
      aria-label={label}
      value={text.toString()}
      placeholder={label}
      readOnly={readOnly}
      rows={1}
      onChange={(e) => updateText(text, e.target.value)}
    />
  );
}
function TitleSlide({ slide, readOnly }: SlideProps) {
  useShared(slide);
  return (
    <div className="title-slide">
      <span className="slide-eyebrow">A NEW PERSPECTIVE</span>
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
      <div className="slide-content-switch">
        {!readOnly && (
          <>
            <button
              aria-pressed={slide.get("contentKind") === "doc"}
              onClick={() => slide.set("contentKind", "doc")}
            >
              Note
            </button>
            <button
              aria-pressed={slide.get("contentKind") === "canvas"}
              onClick={() => slide.set("contentKind", "canvas")}
            >
              Canvas
            </button>
          </>
        )}
      </div>
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
