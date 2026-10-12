import { Extension, Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { ReferenceChip } from "../shared/References";
export const HeadingIdentity = Extension.create({
  name: "headingIdentity",
  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          officeID: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-office-anchor"),
            renderHTML: (attributes) =>
              attributes.officeID
                ? {
                    "data-office-anchor": attributes.officeID,
                    id: attributes.officeID,
                    tabindex: "-1",
                  }
                : {},
          },
        },
      },
    ];
  },
});
function ReferenceView({ node }: NodeViewProps) {
  return (
    <NodeViewWrapper
      as="span"
      className="office-reference"
      contentEditable={false}
    >
      <ReferenceChip urn={node.attrs.urn} />
    </NodeViewWrapper>
  );
}
export const OfficeReference = Node.create({
  name: "officeReference",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { urn: { default: "" }, label: { default: "Reference" } };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-office-reference]",
        getAttrs: (element) => ({
          urn: element.getAttribute("data-office-reference"),
          label: element.textContent,
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        { "data-office-reference": HTMLAttributes.urn },
        HTMLAttributes,
      ),
      HTMLAttributes.label,
    ];
  },
  renderText({ node }) {
    return `[${node.attrs.label}](${node.attrs.urn})`;
  },
  addNodeView() {
    return ReactNodeViewRenderer(ReferenceView);
  },
});
