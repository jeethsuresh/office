import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Code2,
  Download,
  Type,
} from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import Turndown from "turndown";
import type * as Y from "yjs";
import type { DocumentSession } from "@office/collaboration";
import { ToolButton } from "../shared/Toolbar";
import { Modal } from "../shared/Modal";
import { EditorTools, useEditorFullscreen } from "../shared/Fullscreen";
export function DocEditor({
  fragment,
  session,
  compact = false,
  readOnly = false,
}: {
  fragment: Y.XmlFragment;
  session: DocumentSession;
  compact?: boolean;
  readOnly?: boolean;
}) {
  const ownerID = (fragment.parent as Y.Map<unknown> | null)?.get("id") as
    string | undefined;
  const fullscreen = useEditorFullscreen(
    ownerID
      ? `${compact ? "slide" : "block"}:${ownerID}${compact ? ":doc" : ""}`
      : undefined,
  );
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const user = session.awareness.getLocalState()?.user;
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          undoRedo: false,
          heading: { levels: [1, 2, 3] },
        }),
        Collaboration.configure({ fragment }),
        CollaborationCaret.configure({ provider: session, user }),
        Placeholder.configure({
          placeholder: compact
            ? "A thought belongs here…"
            : "Start writing. Try # for a heading, or **bold** for emphasis.",
        }),
      ],
      editable: !readOnly,
      shouldRerenderOnTransaction: true,
      editorProps: {
        attributes: {
          class: "prose",
          spellcheck: "true",
          "aria-label": compact ? "Slide note" : "Document text",
        },
        handlePaste: (view, event) => {
          const text = event.clipboardData?.getData("text/plain") ?? "";
          if (
            !event.clipboardData?.getData("text/html") &&
            /(^#{1,6} |\*\*.+\*\*|^[-*] |```|^> )/m.test(text)
          ) {
            const html = DOMPurify.sanitize(
              marked.parse(text, { async: false }) as string,
            );
            editor?.commands.insertContent(html);
            return true;
          }
          return false;
        },
      },
    },
    [fragment, session, readOnly],
  );
  if (!editor) return null;
  function download() {
    const text = new Turndown({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    }).turndown(editor!.getHTML());
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "office-note.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div
      ref={fullscreen.ref}
      className={`doc-editor ${compact ? "compact" : ""} ${readOnly ? "readonly" : ""} ${fullscreen.className}`}
    >
      {!readOnly && (
        <EditorTools
          className="doc-tools"
          label="Writing tools"
          fullscreen={fullscreen}
          fullscreenLabel={
            compact ? "Fullscreen slide note" : "Fullscreen note"
          }
        >
          <ToolButton
            label="Paragraph"
            active={editor.isActive("paragraph")}
            onClick={() => editor.chain().focus().setParagraph().run()}
          >
            <Type size={18} />
          </ToolButton>
          <ToolButton
            label="Heading 1"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Heading1 size={19} />
          </ToolButton>
          <ToolButton
            label="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 size={19} />
          </ToolButton>
          <span className="tool-divider" />
          <ToolButton
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={17} />
          </ToolButton>
          <ToolButton
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic size={17} />
          </ToolButton>
          <ToolButton
            label="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List size={18} />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={18} />
          </ToolButton>
          <ToolButton
            label="Quote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote size={17} />
          </ToolButton>
          <span className="tool-divider" />
          <ToolButton
            label="Undo text"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 size={17} />
          </ToolButton>
          <ToolButton
            label="Redo text"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 size={17} />
          </ToolButton>
          <ToolButton
            label="Markdown"
            onClick={() =>
              setMarkdown(
                new Turndown({
                  headingStyle: "atx",
                  codeBlockStyle: "fenced",
                }).turndown(editor.getHTML()),
              )
            }
          >
            <Code2 size={18} />
          </ToolButton>
          <ToolButton label="Download Markdown" onClick={download}>
            <Download size={17} />
          </ToolButton>
        </EditorTools>
      )}
      <div className="doc-paper">
        <EditorContent editor={editor} />
        <div className="doc-footnote">
          {editor.getText().trim().split(/\s+/).filter(Boolean).length} words{" "}
          <span>·</span> Markdown feels at home here
        </div>
      </div>
      {markdown !== null && (
        <Modal title="A little Markdown" onClose={() => setMarkdown(null)}>
          <p className="muted">
            Edit this Markdown and insert it at your cursor, or download the
            current note.
          </p>
          <textarea
            className="markdown-input"
            aria-label="Markdown source"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
          />
          <div className="modal-actions">
            <button className="secondary-button" onClick={download}>
              Download note
            </button>
            <button
              className="secondary-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(markdown);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              className="primary-button"
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .insertContent(
                    DOMPurify.sanitize(
                      marked.parse(markdown, { async: false }) as string,
                    ),
                  )
                  .run();
                setMarkdown(null);
              }}
            >
              Insert Markdown
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
