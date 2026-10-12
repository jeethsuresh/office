import {
  test,
  expect,
  type Page,
  type Locator,
  type APIRequestContext,
} from "@playwright/test";

const mapFor = (page: Page, fullscreen = false) =>
  page.getByRole("complementary", {
    name: fullscreen ? "Fullscreen document minimap" : "Document minimap",
    exact: true,
  });
async function createDocument(
  page: Page,
  request: APIRequestContext,
  kinds: string[],
) {
  const response = await request.post("/api/documents", {
    data: { name: `Navigation gestures ${Date.now()}`, folderId: "" },
  });
  expect(response.ok()).toBe(true);
  const doc = await response.json();
  await page.goto(`/#document=${doc.id}`);
  for (const [index, kind] of kinds.entries()) {
    await page
      .getByRole("button", {
        name: index ? "Add block from map" : "Add your first block",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp(kind) })
      .click();
    await expect(page.locator(".office-block.is-active")).toHaveClass(
      new RegExp(`block-${kind.toLowerCase()}`),
    );
    await page
      .locator(".office-block.is-active .block-title")
      .fill(
        kind === "Doc" ? "A note" : kind === "Canvas" ? "A drawing" : "A story",
      );
  }
  await expect(page.getByText("All changes saved")).toBeVisible();
  return doc.id as string;
}
async function dragTitle(
  page: Page,
  source: Locator,
  target: Locator,
  finish = true,
) {
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 2, {
    steps: 12,
  });
  if (finish) await page.mouse.up();
}
async function aligned(page: Page, index: number) {
  await expect(page.locator(".slide-card").nth(index)).toHaveClass(/current/);
  await expect
    .poll(() =>
      page.locator(".slide-track").evaluate((element, index) => {
        const card =
          element.querySelectorAll<HTMLElement>(".slide-card")[index];
        return Math.abs(
          element.scrollLeft -
            card.offsetLeft +
            parseFloat(getComputedStyle(element).paddingLeft),
        );
      }, index),
    )
    .toBeLessThan(2);
}

test("dragging minimap titles retains live editors, shares order, inserts at gaps, and works in fullscreen", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const id = await createDocument(page, request, ["Doc", "Canvas", "Slides"]);
  const peerContext = await browser.newContext({
    baseURL,
    viewport: { width: 1600, height: 1000 },
  });
  const peer = await peerContext.newPage();
  try {
    const map = mapFor(page);
    await map
      .getByRole("button", { name: "Go to doc block: A note", exact: true })
      .click();
    await page
      .getByLabel("Document text", { exact: true })
      .fill("Keep this editor.");
    await peer.goto(`/#document=${id}`);
    await expect(
      peer.getByLabel("Document text", { exact: true }),
    ).toContainText("Keep this editor.");
    await page.evaluate(() => {
      (window as any).originalEditor = document.querySelector(
        ".block-doc .doc-editor",
      );
    });
    await dragTitle(
      page,
      map.locator(".minimap-title").first(),
      map.locator(".minimap-segment").last(),
      false,
    );
    await expect(map).toHaveClass(/is-dragging/);
    await peer
      .getByLabel("Document text", { exact: true })
      .fill("A live edit during the drag.");
    await expect(
      page.getByLabel("Document text", { exact: true }),
    ).toContainText("A live edit during the drag.");
    await page.mouse.up();
    await expect(map.locator(".minimap-title")).toHaveText([
      "A drawing",
      "A story",
      "A note",
    ]);
    await expect(mapFor(peer).locator(".minimap-title")).toHaveText([
      "A drawing",
      "A story",
      "A note",
    ]);
    expect(
      await page.evaluate(
        () =>
          (window as any).originalEditor ===
          document.querySelector(".block-doc .doc-editor"),
      ),
    ).toBe(true);
    await expect(
      page.locator(".office-block.is-active .block-title"),
    ).toHaveValue("A note");
    await map
      .getByRole("button", {
        name: "Go to canvas block: A drawing",
        exact: true,
      })
      .hover();
    const tooltip = (await map.getByRole("tooltip").boundingBox())!;
    const bounds = (await map.boundingBox())!;
    expect(tooltip.x + tooltip.width).toBeLessThanOrEqual(bounds.x - 10);
    await page.screenshot({
      path: "test-results/minimap-adjacent-tooltip.png",
    });
    const gap = map.getByRole("button", {
      name: "Add block before A story",
      exact: true,
    });
    await gap.hover();
    await expect(gap.locator("span")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: "test-results/minimap-gap.png" });
    await gap.click();
    await expect(
      page.getByLabel("Block position", { exact: true }),
    ).toHaveValue("before");
    await page.getByRole("dialog").getByRole("button", { name: /Doc/ }).click();
    await expect(
      page.locator(".office-block.is-active .block-title"),
    ).toHaveValue("Untitled note");
    await page
      .locator(".office-block.is-active .block-title")
      .fill("Inserted at the gap");
    await expect(map.locator(".minimap-title")).toHaveText([
      "A drawing",
      "Inserted at the gap",
      "A story",
      "A note",
    ]);
    await expect(mapFor(peer).locator(".minimap-title")).toHaveText([
      "A drawing",
      "Inserted at the gap",
      "A story",
      "A note",
    ]);
    await map
      .getByRole("button", { name: "Undo block change", exact: true })
      .click();
    await expect(map.locator(".minimap-title")).toHaveText([
      "A drawing",
      "A story",
      "A note",
    ]);
    await map
      .getByRole("button", { name: "Undo block change", exact: true })
      .click();
    await expect(map.locator(".minimap-title")).toHaveText([
      "A note",
      "A drawing",
      "A story",
    ]);
    const note = map.getByRole("button", {
      name: "Go to doc block: A note",
      exact: true,
    });
    await note.focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(map.locator(".minimap-title")).toHaveText([
      "A drawing",
      "A note",
      "A story",
    ]);
    await page.reload();
    await expect(mapFor(page).locator(".minimap-title")).toHaveText([
      "A drawing",
      "A note",
      "A story",
    ]);
    await note.click();
    await expect(
      page.getByLabel("Document text", { exact: true }),
    ).toContainText("A live edit during the drag.");
    await page
      .getByRole("button", { name: "Fullscreen note", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Expand fullscreen map", exact: true })
      .hover();
    const full = mapFor(page, true);
    await dragTitle(
      page,
      full.locator(".minimap-title").nth(1),
      full.locator(".minimap-segment").last(),
      false,
    );
    await expect(full).toHaveClass(/is-dragging/);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator(".doc-editor.editor-fullscreen")).toBeVisible();
    await expect(full.locator(".minimap-title")).toHaveText([
      "A drawing",
      "A note",
      "A story",
    ]);
    await dragTitle(
      page,
      full.locator(".minimap-title").nth(1),
      full.locator(".minimap-segment").last(),
    );
    await expect(full.locator(".minimap-title")).toHaveText([
      "A drawing",
      "A story",
      "A note",
    ]);
    await expect(page.locator(".doc-editor.editor-fullscreen")).toBeVisible();
    await full
      .getByRole("button", { name: "Go to doc block: A note", exact: true })
      .focus();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(full.locator(".minimap-title")).toHaveText([
      "A drawing",
      "A note",
      "A story",
    ]);
    await full
      .getByRole("button", { name: "Go to doc block: A note", exact: true })
      .hover();
    const fullTip = (await full.getByRole("tooltip").boundingBox())!;
    const fullBounds = (await full.boundingBox())!;
    expect(fullTip.x).toBeGreaterThanOrEqual(
      fullBounds.x + fullBounds.width + 10,
    );
    await full
      .getByRole("button", { name: "Add block before A story", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".doc-editor.editor-fullscreen")).toBeVisible();
    await page
      .getByRole("button", { name: "Expand fullscreen map", exact: true })
      .hover();
    await full
      .getByRole("button", { name: "Add block before A story", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Canvas/ })
      .click();
    await expect(
      page.locator(".canvas-editor.editor-fullscreen"),
    ).toBeVisible();
    await expect(mapFor(peer).locator(".minimap-title")).toHaveText([
      "A drawing",
      "A note",
      "Untitled canvas",
      "A story",
    ]);
    await page.screenshot({
      path: "test-results/minimap-insertion-fullscreen.png",
    });
    await page.keyboard.press("Escape");
    await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
  } finally {
    await peerContext.close();
    await request.delete(`/api/documents/${id}`);
  }
});

test("mobile touch drags a block number and exposes gap insertion", async ({
  browser,
  request,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const id = await createDocument(page, request, ["Doc", "Canvas", "Slides"]);
  try {
    const map = mapFor(page);
    const first = (await map.locator(".minimap-number").first().boundingBox())!;
    const last = (await map.locator(".minimap-segment").last().boundingBox())!;
    const client = await context.newCDPSession(page);
    const x = first.x + first.width / 2;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: first.y + first.height / 2 }],
    });
    for (let step = 1; step <= 10; step++)
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x,
            y:
              first.y +
              first.height / 2 +
              ((last.y + last.height - 2 - (first.y + first.height / 2)) *
                step) /
                10,
          },
        ],
      });
    await expect(map).toHaveClass(/is-dragging/);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(map.locator(".minimap-title")).toHaveText([
      "A drawing",
      "A story",
      "A note",
    ]);
    const gap = map.getByRole("button", {
      name: "Add block before A story",
      exact: true,
    });
    await expect(gap.locator("span")).toHaveCSS("opacity", "0.8");
    await gap.tap();
    await page.getByRole("dialog").getByRole("button", { name: /Doc/ }).tap();
    await expect(map.locator(".minimap-title")).toHaveText([
      "A drawing",
      "Untitled note",
      "A story",
      "A note",
    ]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    await page.screenshot({
      path: "test-results/minimap-insertion-mobile.png",
    });
  } finally {
    await context.close();
    await request.delete(`/api/documents/${id}`);
  }
});

for (const mobile of [false, true])
  test(`slide additions animate and carousel controls navigate at ${mobile ? "mobile" : "desktop"} size`, async ({
    browser,
    request,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1400, height: 1000 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    const page = await context.newPage();
    const id = await createDocument(page, request, ["Slides"]);
    try {
      await page.evaluate(() => {
        const track = document.querySelector(".slide-track")!;
        (window as any).scrollFrames = [];
        track.addEventListener("scroll", () =>
          (window as any).scrollFrames.push(track.scrollLeft),
        );
      });
      await page
        .getByRole("button", { name: "Add title slide", exact: true })
        .click();
      await aligned(page, 1);
      const frames = await page.evaluate(
        () => (window as any).scrollFrames as number[],
      );
      const end = await page
        .locator(".slide-track")
        .evaluate((element) => element.scrollLeft);
      expect(
        new Set(frames.filter((position) => position > 2 && position < end - 2))
          .size,
      ).toBeGreaterThan(3);
      await page
        .getByRole("button", { name: "Add content slide", exact: true })
        .click();
      await aligned(page, 2);
      const carousel = page.getByRole("navigation", {
        name: "Slide carousel",
        exact: true,
      });
      await expect(
        carousel.getByRole("button", {
          name: "Next carousel slide",
          exact: true,
        }),
      ).toBeDisabled();
      await carousel
        .getByRole("button", { name: "Go to slide 1", exact: true })
        .click();
      await aligned(page, 0);
      await expect(
        carousel.getByRole("button", {
          name: "Previous carousel slide",
          exact: true,
        }),
      ).toBeDisabled();
      await carousel
        .getByRole("button", { name: "Next carousel slide", exact: true })
        .click();
      await aligned(page, 1);
      await carousel
        .getByRole("button", { name: "Go to slide 3", exact: true })
        .click();
      await aligned(page, 2);
      await carousel
        .getByRole("button", { name: "Previous carousel slide", exact: true })
        .click();
      await aligned(page, 1);
      await expect(
        carousel.getByRole("button", { name: "Go to slide 2", exact: true }),
      ).toHaveAttribute("aria-current", "true");
      await page.screenshot({
        path: `test-results/slide-carousel-${mobile ? "mobile" : "desktop"}.png`,
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page
        .getByRole("button", { name: "Add title slide", exact: true })
        .click();
      await aligned(page, 3);
      if (!mobile) {
        await page
          .getByRole("button", { name: "Fullscreen slides", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Add title slide", exact: true })
          .click();
        await aligned(page, 4);
        await expect(
          page.locator(".slides-editor.editor-fullscreen"),
        ).toBeVisible();
        await page.keyboard.press("Escape");
      }
    } finally {
      await context.close();
      await request.delete(`/api/documents/${id}`);
    }
  });
