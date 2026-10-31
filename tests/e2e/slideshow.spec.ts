import { test, expect, type Page } from "@playwright/test";
import { newBlock, newDocument } from "./office-fixtures";

async function present(page: Page) {
  await page.locator(".office-block.is-active .block-title").click();
  await page
    .getByRole("button", { name: "Present slides", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Presentation", exact: true }),
  ).toBeVisible();
}
async function geometry(page: Page, selector: string) {
  return page
    .locator(".slide-card.current .slide-page")
    .evaluate((stage, selector) => {
      const element = stage.querySelector<HTMLElement>(selector)!;
      const bounds = stage.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      const scale = bounds.width / 1280;
      const style = getComputedStyle(element);
      return {
        ratio: bounds.width / bounds.height,
        font: style.fontSize,
        lineHeight: style.lineHeight,
        width: rect.width / scale,
        height: rect.height / scale,
        x: (rect.x - bounds.x) / scale,
        y: (rect.y - bounds.y) / scale,
        scrollHeight: element.scrollHeight,
      };
    }, selector);
}
function sameGeometry(
  before: Awaited<ReturnType<typeof geometry>>,
  after: Awaited<ReturnType<typeof geometry>>,
) {
  expect(after.ratio).toBeCloseTo(16 / 9, 3);
  expect(after.font).toBe(before.font);
  expect(after.lineHeight).toBe(before.lineHeight);
  for (const key of ["x", "y", "width", "height", "scrollHeight"] as const)
    expect(after[key]).toBeCloseTo(before[key], 1);
}
for (const viewport of [
  { width: 1600, height: 1000 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`slide geometry and mounted editors match the slideshow at ${viewport.width}px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const id = await newDocument(page, request, `WYSIWYG ${Date.now()}`);
    try {
      await newBlock(page, "Slides", "Product story");
      const title = page.getByLabel("Slide title", { exact: true });
      await title.fill(
        "A clear story, from the first draft to the final delivery",
      );
      await page
        .getByLabel("Slide subtitle", { exact: true })
        .fill("The same composition, on every screen.");
      await expect(page.locator(".block-viewport")).not.toHaveClass(
        /is-navigating/,
      );
      const before = await geometry(page, ".title-slide-title");
      await title.evaluate((el) => ((window as any).slideTitleNode = el));
      await page.screenshot({
        path: `test-results/slides-editor-${viewport.width}.png`,
      });
      await present(page);
      sameGeometry(before, await geometry(page, ".title-slide-title"));
      expect(
        await title.evaluate((el) => (window as any).slideTitleNode === el),
      ).toBe(true);
      await expect(title).toHaveAttribute("readonly", "");
      await page.screenshot({
        path: `test-results/slides-presentation-${viewport.width}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "Presentation", exact: true }),
      ).toHaveCount(0);
      await expect(title).not.toHaveAttribute("readonly");
      await page
        .getByRole("button", { name: "Add content slide", exact: true })
        .click();
      const note = page.getByLabel("Slide note", { exact: true });
      await note.fill(
        "A rich-text paragraph that wraps onto several lines without changing its size or position when the slideshow starts. This text stays editable after the show ends.",
      );
      await note.evaluate((el) => ((window as any).slideNoteNode = el));
      const noteBefore = await geometry(page, ".prose p");
      await present(page);
      sameGeometry(noteBefore, await geometry(page, ".prose p"));
      expect(
        await note.evaluate((el) => (window as any).slideNoteNode === el),
      ).toBe(true);
      await expect(note).toHaveAttribute("contenteditable", "false");
      await page.keyboard.press("Escape");
      await expect(note).toHaveAttribute("contenteditable", "true");
      await note.press("End");
      await note.pressSequentially(" Still editable.");
      await expect(note).toContainText("Still editable.");
      await page.getByRole("button", { name: "Canvas", exact: true }).click();
      const canvas = page.locator(".slide-card.current .drawing-surface");
      await canvas.focus();
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      const view = await canvas.getAttribute("viewBox");
      await canvas.evaluate((el) => ((window as any).slideCanvasNode = el));
      await present(page);
      await expect(canvas).toHaveAttribute("viewBox", view!);
      expect(
        await canvas.evaluate((el) => (window as any).slideCanvasNode === el),
      ).toBe(true);
      await page.keyboard.press("b");
      await expect(
        page.getByRole("button", { name: "Blank screen", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("b");
      await page.keyboard.press("Home");
      await expect(page.locator(".presentation-count")).toHaveText("1 / 2");
      await page.keyboard.press("Space");
      await expect(page.locator(".presentation-count")).toHaveText("2 / 2");
      await expect(
        page.getByRole("progressbar", { name: "Slideshow progress" }),
      ).toHaveAttribute("aria-valuenow", "2");
      await page.keyboard.press("PageUp");
      await expect(page.locator(".presentation-count")).toHaveText("1 / 2");
      await page.keyboard.press("End");
      await expect(page.locator(".presentation-count")).toHaveText("2 / 2");
      await page
        .getByRole("button", { name: "Exit presentation", exact: true })
        .click();
      await expect(page.locator(".presentation")).toHaveCount(0);
      await expect(canvas).toHaveAttribute("viewBox", view!);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      expect(errors).toEqual([]);
    } finally {
      await request.delete(`/api/documents/${id}`);
    }
  });
}

test("presentation fullscreen, focus trapping, and browser fallback", async ({
  page,
  request,
}) => {
  const id = await newDocument(
    page,
    request,
    `Slideshow controls ${Date.now()}`,
  );
  try {
    await newBlock(page, "Slides", "Control checks");
    await present(page);
    const dialog = page.getByRole("dialog", {
      name: "Presentation",
      exact: true,
    });
    expect(
      await page.locator(".topbar").evaluate((el) => !!el.closest("[inert]")),
    ).toBe(true);
    const exit = dialog.getByRole("button", {
      name: "Exit presentation",
      exact: true,
    });
    await expect(exit).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    const fullscreen = dialog.getByRole("button", {
      name: "Fullscreen presentation",
      exact: true,
    });
    await expect(fullscreen).toBeFocused();
    await fullscreen.click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          document.fullscreenElement?.classList.contains("presentation"),
        ),
      )
      .toBe(true);
    await exit.click();
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === null))
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Present slides", exact: true }),
    ).toBeFocused();
    await page.addInitScript(() =>
      Object.defineProperty(document, "fullscreenEnabled", { value: false }),
    );
    await page.reload();
    await present(page);
    await expect(
      page.getByRole("button", {
        name: "Fullscreen presentation",
        exact: true,
      }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.locator(".presentation")).toHaveCount(0);
  } finally {
    await request.delete(`/api/documents/${id}`);
  }
});

test("scaled slide commands stay unscaled, and presenting inside editor fullscreen preserves that session", async ({
  page,
  request,
}) => {
  const id = await newDocument(
    page,
    request,
    `Scaled slide commands ${Date.now()}`,
  );
  try {
    await newBlock(page, "Slides", "Linked story");
    await page
      .getByRole("button", { name: "Add content slide", exact: true })
      .click();
    const note = page.getByLabel("Slide note", { exact: true });
    await note.fill("/link");
    const commands = page.getByRole("dialog", {
      name: "Slash commands",
      exact: true,
    });
    await expect(commands).toBeVisible();
    const bounds = (await commands.boundingBox())!;
    expect(bounds.width).toBeCloseTo(360);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(
      await page.evaluate(() => innerWidth),
    );
    expect(await commands.evaluate((el) => !!el.closest(".slide-page"))).toBe(
      false,
    );
    await note.press("Enter");
    await expect(
      page.getByLabel("Search link targets", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await note.fill("Links are usable while composing the slide.");
    await page.locator(".office-block.is-active .block-title").click();
    await page
      .getByRole("button", { name: "Fullscreen slides", exact: true })
      .click();
    await expect(
      page.locator(".slides-editor.editor-fullscreen"),
    ).toBeVisible();
    const fullscreenGeometry = await geometry(page, ".prose p");
    await expect(page.locator(".slide-page .editor-tools")).toHaveCount(0);
    const host = await page.evaluate(
      () => document.fullscreenElement?.className ?? "fallback",
    );
    await page
      .getByRole("button", { name: "Present slides", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Presentation", exact: true }),
    ).toBeVisible();
    sameGeometry(fullscreenGeometry, await geometry(page, ".prose p"));
    await page.keyboard.press("Escape");
    await expect(page.locator(".presentation")).toHaveCount(0);
    await expect(
      page.locator(".slides-editor.editor-fullscreen"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.fullscreenElement?.className ?? "fallback",
      ),
    ).toBe(host);
    await note.fill("/link");
    await note.press("Enter");
    await expect(
      page.getByLabel("Search link targets", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.locator(".slides-editor.editor-fullscreen"),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
  } finally {
    await request.delete(`/api/documents/${id}`);
  }
});
