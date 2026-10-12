import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

async function fixtures(request: APIRequestContext) {
  const folder = async (name: string, parentId = "") =>
    await (
      await request.post("/api/folders", { data: { name, parentId } })
    ).json();
  const document = async (name: string, folderId: string) =>
    await (
      await request.post("/api/documents", { data: { name, folderId } })
    ).json();
  const root = await folder(`Browser ${Date.now()}`);
  const alpha = await folder("Alpha", root.id);
  const zebra = await folder("Zebra", root.id);
  const nested = await folder("Nested", alpha.id);
  const report = await document("A report", root.id);
  const plan = await document("Z plan", root.id);
  const inner = await document("Inside alpha", alpha.id);
  return {
    root,
    alpha,
    zebra,
    nested,
    report,
    plan,
    inner,
    cleanup: async () => {
      const workspace = await (await request.get("/api/workspace")).json();
      for (const doc of workspace.documents.filter((doc: any) =>
        [root.id, alpha.id, zebra.id, nested.id].includes(doc.folderId),
      ))
        await request.delete(`/api/documents/${doc.id}`);
      for (const item of [nested, zebra, alpha, root])
        await request.delete(`/api/folders/${item.id}`);
    },
  };
}
const browserView = (page: Page) =>
  page.getByRole("region", { name: "Workspace browser", exact: true });

test("Office opens a sortable list/icon folder browser with history, creation, and moves", async ({
  page,
  request,
}) => {
  const f = await fixtures(request);
  try {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto(`/#document=${f.report.id}`);
    await page
      .getByRole("button", { name: "Open workspace", exact: true })
      .click();
    const view = browserView(page);
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Toggle sidebar", exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Control+k");
    await expect(view.getByLabel("Search this folder")).toBeFocused();
    await view
      .getByRole("button", { name: `Open folder: ${f.root.name}`, exact: true })
      .click();
    const names = view.locator(".browser-item-link span");
    await expect(names).toHaveText(["A report", "Alpha", "Z plan", "Zebra"]);
    await view
      .getByRole("button", { name: "Sort descending", exact: true })
      .click();
    await expect(names).toHaveText(["Zebra", "Z plan", "Alpha", "A report"]);
    await view.getByLabel("Sort items by").selectOption("type");
    await view
      .getByRole("button", { name: "Sort ascending", exact: true })
      .click();
    await expect(names).toHaveText(["A report", "Z plan", "Alpha", "Zebra"]);
    await view.getByLabel("Sort items by").selectOption("updated");
    await view
      .getByRole("button", { name: "Sort descending", exact: true })
      .click();
    await expect(names).toHaveText(["Z plan", "A report", "Zebra", "Alpha"]);
    await view.getByRole("button", { name: "Icon view", exact: true }).click();
    await expect(view.locator(".browser-card")).toHaveCount(4);
    await view
      .getByRole("button", { name: "Open folder: Alpha", exact: true })
      .click();
    await expect(
      view.getByRole("heading", { name: "Alpha", exact: true }),
    ).toBeVisible();
    await view
      .getByRole("button", { name: "Open folder: Nested", exact: true })
      .click();
    await expect(
      view.getByRole("heading", { name: "Empty folder", exact: true }),
    ).toBeVisible();
    await view
      .getByRole("button", { name: "Up one folder", exact: true })
      .click();
    await view
      .getByRole("navigation", { name: "Folder path" })
      .getByRole("button", { name: f.root.name, exact: true })
      .click();
    await view
      .getByRole("navigation", { name: "Folder path" })
      .getByRole("button", { name: "Workspace", exact: true })
      .click();
    await page.goBack();
    await expect(
      view.getByRole("heading", { name: f.root.name, exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await expect(
      view.getByRole("button", { name: "Icon view", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(view.getByLabel("Sort items by")).toHaveValue("updated");
    await expect(
      view.getByRole("button", { name: "Sort ascending" }),
    ).toBeVisible();
    await view
      .getByRole("button", { name: "Manage document: A report", exact: true })
      .click();
    await page
      .getByLabel("In folder", { exact: true })
      .selectOption(f.zebra.id);
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      view.getByRole("button", {
        name: "Open document: A report",
        exact: true,
      }),
    ).toHaveCount(0);
    await view
      .getByRole("button", { name: "Manage folder: Zebra", exact: true })
      .click();
    await page
      .getByLabel("Parent folder", { exact: true })
      .selectOption(f.alpha.id);
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      view.getByRole("button", { name: "Open folder: Zebra", exact: true }),
    ).toHaveCount(0);
    await view
      .getByRole("button", { name: "Open folder: Alpha", exact: true })
      .click();
    await view
      .getByRole("button", { name: "Open folder: Zebra", exact: true })
      .click();
    await expect(
      view.getByRole("button", {
        name: "Open document: A report",
        exact: true,
      }),
    ).toBeVisible();
    await view.getByRole("button", { name: "New folder", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("New collection");
    await expect(page.getByLabel("Parent folder", { exact: true })).toHaveValue(
      f.zebra.id,
    );
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(
      view.getByRole("button", {
        name: "Open folder: New collection",
        exact: true,
      }),
    ).toBeVisible();
    const workspace = await (await request.get("/api/workspace")).json();
    const created = workspace.folders.find(
      (folder: any) =>
        folder.name === "New collection" && folder.parentId === f.zebra.id,
    );
    await request.delete(`/api/folders/${created.id}`);
    await view.getByRole("button", { name: "List view", exact: true }).click();
    await page.screenshot({ path: "test-results/workspace-list.png" });
    await view.getByRole("button", { name: "Icon view", exact: true }).click();
    await page.screenshot({ path: "test-results/workspace-icons.png" });
    await view
      .getByRole("button", { name: "Open document: A report", exact: true })
      .click();
    await expect(page.locator(".document-name")).toHaveText("A report");
    await expect(page.locator(".sidebar")).toBeVisible();
  } finally {
    await f.cleanup();
  }
});

test("mobile workspace browser navigates folders, switches views, and creates in the current folder", async ({
  browser,
  request,
  baseURL,
}) => {
  const f = await fixtures(request);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    baseURL,
  });
  const page = await context.newPage();
  try {
    await page.goto(`/#document=${f.report.id}`);
    await page
      .getByRole("button", { name: "1 person in this document", exact: true })
      .tap();
    await expect(page.getByRole("tooltip")).toContainText("In this document");
    await page
      .getByRole("button", { name: "Toggle sidebar", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Open workspace", exact: true })
      .tap();
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Toggle sidebar", exact: true }),
    ).toHaveCount(0);
    const view = browserView(page);
    await view
      .getByRole("button", { name: `Open folder: ${f.root.name}`, exact: true })
      .tap();
    await view.getByRole("button", { name: "Icon view", exact: true }).tap();
    await expect(view.locator(".browser-card")).toHaveCount(4);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    await view.getByRole("button", { name: "List view", exact: true }).tap();
    await view.getByLabel("Search this folder").fill("alpha");
    await expect(view.locator(".browser-item-link span")).toHaveText(["Alpha"]);
    await view
      .getByRole("button", { name: "Open folder: Alpha", exact: true })
      .tap();
    await view.getByRole("button", { name: "New document", exact: true }).tap();
    await page.getByLabel("Name", { exact: true }).fill("Mobile idea");
    await expect(page.getByLabel("In folder", { exact: true })).toHaveValue(
      f.alpha.id,
    );
    await page.getByRole("button", { name: "Create", exact: true }).tap();
    await expect(page.locator(".document-name")).toHaveText("Mobile idea");
    await page.goBack();
    await expect(
      view.getByRole("button", {
        name: "Open document: Mobile idea",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".presence")).toHaveCount(0);
    await page.screenshot({ path: "test-results/workspace-mobile.png" });
  } finally {
    await context.close();
    await f.cleanup();
  }
});

test("presence hover lists every name, including overflow, and updates live", async ({
  browser,
  request,
  baseURL,
}) => {
  const doc = await (
    await request.post("/api/documents", {
      data: { name: `Presence ${Date.now()}`, folderId: "" },
    })
  ).json();
  const contexts = [];
  const pages: Page[] = [];
  try {
    for (const name of ["Aster", "Morgan", "Riya", "Luis", "Sam", "Nora"]) {
      const context = await browser.newContext({ baseURL });
      contexts.push(context);
      await context.addInitScript(
        (name) =>
          localStorage.setItem(
            "office:user",
            JSON.stringify({ name, color: "#4f83cf" }),
          ),
        name,
      );
      const page = await context.newPage();
      pages.push(page);
      await page.goto(`/#document=${doc.id}`);
    }
    const page = pages[0];
    const avatars = page.getByRole("button", {
      name: "6 people in this document",
      exact: true,
    });
    await expect(avatars).toBeVisible();
    await expect(avatars.locator(".presence-overflow")).toHaveText("+2");
    await avatars.hover();
    const names = page.getByRole("tooltip");
    await expect(names.locator("li")).toHaveCount(6);
    for (const name of ["Aster", "Morgan", "Riya", "Luis", "Sam", "Nora"])
      await expect(names).toContainText(name);
    await pages[1].getByRole("button", { name: "Share", exact: true }).click();
    await pages[1].getByLabel("Your name", { exact: true }).fill("Morgan Lee");
    await expect(names).toContainText("Morgan Lee");
    await page.screenshot({ path: "test-results/presence-names.png" });
    await page.mouse.move(10, 500);
    await expect(names).toHaveCount(0);
    await avatars.focus();
    await expect(names).toBeVisible();
    await pages[5]
      .getByRole("button", { name: "Open workspace", exact: true })
      .click();
    await expect(names.locator("li")).toHaveCount(5);
    await contexts[5].close();
    contexts.pop();
    await expect(names.locator("li")).toHaveCount(5);
    await expect(names).not.toContainText("Nora");
  } finally {
    for (const context of contexts) await context.close();
    await request.delete(`/api/documents/${doc.id}`);
  }
});

test("wide minimap previews reflect content and own insertion, deletion, and undo", async ({
  page,
  request,
}) => {
  const doc = await (
    await request.post("/api/documents", {
      data: { name: `Structure ${Date.now()}`, folderId: "" },
    })
  ).json();
  try {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`/#document=${doc.id}`);
    await page
      .getByRole("button", { name: "Add your first block", exact: true })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: /Doc/ }).click();
    await page
      .getByLabel("Doc block title", { exact: true })
      .fill("Research outline");
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    await page
      .getByLabel("Markdown source")
      .fill("# Research\n\nA long paragraph about the project. ".repeat(4));
    await page
      .getByRole("button", { name: "Insert Markdown", exact: true })
      .click();
    const map = page.getByRole("complementary", {
      name: "Document minimap",
      exact: true,
    });
    const first = map.locator(".minimap-segment").first();
    await expect(first.locator(".text-preview")).toBeVisible();
    const lines = Number(
      await first.locator(".text-preview").getAttribute("data-preview-lines"),
    );
    expect(lines).toBeGreaterThan(4);
    expect((await map.boundingBox())!.width).toBeGreaterThan(100);
    await map
      .getByRole("button", { name: "Add block from map", exact: true })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: /Doc/ }).click();
    await page
      .locator(".block-doc")
      .nth(1)
      .getByLabel("Doc block title", { exact: true })
      .fill("A short note");
    await page
      .locator(".block-doc")
      .nth(1)
      .getByLabel("Document text", { exact: true })
      .fill("One short thought.");
    await expect(map.locator(".text-preview").nth(1)).toHaveAttribute(
      "data-preview-lines",
      "1",
    );
    await map
      .getByRole("button", { name: "Add block from map", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Canvas/ })
      .click();
    await page
      .getByRole("button", { name: "Rectangle (R)", exact: true })
      .click();
    const surface = (await page
      .getByLabel("Drawing workspace", { exact: true })
      .boundingBox())!;
    await page.mouse.move(surface.x + 100, surface.y + 100);
    await page.mouse.down();
    await page.mouse.move(surface.x + 250, surface.y + 200);
    await page.mouse.up();
    await expect(map.locator(".canvas-preview")).toHaveAttribute(
      "data-preview-shapes",
      "1",
    );
    await expect(map.locator(".canvas-preview rect")).toHaveCount(1);
    await expect(
      page
        .locator(".block-heading")
        .getByRole("button", { name: /Add|Remove/i }),
    ).toHaveCount(0);
    await map
      .getByRole("button", {
        name: "Go to doc block: Research outline",
        exact: true,
      })
      .click();
    await map
      .getByRole("button", { name: "Add block from map", exact: true })
      .click();
    await page
      .getByLabel("Block position", { exact: true })
      .selectOption("after");
    await page.getByRole("dialog").getByRole("button", { name: /Doc/ }).click();
    await expect
      .poll(() =>
        page
          .locator(".block-title")
          .evaluateAll((inputs) =>
            inputs.map((input) => (input as HTMLInputElement).value),
          ),
      )
      .toEqual([
        "Research outline",
        "Untitled note",
        "A short note",
        "Untitled canvas",
      ]);
    await map
      .getByRole("button", {
        name: "Delete selected block from map",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete block", exact: true })
      .click();
    await expect(page.locator(".office-block")).toHaveCount(3);
    await map
      .getByRole("button", { name: "Undo block change", exact: true })
      .click();
    await expect(page.locator(".office-block")).toHaveCount(4);
    await expect(first.locator(".text-preview")).toHaveAttribute(
      "data-preview-lines",
      String(lines),
    );
    await page.screenshot({ path: "test-results/structure-minimap.png" });
    await page.setViewportSize({ width: 1100, height: 1000 });
    expect((await map.boundingBox())!.width).toBeLessThan(100);
    await expect(first.locator(".text-preview")).not.toBeVisible();
    await page.setViewportSize({ width: 1600, height: 1000 });
    await map
      .getByRole("button", {
        name: "Go to doc block: Research outline",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Fullscreen note", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Expand fullscreen map", exact: true })
      .hover();
    const fullMap = page.getByRole("complementary", {
      name: "Fullscreen document minimap",
      exact: true,
    });
    await expect(fullMap.locator(".text-preview").first()).toBeVisible();
    expect((await fullMap.boundingBox())!.width).toBeGreaterThan(100);
    const previewBounds = (await fullMap
      .locator(".text-preview")
      .first()
      .boundingBox())!;
    // A wide map must remain clickable beyond the original 54px controls rail.
    const hit = await page.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest(".minimap-block")
          ?.getAttribute("aria-label"),
      { x: previewBounds.x + previewBounds.width - 5, y: previewBounds.y + 15 },
    );
    expect(hit).toBe("Go to doc block: Research outline");
    await page.screenshot({ path: "test-results/structure-fullscreen.png" });
    await page.keyboard.press("Escape");
    await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
  } finally {
    await request.delete(`/api/documents/${doc.id}`);
  }
});
