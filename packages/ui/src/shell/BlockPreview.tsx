import * as Y from "yjs";
import {
  shapeValues,
  cellID,
  type SharedRecord,
  type Shape,
} from "@office/model";

function plainText(node: Y.XmlFragment | Y.XmlElement | Y.XmlText): string {
  if (node instanceof Y.XmlText)
    return node
      .toDelta()
      .map((part: { insert?: unknown }) =>
        typeof part.insert === "string" ? part.insert : "",
      )
      .join("");
  return node
    .toArray()
    .map((child) => plainText(child as Y.XmlElement | Y.XmlText))
    .join("");
}
function TextPreview({ content }: { content?: Y.XmlFragment }) {
  const rows =
    content
      ?.toArray()
      .slice(0, 45)
      .flatMap((node) => {
        const element = node as Y.XmlElement;
        const text = plainText(element);
        const heading = element.nodeName === "heading";
        const list =
          element.nodeName?.includes("list") ||
          element.nodeName === "blockquote";
        return Array.from(
          { length: Math.max(1, Math.min(4, Math.ceil(text.length / 60))) },
          (_, index) => ({
            width: Math.max(8, Math.min(108, (text.length - index * 60) * 1.8)),
            heading,
            indent: list ? 9 : 0,
            start: index === 0,
          }),
        );
      }) ?? [];
  let y = 8;
  const bars = rows.map((row, index) => {
    y += row.start ? 5 : 0;
    const result = (
      <rect
        key={index}
        x={6 + row.indent}
        y={y}
        width={Math.min(row.width, 108 - row.indent)}
        height={row.heading ? 3.5 : 1.8}
        rx={0.7}
        fill="currentColor"
        opacity={row.heading ? 0.8 : 0.42}
      />
    );
    y += row.heading ? 9 : 6;
    return result;
  });
  return (
    <svg
      className="block-preview text-preview"
      aria-hidden="true"
      data-preview-lines={rows.length}
      viewBox={`0 0 120 ${Math.max(90, y + 8)}`}
      preserveAspectRatio="xMinYMin meet"
    >
      {bars.length ? (
        bars
      ) : (
        <>
          <rect
            x="6"
            y="13"
            width="48"
            height="2"
            rx="1"
            fill="currentColor"
            opacity=".2"
          />
          <rect
            x="6"
            y="23"
            width="75"
            height="2"
            rx="1"
            fill="currentColor"
            opacity=".15"
          />
        </>
      )}
    </svg>
  );
}
function shapeBounds(shape: Shape) {
  const xs = [
    shape.x,
    shape.x + shape.width,
    ...(shape.points ?? []).map((point) => shape.x + point[0]),
  ];
  const ys = [
    shape.y,
    shape.y + shape.height,
    ...(shape.points ?? []).map((point) => shape.y + point[1]),
  ];
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}
function CanvasPreview({ shapes }: { shapes?: Y.Map<SharedRecord> }) {
  const values = shapes ? shapeValues(shapes).slice(0, 100) : [];
  const bounds = values.map(shapeBounds);
  const left = Math.min(0, ...bounds.map((box) => box.left));
  const top = Math.min(0, ...bounds.map((box) => box.top));
  const width = Math.max(300, ...bounds.map((box) => box.right)) - left;
  const height = Math.max(200, ...bounds.map((box) => box.bottom)) - top;
  return (
    <svg
      className="block-preview canvas-preview"
      aria-hidden="true"
      data-preview-shapes={values.length}
      viewBox={`${left - 20} ${top - 20} ${width + 40} ${height + 40}`}
    >
      {values.map((shape) => (
        <g
          key={shape.id}
          fill={shape.fill || "none"}
          stroke={shape.color}
          strokeWidth={Math.max(width, height) / 120}
          vectorEffect="non-scaling-stroke"
        >
          {shape.kind === "rect" && (
            <rect
              x={Math.min(shape.x, shape.x + shape.width)}
              y={Math.min(shape.y, shape.y + shape.height)}
              width={Math.abs(shape.width)}
              height={Math.abs(shape.height)}
              rx={5}
            />
          )}
          {shape.kind === "ellipse" && (
            <ellipse
              cx={shape.x + shape.width / 2}
              cy={shape.y + shape.height / 2}
              rx={Math.abs(shape.width / 2)}
              ry={Math.abs(shape.height / 2)}
            />
          )}
          {shape.kind === "arrow" && (
            <path
              d={`M${shape.x} ${shape.y} l${shape.width} ${shape.height}`}
              fill="none"
            />
          )}
          {shape.kind === "pen" && (
            <path
              d={shape.points
                ?.map(
                  (point, index) =>
                    `${index ? "L" : "M"}${shape.x + point[0]} ${shape.y + point[1]}`,
                )
                .join(" ")}
              fill="none"
            />
          )}
          {shape.kind === "text" && (
            <text
              x={shape.x}
              y={shape.y + 22}
              fill={shape.color}
              stroke="none"
              fontSize={22}
            >
              {shape.text?.slice(0, 40)}
            </text>
          )}
          {shape.kind === "pin" && (
            <circle cx={shape.x} cy={shape.y} r={14} fill={shape.color} />
          )}
        </g>
      ))}
      {!values.length && (
        <rect
          x="45"
          y="35"
          width="180"
          height="110"
          rx="8"
          fill="none"
          stroke="currentColor"
          strokeDasharray="5 5"
          opacity=".2"
        />
      )}
    </svg>
  );
}
export function BlockPreview({ block }: { block: SharedRecord }) {
  if (block.get("kind") === "sheet")
    return (
      <svg
        className="block-preview sheet-preview"
        aria-hidden="true"
        viewBox="0 0 120 150"
      >
        <g stroke="currentColor" strokeWidth=".5" opacity=".3">
          {Array.from({ length: 6 }, (_, index) => (
            <path key={`c${index}`} d={`M${index * 22} 5V145`} />
          ))}
          {Array.from({ length: 14 }, (_, index) => (
            <path key={`r${index}`} d={`M0 ${index * 10 + 5}H115`} />
          ))}
        </g>
        {Array.from({ length: 13 }, (_, row) =>
          Array.from({ length: 5 }, (_, col) => {
            const id = cellID(block, col, row);
            const input = id && block.get("cells").get(id)?.get("input");
            return input ? (
              <rect
                key={`${row}-${col}`}
                x={col * 22 + 3}
                y={row * 10 + 8}
                width={Math.min(16, String(input).length * 2.2)}
                height={2.2}
                fill="currentColor"
                opacity={String(input).startsWith("=") ? 0.8 : 0.4}
              />
            ) : null;
          }),
        )}
      </svg>
    );
  return block.get("kind") === "canvas" ? (
    <CanvasPreview shapes={block.get("shapes")} />
  ) : (
    <TextPreview content={block.get("content")} />
  );
}
export function SlidePreview({ slide }: { slide: SharedRecord }) {
  return slide.get("layout") === "title" ? (
    <div className="slide-title-preview" aria-hidden="true">
      <b>{slide.get("title")?.toString()}</b>
      <span>{slide.get("subtitle")?.toString()}</span>
    </div>
  ) : slide.get("contentKind") === "canvas" ? (
    <CanvasPreview shapes={slide.get("shapes")} />
  ) : (
    <TextPreview content={slide.get("content")} />
  );
}
