import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { newDocument, newBlock, setCell, selectCell } from "./office-fixtures";

async function exported(page: Page, label: string) {
  const pending = page.waitForEvent("download");
  await page
    .locator(".office-block.is-active .block-heading")
    .getByRole("button", { name: label, exact: true })
    .click();
  const download = await pending;
  return {
    name: download.suggestedFilename(),
    content: await readFile((await download.path())!, "utf8"),
  };
}
for (const mobile of [false, true]) {
  test(`block headers share timestamps, export content and keep block/element deletion separate on ${mobile ? "mobile" : "desktop"}`, async ({
    page,
    browser,
    request,
    baseURL,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
    const documentName = `Header ${Date.now()}`;
    const id = await newDocument(page, request, documentName);
    const peerContext = await browser.newContext({ baseURL });
    const peer = await peerContext.newPage();
    try {
      const noteID = await newBlock(page, "Doc", "Header note");
      const block = page.locator(".office-block.is-active");
      const heading = block.locator(".block-heading");
      await expect(page.locator(".document-caption")).toHaveCount(0);
      await expect(heading.locator(".block-type")).toHaveText("");
      await expect(heading.locator(".block-type")).toHaveAttribute(
        "aria-label",
        "Doc block",
      );
      for (const name of [
        "Copy block reference",
        "Undo text",
        "Redo text",
        "Delete block",
        "Download Markdown",
      ])
        await expect(
          heading.getByRole("button", { name, exact: true }),
        ).toBeVisible();
      await expect(
        block
          .locator(".editor-tools")
          .getByRole("button", { name: "Undo text", exact: true }),
      ).toHaveCount(0);
      await peer.goto(`/#document=${id}`);
      const note = page.getByLabel("Document text", { exact: true });
      await note.fill("Keep this");
      await note.press("End");
      await note.press("Enter");
      await note.pressSequentially("Remove this");
      await block
        .locator(".editor-tools")
        .getByRole("button", {
          name: "Delete selected text element",
          exact: true,
        })
        .click();
      await expect(note).toContainText("Keep this");
      await expect(note).not.toContainText("Remove this");
      await heading
        .getByRole("button", { name: "Undo text", exact: true })
        .click();
      await expect(note).toContainText("Remove this");
      await heading
        .getByRole("button", { name: "Redo text", exact: true })
        .click();
      await expect(note).not.toContainText("Remove this");
      const fullHeading = "Keep this heading has several additional words";
      await note.fill(fullHeading);
      await page
        .getByRole("button", { name: "Heading 1", exact: true })
        .click();
      await note.press("End");
      await note.press("Enter");
      await page
        .getByRole("button", { name: "Insert reference", exact: true })
        .click();
      await page.getByRole("button", { name: /Link to…/ }).click();
      const search = page.getByRole("combobox", {
        name: "Search link targets",
        exact: true,
      });
      await search.fill(`${documentName} ${fullHeading}`);
      const option = page
        .getByRole("listbox", { name: "Link targets" })
        .getByRole("option");
      await expect(option).toHaveCount(1);
      await expect(option).toContainText(
        "Keep this heading has several additional…",
      );
      await expect(option).toHaveAttribute("title", new RegExp(fullHeading));
      await search.press("Enter");
      await expect(note.locator(".reference-chip")).toHaveText(
        "Keep this heading has several additional…",
      );
      const md = await exported(page, "Download Markdown");
      expect(md.name).toBe("office-note.md");
      expect(md.content).toContain("Keep this");
      const updated = await heading.locator("time").getAttribute("datetime");
      await expect(
        peer.locator(`[data-block-id="${noteID}"] time`),
      ).toHaveAttribute("datetime", updated!);
      await peer
        .getByLabel("Document text", { exact: true })
        .fill("Edited by peer");
      await expect(note).toContainText("Edited by peer");
      await expect(heading.locator("time")).not.toHaveAttribute(
        "datetime",
        updated!,
      );
      const noteTime = await heading.locator("time").getAttribute("datetime");
      const canvasID = await newBlock(page, "Canvas", "Header drawing");
      await page
        .getByRole("button", { name: "Rectangle (R)", exact: true })
        .click();
      const surface = (await page
        .getByLabel("Drawing workspace", { exact: true })
        .boundingBox())!;
      await page.mouse.move(surface.x + 45, surface.y + 50);
      await page.mouse.down();
      await page.mouse.move(surface.x + 150, surface.y + 150);
      await page.mouse.up();
      await expect(block.locator("[data-shape-id]")).toHaveCount(1);
      await page
        .getByRole("button", { name: "Delete selected shape", exact: true })
        .click();
      await expect(block.locator("[data-shape-id]")).toHaveCount(0);
      await heading
        .getByRole("button", { name: "Undo canvas", exact: true })
        .click();
      await expect(block.locator("[data-shape-id]")).toHaveCount(1);
      const svg = await exported(page, "Download canvas");
      expect(svg.content).toContain("<svg");
      expect(svg.content).toContain("<rect");
      await expect(
        page.locator(`[data-block-id="${noteID}"] time`),
      ).toHaveAttribute("datetime", noteTime!);
      await heading
        .getByRole("button", { name: "Delete block", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Delete this block?" })
        .getByRole("button", { name: "Delete block", exact: true })
        .click();
      await expect(page.locator(`[data-block-id="${canvasID}"]`)).toHaveCount(
        0,
      );
      await page
        .getByRole("button", { name: "Undo block change", exact: true })
        .click();
      await expect(page.locator(`[data-block-id="${canvasID}"]`)).toHaveCount(
        1,
      );
      const sheetID = await newBlock(page, "Sheet", "Header values");
      await setCell(page, "A1", "7", "7");
      await setCell(page, "B1", "=A1*2", "14");
      await selectCell(page, "A1");
      await page
        .getByRole("button", { name: "Clear selected cells", exact: true })
        .click();
      await expect(page.getByLabel("Selected cell result")).toHaveText("A1:");
      await heading
        .getByRole("button", { name: "Undo spreadsheet", exact: true })
        .click();
      await expect(page.getByLabel("Selected cell result")).toHaveText("A1: 7");
      const csv = await exported(page, "Download spreadsheet CSV");
      expect(csv.content.split("\r\n")[0]).toMatch(/^"7","14"/);
      const beforeReload = await heading
        .locator("time")
        .getAttribute("datetime");
      await expect(page.getByText("All changes saved")).toBeVisible();
      await page.goto(`/#document=${id}&block=${sheetID}&target=_`);
      await page.reload();
      await expect(block).toHaveAttribute("data-block-id", sheetID);
      await expect(heading.locator("time")).toHaveAttribute(
        "datetime",
        beforeReload!,
      );
      await page
        .getByRole("button", { name: "Fullscreen spreadsheet", exact: true })
        .click();
      const tools = page.locator(
        ".sheet-editor.editor-fullscreen .editor-tools",
      );
      await expect(
        tools.getByRole("button", { name: "Undo spreadsheet", exact: true }),
      ).toBeVisible();
      await expect(
        tools.getByRole("button", { name: "Delete block", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      const deckID = await newBlock(page, "Slides", "Header deck");
      await page
        .getByLabel("Slide title", { exact: true })
        .fill("Exported title");
      const deck = JSON.parse(
        (await exported(page, "Download slides JSON")).content,
      );
      expect(deck.block).toBe(deckID);
      expect(deck.slides[0].title).toBe("Exported title");
      await page
        .getByRole("button", { name: "Delete slide", exact: true })
        .click();
      await expect(page.locator(".slide-card")).toHaveCount(0);
      await heading
        .getByRole("button", { name: "Undo slides", exact: true })
        .click();
      await expect(page.getByLabel("Slide title", { exact: true })).toHaveValue(
        "Exported title",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      const bounds = (await heading.boundingBox())!;
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(
        await page.evaluate(() => innerWidth),
      );
      await page.screenshot({
        path: `test-results/block-header-${mobile ? "mobile" : "desktop"}.png`,
      });
      expect(errors).toEqual([]);
    } finally {
      await peerContext.close().catch(() => {});
      await request.delete(`/api/documents/${id}`);
    }
  });
}
