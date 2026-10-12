import { test, expect } from "@playwright/test";
import {
  newDocument,
  newBlock,
  openBlockActions,
  clickBlockAction,
} from "./office-fixtures";

for (const width of [1400, 844, 390])
  test(`attached headers stay on one row and canvas zoom stays in the tools at ${width}px`, async ({
    browser,
    request,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height: width === 844 ? 390 : 900 },
      hasTouch: width === 390,
      isMobile: width === 390,
    });
    const page = await context.newPage();
    const id = await newDocument(page, request, `Block toolbar ${Date.now()}`);
    try {
      const noteID = await newBlock(page, "Doc", "Toolbar note");
      const heading = page.locator(".office-block.is-active .block-heading");
      const title = heading.getByLabel("Doc block title", { exact: true });
      const note = page.getByLabel("Document text", { exact: true });
      await note.fill("Keep editing available");
      await expect(page.locator(".block-viewport")).not.toHaveClass(
        /is-navigating/,
      );
      const bounds = (await heading.boundingBox())!,
        body = (await page
          .locator(".office-block.is-active .block-body")
          .boundingBox())!;
      expect(body.y).toBeCloseTo(bounds.y + bounds.height);
      expect(body.x).toBeCloseTo(bounds.x);
      expect(body.width).toBeCloseTo(bounds.width);
      expect(bounds.height).toBeLessThanOrEqual(36);
      const copy = (await heading
        .getByRole("button", { name: "Copy block reference", exact: true })
        .boundingBox())!;
      expect(copy.y).toBeGreaterThanOrEqual(bounds.y);
      expect(copy.y + copy.height).toBeLessThanOrEqual(
        bounds.y + bounds.height,
      );
      expect(copy.x + copy.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      const overflow = heading.getByRole("button", {
        name: "More block actions",
        exact: true,
      });
      if (width < 1400) {
        await expect(overflow).toBeVisible();
        await overflow.focus();
        await page.keyboard.press("ArrowDown");
        const menu = heading.getByRole("dialog", {
          name: "Block actions",
          exact: true,
        });
        await expect(menu).toBeVisible();
        await expect(
          menu.getByRole("button", { name: "Undo text", exact: true }),
        ).toBeFocused();
        await expect(menu.locator("time")).toContainText("Last updated");
        const menuBounds = (await menu.boundingBox())!;
        expect(menuBounds.x).toBeGreaterThanOrEqual(0);
        expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(width);
        expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(
          await page.evaluate(() => innerHeight),
        );
        await page.keyboard.press("ArrowDown");
        await expect(
          menu.getByRole("button", { name: "Delete block", exact: true }),
        ).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();
        await expect(overflow).toBeFocused();
        await openBlockActions(page);
        await title.click();
        await expect(menu).toBeHidden();
        await clickBlockAction(page, "Undo text");
        await expect(note).not.toContainText("Keep editing available");
        await clickBlockAction(page, "Redo text");
        await expect(note).toContainText("Keep editing available");
        await openBlockActions(page);
        await page.screenshot({
          path: `test-results/block-overflow-${width}.png`,
        });
        await page.setViewportSize({ width: 1500, height: 1000 });
        await expect(overflow).toHaveCount(0);
        await expect(
          heading.getByRole("button", {
            name: "Download Markdown",
            exact: true,
          }),
        ).toBeVisible();
        await page.setViewportSize({
          width,
          height: width === 844 ? 390 : 900,
        });
        await expect(overflow).toBeVisible();
      } else {
        await expect(overflow).toHaveCount(0);
        await expect(
          heading.getByRole("button", {
            name: "Download Markdown",
            exact: true,
          }),
        ).toBeVisible();
        await expect(heading.locator("time")).toBeVisible();
      }
      await note.evaluate((el) => {
        (window as any).toolbarNote = el;
      });
      await newBlock(page, "Canvas", "Toolbar canvas");
      await expect(page.locator(".block-viewport")).not.toHaveClass(
        /is-navigating/,
      );
      const canvas = page.locator(".office-block.is-active .canvas-editor");
      const tools = canvas.getByLabel("Canvas tools", { exact: true });
      const zoom = tools.getByLabel("Canvas zoom level", { exact: true });
      await expect(page.locator(".canvas-caption")).toHaveCount(0);
      await expect(zoom).toHaveText("100%");
      await tools.getByRole("button", { name: "Zoom in", exact: true }).click();
      await expect(zoom).toHaveText("125%");
      const zoomBounds = (await zoom.boundingBox())!,
        plus = (await tools
          .getByRole("button", { name: "Zoom in", exact: true })
          .boundingBox())!,
        minus = (await tools
          .getByRole("button", { name: "Zoom out", exact: true })
          .boundingBox())!;
      expect(zoomBounds.y).toBeGreaterThanOrEqual(plus.y + plus.height);
      expect(zoomBounds.y + zoomBounds.height).toBeLessThanOrEqual(minus.y);
      await tools
        .getByRole("button", { name: "Zoom out", exact: true })
        .click();
      await expect(zoom).toHaveText("100%");
      await tools
        .getByRole("button", { name: "Fullscreen canvas", exact: true })
        .click();
      await expect(canvas).toHaveClass(/editor-fullscreen/);
      await tools.getByRole("button", { name: "Zoom in", exact: true }).click();
      await expect(zoom).toHaveText("125%");
      expect(
        await canvas.evaluate((el) =>
          el.contains(document.elementFromPoint(innerWidth / 2, 20)),
        ),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(canvas).not.toHaveClass(/editor-fullscreen/);
      await expect(zoom).toHaveText("125%");
      await page.screenshot({
        path: `test-results/block-canvas-tools-${width}.png`,
      });
      await page
        .getByRole("button", {
          name: "Go to doc block: Toolbar note",
          exact: true,
        })
        .click();
      await expect(page.locator(".office-block.is-active")).toHaveAttribute(
        "data-block-id",
        noteID,
      );
      await expect(page.locator(".block-viewport")).not.toHaveClass(
        /is-navigating/,
      );
      expect(
        await note.evaluate((el) => (window as any).toolbarNote === el),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    } finally {
      await context.close();
      await request.delete(`/api/documents/${id}`);
    }
  });
