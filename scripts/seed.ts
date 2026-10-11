import * as Y from "yjs";
import { createBlock, createRecord, createSlide } from "../packages/model/src";
import { writeFileSync } from "node:fs";
const doc = new Y.Doc();
doc.clientID = 100;
const note = createBlock(
  "doc",
  "Room for a little bit of everything",
  "welcome-doc",
);
const sketch = createBlock("canvas", "Connect the dots", "welcome-canvas");
const story = createBlock(
  "slides",
  "One idea. A whole story.",
  "welcome-slides",
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
paragraph(fragment, "Good things happen when ideas share a space.", "heading", {
  level: 1,
});
paragraph(
  fragment,
  "A note, a sketch, a story. All in the same document. Office is a place to follow your thinking wherever it goes — without switching tools.",
);
paragraph(fragment, "Start with a thought", "heading", { level: 2 });
paragraph(
  fragment,
  "Write here as you would on a blank page. Try # for a heading, **bold**, or a dash for a list. The tools to your left are always within reach.",
);
paragraph(fragment, "Then give it some room", "heading", { level: 2 });
paragraph(
  fragment,
  "Use the map or the next-block preview to draw connections on the canvas, or shape your thoughts into slides. The little map on the right keeps the whole picture in view.",
);
const quote = new Y.XmlElement("blockquote");
paragraph(
  quote as unknown as Y.XmlFragment,
  "One document. As many ways to think as you need.",
);
fragment.push([quote]);
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
    text: "A thought",
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
    text: "A connection",
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
    text: "A story",
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
    text: "Make space for the unexpected.",
  },
].forEach((shape) => shapes.set(shape.id, createRecord(shape)));
const slides = story.get("slides") as Y.Array<any>;
slides.delete(0, slides.length);
const title = createSlide("title", "welcome-slide-title");
const content = createSlide("content", "welcome-slide-content");
slides.push([title, content]);
(title.get("title") as Y.Text).delete(0, (title.get("title") as Y.Text).length);
(title.get("title") as Y.Text).insert(0, "Ideas become stories.");
(title.get("subtitle") as Y.Text).delete(
  0,
  (title.get("subtitle") as Y.Text).length,
);
(title.get("subtitle") as Y.Text).insert(
  0,
  "A little space. A new perspective. A place to begin.",
);
(content.get("title") as Y.Text).delete(
  0,
  (content.get("title") as Y.Text).length,
);
(content.get("title") as Y.Text).insert(0, "Everything connects.");
paragraph(
  content.get("content"),
  "Every slide can hold a living note or an open canvas. Change the layout, add another chapter, and build your story together.",
);
writeFileSync(
  new URL("../backend/internal/store/welcome.bin", import.meta.url),
  Y.encodeStateAsUpdate(doc),
);
console.log("Generated the deterministic welcome document.");
