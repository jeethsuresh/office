import {
  test,
  expect,
  type Page,
  type Locator,
  type APIRequestContext,
} from "@playwright/test";

async function createDeck(
  page: Page,
  request: APIRequestContext,
  count: number,
) {
  const response = await request.post("/api/documents", {
    data: { name: `Grouped map ${Date.now()}`, folderId: "" },
  });
  expect(response.ok()).toBe(true);
  const document = await response.json();
  await page.goto(`/#document=${document.id}`);
  await page
    .getByRole("button", { name: "Add your first block", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: /Doc/ }).click();
  for (const kind of ["Canvas", "Slides"]) {
    await page
      .getByRole("button", { name: "Add block from map", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp(kind) })
      .click();
  }
  await page
    .locator(".block-slides .block-title")
    .fill("A single connected story");
  await page
    .getByLabel("Slide title", { exact: true })
    .first()
    .fill("Chapter 1");
  for (let index = 1; index < count; index++) {
    await page
      .getByRole("button", { name: "Add title slide", exact: true })
      .click();
    await expect(page.locator(".slide-card").nth(index)).toHaveClass(/current/);
    await page
      .getByLabel("Slide title", { exact: true })
      .nth(index)
      .fill(`Chapter ${index + 1}`);
  }
  await expect(page.getByText("All changes saved")).toBeVisible();
  return document.id as string;
}
function mapFor(page: Page, fullscreen = false) {
  return page.getByRole("complementary", {
    name: fullscreen ? "Fullscreen document minimap" : "Document minimap",
    exact: true,
  });
}
async function visibleSlides(map: Locator) {
  return map.locator(".minimap-slides").evaluate((el) => {
    const viewport = el.getBoundingClientRect();
    return [...el.querySelectorAll<HTMLButtonElement>(".minimap-slide")]
      .filter((button) => {
        const bounds = button.getBoundingClientRect();
        return (
          bounds.top >= viewport.top - 1 && bounds.bottom <= viewport.bottom + 1
        );
      })
      .map((button) => Number(button.querySelector("span")?.textContent));
  });
}
async function centered(map: Locator, index: number) {
  const slide = map.getByRole("button", {
    name: `Map: slide ${index}`,
    exact: true,
  });
  await expect(slide).toHaveAttribute("aria-current", "true");
  await expect
    .poll(() =>
      map.locator(".minimap-slides").evaluate((el, index) => {
        const viewport = el.getBoundingClientRect();
        const bounds = el
          .querySelectorAll(".minimap-slide")
          [index - 1].getBoundingClientRect();
        return Math.abs(
          (viewport.top + viewport.bottom) / 2 -
            (bounds.top + bounds.bottom) / 2,
        );
      }, index),
    )
    .toBeLessThan(1);
}

test("up to five slide markers live inside one equally sized deck section", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const id = await createDeck(page, request, 5);
  try {
    const map = mapFor(page);
    await expect(map.locator(".minimap-track > .minimap-segment")).toHaveCount(
      3,
    );
    const grouped = await map.evaluate((el) => {
      const sections = [...el.querySelectorAll(".minimap-segment")].map(
        (section) => section.getBoundingClientRect(),
      );
      const deck = el.querySelector(".minimap-deck")!.getBoundingClientRect();
      return {
        heights: sections.map((section) => section.height),
        inside: [...el.querySelectorAll(".minimap-slide")].every((marker) => {
          const box = marker.getBoundingClientRect();
          return (
            box.top >= deck.top &&
            box.bottom <= deck.bottom &&
            box.left >= deck.left &&
            box.right <= deck.right
          );
        }),
      };
    });
    expect(grouped.inside).toBe(true);
    expect(grouped.heights[0]).toBeCloseTo(grouped.heights[2], 0);
    expect(grouped.heights[1]).toBeCloseTo(grouped.heights[2], 0);
    expect(await visibleSlides(map)).toEqual([1, 2, 3, 4, 5]);
    await expect(map.locator(".minimap-slides")).toHaveAttribute(
      "data-windowed",
      "false",
    );
    await map
      .getByRole("button", { name: "Map: slide 3", exact: true })
      .hover();
    await expect(map.getByRole("tooltip")).toContainText(
      "A single connected story · Slide 3: Chapter 3",
    );
    await page.screenshot({ path: "test-results/grouped-minimap.png" });
  } finally {
    await request.delete(`/api/documents/${id}`);
  }
});

test("long decks center five rows, browse on wheel/hover, and remain grouped in fullscreen", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const id = await createDeck(page, request, 12);
  try {
    const map = mapFor(page);
    await expect(map).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await centered(map, 12);
    expect(await visibleSlides(map)).toEqual([10, 11, 12]);
    // Explicit navigation must center the selected slide, including endpoints.
    for (let index = 0; index < 6; index++)
      await page
        .getByRole("button", { name: "Previous carousel slide", exact: true })
        .click();
    await centered(map, 6);
    expect(await visibleSlides(map)).toEqual([4, 5, 6, 7, 8]);
    const viewport = map.locator(".minimap-slides");
    await viewport.hover();
    await page.mouse.wheel(0, 140);
    await expect.poll(() => visibleSlides(map)).not.toEqual([4, 5, 6, 7, 8]);
    await expect(page.locator(".slide-card").nth(5)).toHaveClass(/current/);
    await page.mouse.move(600, 100);
    await centered(map, 6);
    const initial = await viewport.evaluate((el) => el.scrollTop);
    await viewport.hover();
    await map
      .getByRole("button", {
        name: "Later slides in A single connected story",
        exact: true,
      })
      .hover();
    await expect
      .poll(() => viewport.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(initial + 20);
    await page.mouse.move(600, 100);
    await centered(map, 6);
    await page
      .getByRole("button", { name: "Previous carousel slide", exact: true })
      .click();
    for (let index = 0; index < 4; index++)
      await page
        .getByRole("button", { name: "Previous carousel slide", exact: true })
        .click();
    await centered(map, 1);
    expect(await visibleSlides(map)).toEqual([1, 2, 3]);
    await page
      .getByRole("button", { name: "Fullscreen slides", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Expand fullscreen map", exact: true })
      .hover();
    const fullMap = mapFor(page, true);
    await expect(
      fullMap.locator(".minimap-track > .minimap-segment"),
    ).toHaveCount(3);
    await centered(fullMap, 1);
    await fullMap.locator(".minimap-slides").focus();
    await page.keyboard.press("End");
    await expect.poll(() => visibleSlides(fullMap)).toContain(12);
    await fullMap
      .getByRole("button", { name: "Map: slide 12", exact: true })
      .click();
    await centered(fullMap, 12);
    await expect(
      fullMap.getByRole("button", { name: "Map: slide 12", exact: true }),
    ).toBeFocused();
    await expect(
      page.locator(".slides-editor.editor-fullscreen"),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/grouped-fullscreen-map.png" });
    await page.keyboard.press("Escape");
    await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
    await centered(map, 12);
  } finally {
    await request.delete(`/api/documents/${id}`);
  }
});

test("mobile long-deck map scrolls by touch and navigates without leaving fullscreen", async ({
  browser,
  request,
  baseURL,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    baseURL,
  });
  const page = await context.newPage();
  await page.addInitScript(() =>
    Object.defineProperty(document, "fullscreenEnabled", { value: false }),
  );
  const id = await createDeck(page, request, 12);
  try {
    const map = mapFor(page);
    await expect(map).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
    await centered(map, 12);
    const viewport = map.locator(".minimap-slides");
    const box = (await viewport.boundingBox())!;
    const before = await viewport.evaluate((el) => el.scrollTop);
    const client = await context.newCDPSession(page);
    await client.send("Input.synthesizeScrollGesture", {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      yDistance: 140,
      gestureSourceType: "touch",
    });
    await expect
      .poll(() => viewport.evaluate((el) => el.scrollTop))
      .toBeLessThan(before - 20);
    await expect(page.locator(".slide-card").nth(11)).toHaveClass(/current/);
    const available = await visibleSlides(map);
    await map
      .getByRole("button", { name: `Map: slide ${available[1]}`, exact: true })
      .tap();
    await centered(map, available[1]);
    await page
      .getByRole("button", { name: "Fullscreen slides", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Expand fullscreen map", exact: true })
      .tap();
    const fullMap = mapFor(page, true);
    await centered(fullMap, available[1]);
    const currentScroll = await fullMap
      .locator(".minimap-slides")
      .evaluate((el) => el.scrollTop);
    await fullMap
      .getByRole("button", {
        name: "Earlier slides in A single connected story",
        exact: true,
      })
      .tap();
    await expect
      .poll(() =>
        fullMap.locator(".minimap-slides").evaluate((el) => el.scrollTop),
      )
      .toBeLessThan(currentScroll - 5);
    const rows = await visibleSlides(fullMap);
    await fullMap
      .getByRole("button", { name: `Map: slide ${rows[1]}`, exact: true })
      .tap();
    await centered(fullMap, rows[1]);
    await expect(
      page.locator(".slides-editor.editor-fullscreen"),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/grouped-mobile-map.png" });
    await page
      .getByRole("button", { name: "Exit fullscreen", exact: true })
      .tap();
    await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
    await centered(map, rows[1]);
  } finally {
    await context.close();
    await request.delete(`/api/documents/${id}`);
  }
});
