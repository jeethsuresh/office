import {
  test,
  expect,
  type Page,
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
  slideCount = 2,
) {
  const response = await request.post("/api/documents", {
    data: { name: `Block menu ${Date.now()}`, folderId: "" },
  });
  expect(response.ok()).toBe(true);
  const doc = await response.json();
  await page.goto(`/#document=${doc.id}`);
  for (const [index, kind] of ["Doc", "Canvas", "Slides"].entries()) {
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
    await page
      .locator(".office-block.is-active .block-title")
      .fill(
        kind === "Doc"
          ? "Kept note"
          : kind === "Canvas"
            ? "Delete this drawing"
            : "Whole story",
      );
  }
  for (let index = 1; index < slideCount; index++)
    await page
      .getByRole("button", { name: "Add content slide", exact: true })
      .click();
  await expect(page.locator(".slide-card")).toHaveCount(slideCount);
  await expect(
    page.getByRole("button", { name: "Previous slide", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Next slide", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Previous carousel slide", exact: true })
    .click();
  await expect(page.locator(".slide-card").nth(slideCount - 2)).toHaveClass(
    /current/,
  );
  await page
    .getByRole("button", { name: "Go to slide 1", exact: true })
    .click();
  await expect(page.locator(".slide-card").first()).toHaveClass(/current/);
  await expect(page.getByText("All changes saved")).toBeVisible();
  return doc.id as string;
}
async function confirmDelete(page: Page, title: string) {
  const modal = page.getByRole("dialog", {
    name: "Delete this block?",
    exact: true,
  });
  await expect(modal.getByText(title, { exact: true })).toBeVisible();
  await modal
    .getByRole("button", { name: "Delete block", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
}

test("right-click and keyboard menus delete their named block, preserve selection, sync, and work in fullscreen", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const id = await createDocument(page, request, 6);
  const peerContext = await browser.newContext({ baseURL });
  const peer = await peerContext.newPage();
  try {
    const map = mapFor(page);
    await map
      .getByRole("button", { name: "Go to doc block: Kept note", exact: true })
      .click();
    await page
      .getByLabel("Document text", { exact: true })
      .fill("The note survives other block deletions.");
    await peer.goto(`/#document=${id}`);
    await expect(
      peer.getByLabel("Document text", { exact: true }),
    ).toContainText("The note survives");
    const drawing = map.getByRole("button", {
      name: "Go to canvas block: Delete this drawing",
      exact: true,
    });
    await drawing.click({ button: "right" });
    const menu = page.getByRole("menu", {
      name: "Block actions: Delete this drawing",
      exact: true,
    });
    await expect(
      menu.getByRole("menuitem", { name: "Delete block", exact: true }),
    ).toBeFocused();
    await expect(
      page.locator(".office-block.is-active .block-title"),
    ).toHaveValue("Kept note");
    const menuBounds = (await menu.boundingBox())!;
    expect(menuBounds.x).toBeGreaterThanOrEqual(0);
    expect(menuBounds.x + menuBounds.width).toBeLessThan(1600);
    await page.screenshot({ path: "test-results/minimap-delete-menu.png" });
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(drawing).toBeFocused();
    await page.keyboard.press("Shift+F10");
    await expect(menu).toBeVisible();
    await page.locator(".office-block.is-active .block-title").click();
    await expect(menu).toHaveCount(0);
    await drawing.click({ button: "right" });
    await menu
      .getByRole("menuitem", { name: "Delete block", exact: true })
      .click();
    await confirmDelete(page, "Delete this drawing");
    await expect(map.locator(".minimap-title")).toHaveText([
      "Kept note",
      "Whole story",
    ]);
    await expect(mapFor(peer).locator(".minimap-title")).toHaveText([
      "Kept note",
      "Whole story",
    ]);
    await expect(
      page.getByLabel("Document text", { exact: true }),
    ).toContainText("The note survives");
    await map
      .getByRole("button", { name: "Undo block change", exact: true })
      .click();
    await expect(map.locator(".minimap-title")).toHaveText([
      "Kept note",
      "Delete this drawing",
      "Whole story",
    ]);
    const slideWindow = map.getByRole("group", {
      name: "Slides in Whole story",
    });
    await slideWindow.hover();
    await page.mouse.wheel(0, 1000);
    await expect
      .poll(() => slideWindow.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(100);
    await map
      .getByRole("button", { name: "Map: slide 6", exact: true })
      .click({ button: "right" });
    await page
      .getByRole("menu", { name: "Block actions: Whole story", exact: true })
      .getByRole("menuitem", { name: "Delete block", exact: true })
      .click();
    await confirmDelete(page, "Whole story");
    await expect(page.locator(".block-slides")).toHaveCount(0);
    await map
      .getByRole("button", { name: "Undo block change", exact: true })
      .click();
    await expect(page.locator(".slide-card")).toHaveCount(6);
    await page
      .getByRole("button", { name: "Fullscreen note", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Expand fullscreen map", exact: true })
      .hover();
    const full = mapFor(page, true);
    await full
      .getByRole("button", { name: "Go to doc block: Kept note", exact: true })
      .click({ button: "right" });
    const fullMenu = page.getByRole("menu", {
      name: "Block actions: Kept note",
      exact: true,
    });
    await fullMenu
      .getByRole("menuitem", { name: "Delete block", exact: true })
      .hover();
    await expect(full).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(fullMenu).toHaveCount(0);
    await expect(page.locator(".doc-editor.editor-fullscreen")).toBeVisible();
    await page.evaluate(() => {
      (window as any).menuFullscreenHost = document.fullscreenElement;
    });
    await full
      .getByRole("button", { name: "Go to doc block: Kept note", exact: true })
      .click({ button: "right" });
    await fullMenu
      .getByRole("menuitem", { name: "Delete block", exact: true })
      .click();
    await confirmDelete(page, "Kept note");
    await expect(
      page.locator(".canvas-editor.editor-fullscreen"),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.fullscreenElement === (window as any).menuFullscreenHost,
      ),
    ).toBe(true);
    await expect(mapFor(peer).locator(".minimap-title")).toHaveText([
      "Delete this drawing",
      "Whole story",
    ]);
    await page.keyboard.press("Escape");
    await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
    await map
      .getByRole("button", { name: "Undo block change", exact: true })
      .click();
    await expect(
      page.getByLabel("Document text", { exact: true }),
    ).toContainText("The note survives");
  } finally {
    await peerContext.close();
    await request.delete(`/api/documents/${id}`);
  }
});

test("mobile hold opens deletion without navigating, while taps and drags stay distinct", async ({
  browser,
  request,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() =>
    Object.defineProperty(document, "fullscreenEnabled", { value: false }),
  );
  const id = await createDocument(page, request);
  try {
    const client = await context.newCDPSession(page);
    const map = mapFor(page);
    const drawing = (await map
      .locator(".minimap-number")
      .nth(1)
      .boundingBox())!;
    const x = drawing.x + drawing.width / 2,
      y = drawing.y + drawing.height / 2;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    const menu = page.getByRole("menu", {
      name: "Block actions: Delete this drawing",
      exact: true,
    });
    await expect(menu).toBeVisible();
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(
      page.locator(".office-block.is-active .block-title"),
    ).toHaveValue("Whole story");
    await menu
      .getByRole("menuitem", { name: "Delete block", exact: true })
      .tap();
    await expect(
      page
        .getByRole("dialog")
        .getByText("Delete this drawing", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Keep it", exact: true }).tap();
    await map
      .getByRole("button", {
        name: "Go to canvas block: Delete this drawing",
        exact: true,
      })
      .press("Enter");
    await expect(
      page.locator(".office-block.is-active .block-title"),
    ).toHaveValue("Delete this drawing");
    await map
      .getByRole("button", {
        name: "Go to slides block: Whole story",
        exact: true,
      })
      .tap();
    await map
      .getByRole("button", {
        name: "Go to canvas block: Delete this drawing",
        exact: true,
      })
      .tap();
    await expect(
      page.locator(".office-block.is-active .block-title"),
    ).toHaveValue("Delete this drawing");
    await expect(page.getByRole("menu")).toHaveCount(0);
    const first = (await map.locator(".minimap-number").first().boundingBox())!;
    const last = (await map.locator(".minimap-segment").last().boundingBox())!;
    const dragX = first.x + first.width / 2;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: dragX, y: first.y + first.height / 2 }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: dragX, y: last.y + last.height - 2 }],
    });
    await expect(map).toHaveClass(/is-dragging/);
    await page.waitForTimeout(650);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(map.locator(".minimap-title")).toHaveText([
      "Delete this drawing",
      "Whole story",
      "Kept note",
    ]);
    const slide = (await map
      .getByRole("button", { name: "Map: slide 1", exact: true })
      .boundingBox())!;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: slide.x + slide.width / 2, y: slide.y + slide.height / 2 },
      ],
    });
    const storyMenu = page.getByRole("menu", {
      name: "Block actions: Whole story",
      exact: true,
    });
    await expect(storyMenu).toBeVisible();
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(
      page.locator(".office-block.is-active .block-title"),
    ).toHaveValue("Delete this drawing");
    await page.screenshot({ path: "test-results/minimap-delete-mobile.png" });
    await storyMenu
      .getByRole("menuitem", { name: "Delete block", exact: true })
      .tap();
    await confirmDelete(page, "Whole story");
    await expect(map.locator(".minimap-title")).toHaveText([
      "Delete this drawing",
      "Kept note",
    ]);
    await map
      .getByRole("button", { name: "Go to doc block: Kept note", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Fullscreen note", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Expand fullscreen map", exact: true })
      .tap();
    const full = mapFor(page, true);
    const number = (await full
      .locator(".minimap-number")
      .first()
      .boundingBox())!;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: number.x + number.width / 2, y: number.y + number.height / 2 },
      ],
    });
    await expect(menu).toBeVisible();
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await menu
      .getByRole("menuitem", { name: "Delete block", exact: true })
      .tap();
    await confirmDelete(page, "Delete this drawing");
    await expect(page.locator(".doc-editor.editor-fullscreen")).toBeVisible();
    await page
      .getByRole("button", { name: "Exit fullscreen", exact: true })
      .tap();
  } finally {
    await context.close();
    await request.delete(`/api/documents/${id}`);
  }
});
