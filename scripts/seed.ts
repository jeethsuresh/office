import * as Y from "yjs";
import { createBlock, createRecord, createSlide } from "../packages/model/src";
import { writeFileSync } from "node:fs";
const doc = new Y.Doc();
doc.clientID = 100;
const note = createBlock("doc", "Getting started", "welcome-doc");
const sketch = createBlock("canvas", "Example canvas", "welcome-canvas");
const story = createBlock("slides", "Example slides", "welcome-slides");
[note, sketch, story].forEach((block) =>
  block.set("updatedAt", "2026-10-12T00:00:00.000Z"),
);
doc.getArray("blocks").push([note, sketch, story]);
function paragraph(
  fragment: Y.XmlFragment,
  text: string,
  node = "paragraph",
  attrs: Record<string, any> = {},
) {
  const p = new Y.XmlElement(node);
  Object.entries(attrs).forEach(([k, v]) => p.setAttribute(k, v));
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  fragment.insert(fragment.doc ? fragment.length : 0, [p]);
}
const fragment = note.get("content") as Y.XmlFragment;
paragraph(fragment, "Office", "heading", {
  level: 1,
});
paragraph(
  fragment,
  "Documents contain rich-text, canvas, slide, and spreadsheet blocks. Open the workspace from the Office logo to organize documents into folders.",
);
paragraph(fragment, "Write and format text", "heading", { level: 2 });
paragraph(
  fragment,
  "Try # for a heading, **bold**, or a dash for a list. The header toolbar follows the editor in focus. Type /link to reference another document, block, or element.",
);
paragraph(fragment, "Navigate and edit blocks", "heading", { level: 2 });
paragraph(
  fragment,
  "Use the minimap or previous/next previews to navigate between blocks. Add, reorder, and delete blocks in the minimap. Use the fullscreen control to focus on an editor.",
);
const shapes = sketch.get("shapes") as Y.Map<any>;
[
  {
    id: "s1",
    kind: "rect",
    x: 80,
    y: 160,
    width: 220,
    height: 130,
    color: "#4f83cf",
    fill: "#e8effb",
    text: "Doc",
  },
  {
    id: "s2",
    kind: "ellipse",
    x: 440,
    y: 145,
    width: 220,
    height: 160,
    color: "#cf6658",
    fill: "#f9e7e1",
    text: "Canvas",
  },
  {
    id: "s3",
    kind: "rect",
    x: 790,
    y: 160,
    width: 220,
    height: 130,
    color: "#a08027",
    fill: "#fbf0ce",
    text: "Slides",
  },
  {
    id: "a1",
    kind: "arrow",
    x: 315,
    y: 225,
    width: 100,
    height: 0,
    color: "#888b91",
    fill: "none",
  },
  {
    id: "a2",
    kind: "arrow",
    x: 675,
    y: 225,
    width: 100,
    height: 0,
    color: "#888b91",
    fill: "none",
  },
  {
    id: "t1",
    kind: "text",
    x: 100,
    y: 80,
    width: 700,
    height: 40,
    color: "#3e4147",
    fill: "none",
    text: "Example diagram",
  },
].forEach((shape) => shapes.set(shape.id, createRecord(shape)));
const slides = story.get("slides") as Y.Array<any>;
slides.delete(0, slides.length);
const title = createSlide("title", "welcome-slide-title");
const content = createSlide("content", "welcome-slide-content");
slides.push([title, content]);
(title.get("title") as Y.Text).delete(0, (title.get("title") as Y.Text).length);
(title.get("title") as Y.Text).insert(0, "Example presentation");
(title.get("subtitle") as Y.Text).delete(
  0,
  (title.get("subtitle") as Y.Text).length,
);
(title.get("subtitle") as Y.Text).insert(0, "Title slide");
(content.get("title") as Y.Text).delete(
  0,
  (content.get("title") as Y.Text).length,
);
(content.get("title") as Y.Text).insert(0, "Content slide");
paragraph(
  content.get("content"),
  "Content slides can contain a rich-text note or a canvas. Change the layout in the slide bar and add slides from the header toolbar; navigate with the carousel or minimap.",
);
writeFileSync(
  new URL("../backend/internal/store/welcome.bin", import.meta.url),
  Y.encodeStateAsUpdate(doc),
);
console.log("Generated the deterministic welcome document.");
