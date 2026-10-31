import { test, expect } from "@playwright/test";
import { newDocument, newBlock, setCell } from "./office-fixtures";

for (const width of [390, 844, 1600]) {
  test(`workspace fills its available width and follows editor focus at ${width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    const id = await newDocument(
      page,
      request,
      `Workspace layout ${Date.now()}`,
    );
    const header = page.locator(".topbar");
    const map = page.getByRole("complementary", {
      name: "Document minimap",
      exact: true,
    });
    try {
      await expect(page.locator(".sidebar")).toHaveCount(0);
      await expect(
        header.getByRole("button", { name: "Open workspace", exact: true }),
      ).toBeVisible();
      for (const [kind, name, label, control] of [
        ["Doc", "Notes", "Writing tools", "Bold"],
        ["Canvas", "Drawing", "Canvas tools", "Rectangle (R)"],
        ["Slides", "Deck", "Slide tools", "Add content slide"],
        ["Sheet", "Budget", "Spreadsheet tools", "Insert row above"],
      ]) {
        await newBlock(page, kind, name);
        await expect(page.locator(".block-viewport")).not.toHaveClass(
          /is-navigating/,
        );
        const tools = header.getByRole("toolbar", { name: label, exact: true });
        await expect(tools).toBeVisible();
        await expect(
          tools.getByRole("button", { name: control, exact: true }),
        ).toBeVisible();
        await expect(header.getByRole("toolbar")).toHaveCount(1);
        await expect(
          page.locator(
            ".office-block.is-active > .block-editor > .block-body > * > .editor-tools",
          ),
        ).toHaveCount(0);
        const layout = await page.evaluate(() => {
          const viewport = document
            .querySelector(".block-viewport")!
            .getBoundingClientRect();
          const body = document
            .querySelector(".office-block.is-active .block-body")!
            .getBoundingClientRect();
          const heading = document
            .querySelector(".office-block.is-active .block-heading")!
            .getBoundingClientRect();
          return {
            left: body.left,
            width: body.width,
            available: viewport.width,
            top: body.top,
            headingBottom: heading.bottom,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        expect(layout.left).toBe(0);
        expect(layout.width).toBeCloseTo(layout.available);
        expect(layout.top).toBeCloseTo(layout.headingBottom);
        expect(layout.overflow).toBe(false);
        const fullscreen = map.locator(".minimap-fullscreen button");
        await expect(fullscreen).toHaveCount(1);
        const fullBounds = (await fullscreen.boundingBox())!;
        const actions = (await map.locator(".minimap-actions").boundingBox())!;
        expect(fullBounds.y).toBeGreaterThanOrEqual(actions.y + actions.height);
      }
      await setCell(page, "A1", "42", "42");
      await map
        .getByRole("button", { name: "Go to slides block: Deck", exact: true })
        .click();
      await header
        .getByRole("button", { name: "Add content slide", exact: true })
        .click();
      const note = page.getByLabel("Slide note", { exact: true });
      await note.fill("Retain this slide note");
      await expect(
        header.getByRole("toolbar", { name: "Writing tools", exact: true }),
      ).toBeVisible();
      // Deck history/export actions stay attached while embedded text has focus.
      await expect(
        page.locator(".office-block.is-active .block-heading .block-actions"),
      ).not.toBeEmpty();
      await header.getByRole("button", { name: "Bold", exact: true }).click();
      await note.press("End");
      await note.pressSequentially(" in bold");
      await expect(note.locator("strong")).toHaveText(" in bold");
      await page
        .getByRole("button", { name: "Go to slide 1", exact: true })
        .click();
      await expect(
        header.getByRole("toolbar", { name: "Slide tools", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Go to slide 2", exact: true })
        .click();
      await note.focus();
      await map
        .getByRole("button", { name: "Fullscreen slide note", exact: true })
        .click();
      await expect(
        page.locator(".doc-editor.compact.editor-fullscreen"),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Exit fullscreen", exact: true })
        .click();
      await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
      await expect(note).toContainText("Retain this slide note in bold");
      await expect(
        header.getByRole("toolbar", { name: "Writing tools", exact: true }),
      ).toBeVisible();
      await map
        .getByRole("button", { name: "Go to sheet block: Budget", exact: true })
        .click();
      await expect(
        page.getByLabel("Selected cell result", { exact: true }),
      ).toHaveText("A1: 42");
      await header
        .getByRole("button", { name: "Open workspace", exact: true })
        .click();
      await expect(page.locator(".workspace-browser")).toBeVisible();
      await expect(header.getByRole("toolbar")).toHaveCount(0);
    } finally {
      await request.delete(`/api/documents/${id}`);
    }
  });
}
