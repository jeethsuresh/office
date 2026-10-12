import { test, expect, type Locator, type Page } from "@playwright/test";

async function atCenter(page: Page, locator: Locator) {
  const bounds = (await locator.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
}
async function assertPinned(page: Page, kind: string) {
  await expect(page.locator(".office-block.is-active")).toHaveClass(
    new RegExp(`block-${kind}`),
  );
  expect(
    await page.locator(".block-viewport").evaluate((el) => el.scrollTop),
  ).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(
    page.locator(".office-block.is-active .block-navigation-pill").first(),
  ).toBeInViewport();
  await expect(
    page.locator(".office-block.is-active .block-navigation-pill").last(),
  ).toBeInViewport();
}
async function assertFullscreen(page: Page, selector: string) {
  const root = page.locator(`${selector}.editor-fullscreen`);
  await expect(root).toBeVisible();
  const bounds = (await root.boundingBox())!;
  const screen = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
  }));
  expect(bounds.x).toBeCloseTo(0);
  expect(bounds.y).toBeCloseTo(0);
  expect(bounds.width).toBeCloseTo(screen.width);
  expect(bounds.height).toBeCloseTo(screen.height);
  const exit = root.getByRole("button", {
    name: "Exit fullscreen",
    exact: true,
  });
  const x = (await exit.boundingBox())!;
  expect(x.y + x.height).toBeGreaterThan(screen.height - 35);
  // The sidebar and map cannot steal keyboard focus behind a focused editor.
  expect(
    await page
      .locator(".document-view > .minimap")
      .evaluate((el) => !!el.closest("[inert]")),
  ).toBe(true);
  return root;
}

test("wheel, keyboard and touch stay inside editors; explicit navigation selects blocks/slides", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("All changes saved")).toBeVisible();
  await atCenter(page, page.locator(".block-heading").first());
  await page.mouse.wheel(0, 1600);
  await page.keyboard.press("PageDown");
  await assertPinned(page, "doc");
  await page.locator(".office-block.is-active .block-peek.next").click();
  await assertPinned(page, "canvas");
  const canvas = page.locator(".block-canvas .drawing-surface");
  const before = await canvas.getAttribute("viewBox");
  await atCenter(page, canvas);
  await page.mouse.wheel(190, 730);
  await expect(canvas).not.toHaveAttribute("viewBox", before!);
  await canvas.focus();
  await page.keyboard.press("PageDown");
  await page.keyboard.press("End");
  await assertPinned(page, "canvas");
  const width = Number((await canvas.getAttribute("viewBox"))!.split(" ")[2]);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  await expect
    .poll(async () =>
      Number((await canvas.getAttribute("viewBox"))!.split(" ")[2]),
    )
    .toBeLessThan(width);
  await assertPinned(page, "canvas");
  const panned = await canvas.getAttribute("viewBox");
  await page.getByRole("button", { name: "Map: slide 2", exact: true }).click();
  await assertPinned(page, "slides");
  const current = page.locator(".slide-card.current");
  const slideID = await current.getAttribute("data-slide-id");
  await atCenter(page, current);
  await page.mouse.wheel(0, 1400);
  await page.getByLabel("Slide note", { exact: true }).press("PageDown");
  await expect(current).toHaveAttribute("data-slide-id", slideID!);
  await assertPinned(page, "slides");
  await page
    .getByRole("button", { name: "Previous carousel slide", exact: true })
    .click();
  await expect(page.locator(".slide-card.current .title-slide")).toBeVisible();
  await page.getByRole("button", { name: /Go to canvas block/ }).click();
  await expect(canvas).toHaveAttribute("viewBox", panned!);
  await page.locator(".office-block.is-active .block-peek.previous").click();
  await assertPinned(page, "doc");
  // Long notes scroll within the note, without navigating the document.
  await page
    .getByLabel("Document text", { exact: true })
    .fill(Array.from({ length: 70 }, (_, i) => `Line ${i + 1}`).join("\n"));
  await page.locator(".block-doc .doc-paper").evaluate((el) => {
    el.scrollTop = 0;
  });
  await atCenter(page, page.locator(".block-doc .doc-paper"));
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() =>
      page.locator(".block-doc .doc-paper").evaluate((el) => el.scrollTop),
    )
    .toBeGreaterThan(0);
  await assertPinned(page, "doc");
});

test("fullscreen keeps mounted note/canvas state, supports slide/deck/content, X and Escape", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("All changes saved")).toBeVisible();
  const note = page.getByLabel("Document text", { exact: true });
  await note.fill("A focused thought.");
  await note.evaluate((el) => {
    (window as any).originalEditor = el;
  });
  await page
    .getByRole("button", { name: "Fullscreen note", exact: true })
    .click();
  await assertFullscreen(page, ".doc-editor");
  await note.press("ControlOrMeta+End");
  await note.pressSequentially(" Still collaborative.");
  await page.keyboard.press("Escape");
  await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
  expect(
    await note.evaluate((el) => el === (window as any).originalEditor),
  ).toBe(true);
  await expect(note).toContainText("Still collaborative.");
  await assertPinned(page, "doc");
  await page.getByRole("button", { name: /Go to canvas block/ }).click();
  const canvas = page.locator(".block-canvas .drawing-surface");
  await page
    .getByRole("button", { name: "Fullscreen canvas", exact: true })
    .click();
  await assertFullscreen(page, ".canvas-editor");
  await atCenter(page, canvas);
  await page.mouse.wheel(150, 260);
  const position = await canvas.getAttribute("viewBox");
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
  await expect(canvas).toHaveAttribute("viewBox", position!);
  await assertPinned(page, "canvas");
  await page.getByRole("button", { name: "Map: slide 2", exact: true }).click();
  await page
    .getByRole("button", { name: "Fullscreen slide note", exact: true })
    .click();
  await assertFullscreen(page, ".doc-editor.compact");
  await page
    .getByLabel("Slide note", { exact: true })
    .fill("Full-size slide writing.");
  // Escape dismisses the nested dialog before exiting fullscreen.
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".editor-fullscreen")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
  await expect(page.getByLabel("Slide note", { exact: true })).toContainText(
    "Full-size slide writing.",
  );
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await page
    .getByRole("button", { name: "Fullscreen slide canvas", exact: true })
    .click();
  await assertFullscreen(page, ".canvas-editor.compact");
  await page.keyboard.press("Escape");
  await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await page
    .getByRole("button", { name: "Fullscreen slide 2", exact: true })
    .click();
  await assertFullscreen(page, ".slide-card");
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Fullscreen slides", exact: true })
    .click();
  await assertFullscreen(page, ".slides-editor");
  await page
    .getByRole("button", { name: "Expand fullscreen map", exact: true })
    .hover();
  await page
    .getByRole("complementary", {
      name: "Fullscreen document minimap",
      exact: true,
    })
    .getByRole("button", { name: "Map: slide 1", exact: true })
    .click();
  await page.mouse.move(400, 100);
  await expect(page.locator(".slide-card.current .title-slide")).toBeVisible();
  await page
    .getByLabel("Slide title", { exact: true })
    .first()
    .fill("Focused slide title");
  await page
    .getByRole("button", { name: "Exit fullscreen", exact: true })
    .click();
  await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
  await expect(page.locator(".slide-card.current .title-slide")).toBeVisible();
  await expect(
    page.getByLabel("Slide title", { exact: true }).first(),
  ).toHaveValue("Focused slide title");
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1400, height: 1000 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`slide editor fills its panel and aligns text at ${viewport.width}×${viewport.height}, with mobile fullscreen fallback`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    // Exercise a browser without the native API (e.g. mobile Safari).
    await page.addInitScript(() => {
      Object.defineProperty(document, "fullscreenEnabled", { value: false });
    });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Map: slide 2", exact: true })
      .click();
    const note = page.getByLabel("Slide note", { exact: true });
    await note.fill("sadf");
    const editor = page.locator(".slide-content-body .doc-editor");
    const layout = await editor.evaluate((el) => {
      const panel = el.getBoundingClientRect();
      const tools = el.querySelector(".editor-tools")!.getBoundingClientRect();
      const paper = el.querySelector(".doc-paper")!.getBoundingClientRect();
      const prose = el.querySelector(".prose")!.getBoundingClientRect();
      const paragraph = el.querySelector(".prose p")!.getBoundingClientRect();
      return {
        panel: panel.toJSON(),
        tools: tools.toJSON(),
        paper: paper.toJSON(),
        prose: prose.toJSON(),
        paragraph: paragraph.toJSON(),
      };
    });
    expect(layout.tools.height).toBeCloseTo(layout.panel.height);
    expect(layout.paper.height).toBeCloseTo(layout.panel.height);
    expect(layout.paragraph.top).toBeCloseTo(layout.prose.top);
    expect(layout.paragraph.left).toBeCloseTo(layout.prose.left);
    expect(layout.prose.width).toBeGreaterThan(90);
    await assertPinned(page, "slides");
    await page
      .getByRole("button", { name: "Fullscreen slide note", exact: true })
      .click();
    await assertFullscreen(page, ".doc-editor.compact");
    await page
      .getByLabel("Slide note", { exact: true })
      .press("ControlOrMeta+End");
    await page
      .getByLabel("Slide note", { exact: true })
      .pressSequentially(" stays here");
    await page
      .getByRole("button", { name: "Exit fullscreen", exact: true })
      .click();
    await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
    await expect(note).toContainText("stays here");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await page.screenshot({
      path: `test-results/slide-${viewport.width}x${viewport.height}.png`,
    });
  });
}

test("mobile vertical swipes stay captured, horizontal swipes snap slides, and touch pans the canvas", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  try {
    await page.goto(baseURL!);
    await expect(page.getByText("All changes saved")).toBeVisible();
    const header = (await page
      .locator(".office-block.is-active .block-heading")
      .boundingBox())!;
    await client.send("Input.synthesizeScrollGesture", {
      x: header.x + header.width / 2,
      y: header.y + header.height / 2,
      yDistance: -350,
      gestureSourceType: "touch",
    });
    await assertPinned(page, "doc");
    await page.getByRole("button", { name: /Go to canvas block/ }).tap();
    await page.getByRole("button", { name: "Pan (H)", exact: true }).tap();
    const canvas = page.locator(".block-canvas .drawing-surface");
    const box = (await canvas.boundingBox())!;
    const before = await canvas.getAttribute("viewBox");
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 50, y: y - 60 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(canvas).not.toHaveAttribute("viewBox", before!);
    await assertPinned(page, "canvas");
    await page.getByRole("button", { name: "Map: slide 2", exact: true }).tap();
    await expect(page.locator(".slide-card").nth(1)).toHaveClass(/current/);
    const id = await page
      .locator(".slide-card.current")
      .getAttribute("data-slide-id");
    const track = (await page.locator(".slide-track").boundingBox())!;
    await client.send("Input.synthesizeScrollGesture", {
      x: track.x + track.width / 2,
      y: track.y + 20,
      xDistance: 200,
      gestureSourceType: "touch",
    });
    await expect(page.locator(".slide-card.current")).not.toHaveAttribute(
      "data-slide-id",
      id!,
    );
    await expect(page.locator(".slide-card").first()).toHaveClass(/current/);
    await expect
      .poll(() => page.locator(".slide-track").evaluate((el) => el.scrollLeft))
      .toBeLessThan(1);
    await assertPinned(page, "slides");
  } finally {
    await context.close();
  }
});

for (const viewport of [
  { width: 1400, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`minimap fills its available height and reveals unabridged titles at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByText("All changes saved")).toBeVisible();
    const title =
      "A long block title that must remain fully readable, including this final phrase";
    await page.locator(".office-block.is-active .block-title").fill(title);
    const map = page.getByRole("complementary", {
      name: "Document minimap",
      exact: true,
    });
    const layout = await map.evaluate((el) => {
      const track = el.querySelector(".minimap-track")!;
      const markers = [...track.querySelectorAll(".minimap-segment")];
      const bounds = track.getBoundingClientRect();
      return {
        height: bounds.height,
        top: markers[0].getBoundingClientRect().top - bounds.top,
        bottom: bounds.bottom - markers.at(-1)!.getBoundingClientRect().bottom,
      };
    });
    expect(layout.height).toBeGreaterThan(viewport.height * 0.6);
    expect(layout.top).toBeLessThan(6);
    expect(layout.bottom).toBeLessThan(6);
    await map
      .getByRole("button", { name: `Go to doc block: ${title}`, exact: true })
      .hover();
    await expect(map.getByRole("tooltip")).toContainText(title);
    const tooltip = (await map.getByRole("tooltip").boundingBox())!;
    expect(tooltip.x).toBeGreaterThanOrEqual(0);
    expect(tooltip.x + tooltip.width).toBeLessThanOrEqual(viewport.width);
  });
}

async function expectSlideSnap(page: Page, index: number) {
  await expect(page.locator(".slide-card").nth(index)).toHaveClass(/current/);
  await expect
    .poll(() =>
      page.locator(".slide-track").evaluate((el, index) => {
        const card = el.querySelectorAll<HTMLElement>(".slide-card")[index];
        return Math.abs(
          el.scrollLeft -
            card.offsetLeft +
            parseFloat(getComputedStyle(el).paddingLeft),
        );
      }, index),
    )
    .toBeLessThan(2);
}

test("horizontal wheel scrolling snaps slides in both directions and fullscreen, while embedded canvas keeps its gestures", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Map: slide 1", exact: true }).click();
  const track = page.locator(".slide-track");
  await atCenter(page, track);
  await page.mouse.wheel(550, 0);
  await expectSlideSnap(page, 1);
  await assertPinned(page, "slides");
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  const canvas = page.locator(".slide-card.current .drawing-surface");
  const before = await canvas.getAttribute("viewBox");
  await atCenter(page, canvas);
  await page.mouse.wheel(-550, 0);
  await expect(canvas).not.toHaveAttribute("viewBox", before!);
  await expectSlideSnap(page, 1);
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await atCenter(page, page.locator(".slide-card.current .doc-paper"));
  await page.mouse.wheel(-550, 0);
  await expectSlideSnap(page, 0);
  await page
    .getByRole("button", { name: "Fullscreen slides", exact: true })
    .click();
  await atCenter(page, track);
  await page.mouse.wheel(650, 0);
  await expectSlideSnap(page, 1);
  await assertFullscreen(page, ".slides-editor");
  await page.keyboard.press("Escape");
  await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
  await expectSlideSnap(page, 1);
});

test("fullscreen map expands over controls and navigates blocks and slides within one native fullscreen session", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const note = page.getByLabel("Document text", { exact: true });
  await note.fill("Retain this editor while navigating in fullscreen.");
  await note.evaluate((el) => {
    (window as any).originalNote = el;
  });
  await page.evaluate(() => {
    (window as any).mapEntry = new Promise<void>((resolve) => {
      const entered = () => {
        if (document.fullscreenElement?.classList.contains("fullscreen-host")) {
          document.removeEventListener("fullscreenchange", entered);
          resolve();
        }
      };
      document.addEventListener("fullscreenchange", entered);
    });
  });
  await page
    .getByRole("button", { name: "Fullscreen note", exact: true })
    .click();
  await page.evaluate(() => (window as any).mapEntry);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fullscreenElement?.classList.contains("fullscreen-host"),
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    (window as any).fullscreenHost = document.fullscreenElement;
    (window as any).fullscreenChanges = 0;
    document.addEventListener(
      "fullscreenchange",
      () => (window as any).fullscreenChanges++,
    );
  });
  const compact = page.getByRole("button", {
    name: "Expand fullscreen map",
    exact: true,
  });
  await expect(compact).toBeVisible();
  expect((await compact.boundingBox())!.height).toBeLessThan(40);
  const previews = page.locator(".fullscreen-map-preview");
  await expect(previews).toHaveCount(3);
  await expect(previews.nth(0)).toHaveClass(/empty/);
  await expect(previews.nth(1)).toHaveClass(/current/);
  // Hover expansion must not replace the click target with a slide marker.
  await compact.click();
  await expect(
    page.locator(".doc-editor:not(.compact).editor-fullscreen"),
  ).toBeVisible();
  await page.mouse.move(400, 100);
  await page.locator(".fullscreen-navigator").hover();
  const map = page.getByRole("complementary", {
    name: "Fullscreen document minimap",
    exact: true,
  });
  await expect(map).toBeVisible();
  await expect(
    page.locator(".editor-fullscreen > .editor-tools > .tool-list"),
  ).toBeHidden();
  await map.getByRole("button", { name: /Go to canvas block/ }).click();
  await assertFullscreen(page, ".canvas-editor");
  await page.locator(".fullscreen-navigator").hover();
  await map.getByRole("button", { name: /Go to slides block/ }).click();
  await assertFullscreen(page, ".slides-editor");
  await page.locator(".fullscreen-navigator").hover();
  await map.getByRole("button", { name: "Map: slide 2", exact: true }).click();
  await expectSlideSnap(page, 1);
  await expect(
    map.getByRole("button", { name: "Map: slide 2", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    map.getByRole("button", { name: "Map: slide 2", exact: true }),
  ).toBeFocused();
  await page.mouse.move(400, 100);
  await expect(compact).toBeVisible();
  await expect(page.locator(".fullscreen-map-preview.current")).toHaveText("2");
  await compact.focus();
  await page.keyboard.press("Enter");
  await expect(map).toBeVisible();
  await map.getByRole("button", { name: /Go to doc block/ }).click();
  await assertFullscreen(page, ".doc-editor:not(.compact)");
  expect(await note.evaluate((el) => el === (window as any).originalNote)).toBe(
    true,
  );
  await expect(note).toContainText("Retain this editor");
  expect(
    await page.evaluate(
      () => document.fullscreenElement === (window as any).fullscreenHost,
    ),
  ).toBe(true);
  expect(await page.evaluate(() => (window as any).fullscreenChanges)).toBe(0);
  await page.screenshot({ path: "test-results/fullscreen-map.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === null))
    .toBe(true);
  expect(errors).toEqual([]);
});

test("mobile fullscreen navigator opens by tap and moves between individually focused slides and embedded editors", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.addInitScript(() =>
      Object.defineProperty(document, "fullscreenEnabled", { value: false }),
    );
    await page.goto(baseURL!);
    await page.getByRole("button", { name: "Map: slide 2", exact: true }).tap();
    await page
      .getByRole("button", { name: "Fullscreen slide note", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Expand fullscreen map", exact: true })
      .tap();
    const map = page.getByRole("complementary", {
      name: "Fullscreen document minimap",
      exact: true,
    });
    await expect(map).toBeVisible();
    await map.getByRole("button", { name: "Map: slide 1", exact: true }).tap();
    await assertFullscreen(page, ".slide-card");
    await expect(
      page.locator(".slide-card.editor-fullscreen .title-slide"),
    ).toBeVisible();
    await map.getByRole("button", { name: "Map: slide 2", exact: true }).tap();
    await assertFullscreen(page, ".slide-card");
    await map.getByRole("button", { name: /Go to canvas block/ }).tap();
    await assertFullscreen(page, ".canvas-editor:not(.compact)");
    await page
      .getByRole("button", { name: "Collapse fullscreen map", exact: true })
      .tap();
    await expect(
      page.getByRole("button", { name: "Expand fullscreen map", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(
        ".canvas-editor.editor-fullscreen > .editor-tools > .tool-list",
      ),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/fullscreen-mobile.png" });
    await page
      .getByRole("button", { name: "Exit fullscreen", exact: true })
      .tap();
    await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
    await assertPinned(page, "canvas");
  } finally {
    await context.close();
  }
});
