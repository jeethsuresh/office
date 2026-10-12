import { test, expect, type Page } from "@playwright/test";
import {
  newDocument,
  newBlock,
  setCell,
  selectCell,
  clickBlockAction,
  openBlockActions,
} from "./office-fixtures";

async function assertBoundaryGap(page: Page, direction: "previous" | "next") {
  const editor = (await page
    .locator(".office-block.is-active .block-editor")
    .boundingBox())!;
  const button = page.getByRole("button", {
    name:
      direction === "previous" ? "Add block at beginning" : "Add block at end",
    exact: true,
  });
  await expect(button).toBeInViewport();
  const bounds = (await button.boundingBox())!;
  const gap =
    direction === "previous"
      ? editor.y - bounds.y - bounds.height
      : bounds.y - editor.y - editor.height;
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThanOrEqual(5);
}

for (const profile of ["desktop", "mobile", "landscape"])
  test(`neighbor headers and smooth block navigation on ${profile}`, async ({
    browser,
    request,
    baseURL,
  }) => {
    const mobile = profile === "mobile";
    const context = await browser.newContext({
      baseURL,
      viewport: mobile
        ? { width: 390, height: 844 }
        : profile === "landscape"
          ? { width: 844, height: 390 }
          : { width: 1400, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    const documentID = await newDocument(
      page,
      request,
      `Block edges ${Date.now()}`,
    );
    try {
      const note = await newBlock(page, "Doc", "Project notes");
      await page
        .getByLabel("Document text", { exact: true })
        .fill("Shared note content");
      await assertBoundaryGap(page, "previous");
      await assertBoundaryGap(page, "next");
      await page.screenshot({
        path: `test-results/block-single-${profile}.png`,
      });
      const canvas = await newBlock(page, "Canvas", "Drawing");
      const slides = await newBlock(page, "Slides", "Presentation");
      await page
        .getByLabel("Slide title", { exact: true })
        .fill("Opening slide");
      const sheet = await newBlock(page, "Sheet", "Budget");
      await setCell(page, "A1", "42", "42");
      await expect(page.locator(".block-viewport")).not.toHaveClass(
        /is-navigating/,
      );
      await page.evaluate((id) => {
        (window as any).originalNote = document.querySelector(
          `[data-block-id="${id}"] .prose`,
        );
      }, note);
      await page
        .getByRole("button", {
          name: "Go to canvas block: Drawing",
          exact: true,
        })
        .click();
      await expect(page.locator(".block-viewport")).not.toHaveClass(
        /is-navigating/,
      );
      const previous = page.locator(".block-peek.previous");
      const next = page.locator(".block-peek.next");
      await expect(previous).toHaveAttribute("title", "Project notes");
      await expect(next).toHaveAttribute("title", "Presentation");
      expect(
        await previous.evaluate(
          (el) => el.closest<HTMLElement>("[data-block-id]")!.dataset.blockId,
        ),
      ).toBe(note);
      expect(
        await next.evaluate(
          (el) => el.closest<HTMLElement>("[data-block-id]")!.dataset.blockId,
        ),
      ).toBe(slides);
      await expect(
        page.locator(".office-block .block-navigation-pill"),
      ).toHaveCount(0);
      await expect(
        page.locator(".office-block.is-neighbor .block-body"),
      ).toHaveCount(2);
      for (const neighbor of [note, slides])
        await expect(
          page.locator(`[data-block-id="${neighbor}"] .block-body`),
        ).toHaveAttribute("inert", "");
      for (const button of [previous, next]) {
        expect(
          await button.evaluate((el) =>
            el.parentElement!.classList.contains("block-heading"),
          ),
        ).toBe(true);
        await expect(button.locator(".block-type")).toHaveCount(1);
        await expect(button.locator(".block-sequence")).toHaveCount(1);
      }
      const surface = (await page
        .locator(".office-block.is-active .block-body")
        .boundingBox())!;
      const before = (await previous.boundingBox())!,
        after = (await next.boundingBox())!;
      expect(before.y + before.height).toBeLessThan(surface.y);
      expect(after.y).toBeGreaterThan(surface.y + surface.height);
      expect(before.x).toBeCloseTo(surface.x + 1);
      expect(after.x).toBeCloseTo(surface.x + 1);
      expect(before.width).toBeCloseTo(surface.width - 2);
      expect(after.width).toBeCloseTo(surface.width - 2);
      await expect(previous).toBeInViewport();
      await expect(next).toBeInViewport();
      await page.screenshot({
        path: `test-results/block-edges-${profile}.png`,
      });
      const actions = await openBlockActions(page);
      for (const name of [
        "Go to previous block: Project notes",
        "Go to next block: Presentation",
      ])
        await expect(
          actions.getByRole("button", { name, exact: true }),
        ).toBeVisible();
      if (profile !== "desktop") {
        await page.screenshot({
          path: `test-results/block-navigation-overflow-${profile}.png`,
        });
        await page.keyboard.press("Escape");
      }

      // A neighboring header is keyboard navigation, never an editable title.
      await previous.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".office-block.is-active")).toHaveAttribute(
        "data-block-id",
        note,
      );
      await expect(page.locator(".block-viewport")).not.toHaveClass(
        /is-navigating/,
      );
      await clickBlockAction(page, "Go to next block: Drawing");
      await expect(page.locator(".office-block.is-active")).toHaveAttribute(
        "data-block-id",
        canvas,
      );
      await expect(page.locator(".block-viewport")).not.toHaveClass(
        /is-navigating/,
      );
      await expect(
        page.getByRole("dialog", { name: "Block actions", exact: true }),
      ).toHaveCount(0);

      // Sample actual movement, rather than only asserting a CSS property.
      await page.evaluate((id) => {
        const element = document.querySelector(
          `[data-block-id="${id}"] .block-editor`,
        )!;
        const frames: number[] = [];
        (window as any).blockFrames = frames;
        const start = performance.now();
        function sample() {
          frames.push(element.getBoundingClientRect().y);
          if (performance.now() - start < 750) requestAnimationFrame(sample);
        }
        sample();
      }, slides);
      await next.click();
      await expect(page.locator(".office-block.is-active")).toHaveAttribute(
        "data-block-id",
        slides,
      );
      await expect(page.locator(".block-viewport")).not.toHaveClass(
        /is-navigating/,
      );
      const frames = await page.evaluate(
        () => (window as any).blockFrames as number[],
      );
      const low = Math.min(...frames),
        high = Math.max(...frames);
      expect(high - low).toBeGreaterThan(100);
      expect(
        new Set(
          frames.filter((y) => y > low + 2 && y < high - 2).map(Math.round),
        ).size,
      ).toBeGreaterThan(3);

      // A new destination during motion must win and retain the original editor.
      await page
        .getByRole("button", { name: "Go to sheet block: Budget", exact: true })
        .click();
      await page.waitForTimeout(65);
      await page
        .getByRole("button", {
          name: "Go to doc block: Project notes",
          exact: true,
        })
        .click();
      await expect(page.locator(".block-viewport")).not.toHaveClass(
        /is-navigating/,
      );
      await expect(page.locator(".office-block.is-active")).toHaveAttribute(
        "data-block-id",
        note,
      );
      expect(
        await page.evaluate(
          (id) =>
            (window as any).originalNote ===
            document.querySelector(`[data-block-id="${id}"] .prose`),
          note,
        ),
      ).toBe(true);
      await expect(
        page.getByLabel("Document text", { exact: true }),
      ).toHaveText("Shared note content");
      await assertBoundaryGap(page, "previous");
      expect(
        await page.locator(".block-viewport").evaluate((el) => el.scrollTop),
      ).toBe(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page
        .getByRole("button", { name: "Go to sheet block: Budget", exact: true })
        .click();
      await expect(page.locator(".block-viewport")).not.toHaveClass(
        /is-navigating/,
      );
      await expect(page.locator(".office-block.is-active")).toHaveAttribute(
        "data-block-id",
        sheet,
      );
      await selectCell(page, "A1");
      await expect(
        page.getByLabel("Selected cell result", { exact: true }),
      ).toHaveText("A1: 42");
      await expect(
        page.getByRole("button", { name: "Add block at end", exact: true }),
      ).toBeInViewport();
      await assertBoundaryGap(page, "next");
    } finally {
      await context.close();
      await request.delete(`/api/documents/${documentID}`);
    }
  });
