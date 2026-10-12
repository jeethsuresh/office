import { partitionableSession } from "./network";
import { test, expect, type Page } from "@playwright/test";
async function addBlock(page: Page, type: "Doc" | "Canvas" | "Slides") {
  await page.getByRole("button", { name: "Add block from map" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(type) })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(
      `.block-${type.toLowerCase() === "slides" ? "slides" : type.toLowerCase()}`,
    ),
  ).toHaveCount(1);
}
async function createDocument(request: any, name: string) {
  const response = await request.post("/api/documents", {
    data: { name, folderId: "" },
  });
  expect(response.ok()).toBeTruthy();
  return await response.json();
}
test("desktop flow: folders, rich text, drawing, slide layouts, minimap, and insertion", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("All changes saved")).toBeVisible();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill(`Ideas ${Date.now()}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const doc = await createDocument(request, `Studio test ${Date.now()}`);
  await page.goto(`/#document=${doc.id}`);
  await expect(
    page.getByRole("button", { name: "Add your first block" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add your first block" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Doc/ }).click();
  await page
    .getByLabel("Document text", { exact: true })
    .fill("A shared thought");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.getByLabel("Document text", { exact: true }).press("End");
  await page
    .getByLabel("Document text", { exact: true })
    .pressSequentially(" with emphasis");
  await expect(
    page.getByLabel("Document text", { exact: true }).locator("strong"),
  ).toHaveText(" with emphasis");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await page
    .getByLabel("Markdown source")
    .fill("\n## A Markdown heading\n\nAnother thought.");
  await page
    .getByRole("button", { name: "Insert Markdown", exact: true })
    .click();
  await expect(
    page.getByLabel("Document text", { exact: true }).locator("h2"),
  ).toHaveText("A Markdown heading");
  await addBlock(page, "Canvas");
  const surface = page.getByLabel("Drawing workspace", { exact: true }).first();
  await page
    .getByRole("button", { name: "Rectangle (R)", exact: true })
    .click();
  const bounds = (await surface.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width * 0.25,
    bounds.y + bounds.height * 0.35,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.5,
    bounds.y + bounds.height * 0.6,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect(page.locator(".block-canvas [data-shape-id]")).toHaveCount(1);
  await addBlock(page, "Slides");
  await page
    .locator(".block-slides")
    .getByRole("button", { name: "Add content slide", exact: true })
    .click();
  await expect(page.locator(".slide-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Map: slide 2", exact: true }).click();
  await page
    .getByLabel("Slide title", { exact: true })
    .nth(1)
    .fill("A useful story");
  await page
    .getByLabel("Slide note", { exact: true })
    .fill("Notes belong on slides too.");
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(
    page.locator(".slide-content-body .drawing-surface"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await expect(page.getByLabel("Slide note", { exact: true })).toContainText(
    "Notes belong on slides too.",
  );
  await page
    .getByRole("button", { name: "Present slides", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Presentation" }),
  ).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".presented-slide .title-slide")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Presentation" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: /Go to doc block/ }).click();
  await expect(
    page.getByLabel("Document text", { exact: true }),
  ).toBeInViewport();
  await page
    .getByRole("button", { name: "Add block from map", exact: true })
    .click();
  await page
    .getByLabel("Block position", { exact: true })
    .selectOption("after");
  await page.getByRole("dialog").getByRole("button", { name: /Doc/ }).click();
  await expect(page.locator(".office-block")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Document options", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Renamed studio");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator(".document-name")).toHaveText("Renamed studio");
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("two browser clients merge live and offline edits, blocks, and presence", async ({
  browser,
  request,
  baseURL,
}) => {
  const doc = await createDocument(request, `Multiplayer ${Date.now()}`);
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage(),
    pb = await b.newPage();
  const networkA = await partitionableSession(pa),
    networkB = await partitionableSession(pb);
  const errors: string[] = [];
  pa.on("pageerror", (e) => errors.push(e.message));
  pb.on("pageerror", (e) => errors.push(e.message));
  try {
    await Promise.all([
      pa.goto(`${baseURL}/#document=${doc.id}`),
      pb.goto(`${baseURL}/#document=${doc.id}`),
    ]);
    await expect(pa.getByText("All changes saved")).toBeVisible();
    await expect(pb.getByText("All changes saved")).toBeVisible();
    const catalog = await (await request.get("/api/workspace")).json();
    expect(
      catalog.documents.find((entry: any) => entry.id === doc.id).updatedAt,
    ).toBe(doc.updatedAt);
    await pa.getByRole("button", { name: "Add your first block" }).click();
    await pa.getByRole("dialog").getByRole("button", { name: /Doc/ }).click();
    await expect(pb.getByLabel("Document text", { exact: true })).toBeVisible();
    await expect(pa.locator(".presence-avatars span")).toHaveCount(2);
    await pa
      .getByLabel("Document text", { exact: true })
      .fill("We can think together.");
    await expect(pb.getByLabel("Document text", { exact: true })).toContainText(
      "We can think together.",
    );
    await Promise.all([networkA.pause(), networkB.pause()]);
    await expect(pa.getByText("Saved on this device")).toBeVisible();
    await expect(pb.getByText("Saved on this device")).toBeVisible();
    await pa
      .getByLabel("Document text", { exact: true })
      .press("ControlOrMeta+End");
    await pa
      .getByLabel("Document text", { exact: true })
      .pressSequentially(" From Alice.");
    await pb
      .getByLabel("Document text", { exact: true })
      .press("ControlOrMeta+End");
    await pb
      .getByLabel("Document text", { exact: true })
      .pressSequentially(" From Bob.");
    await expect(
      pa.getByLabel("Document text", { exact: true }),
    ).not.toContainText("From Bob.");
    await expect(
      pb.getByLabel("Document text", { exact: true }),
    ).not.toContainText("From Alice.");
    await Promise.all([networkA.resume(), networkB.resume()]);
    await expect(pa.getByLabel("Document text", { exact: true })).toContainText(
      "From Bob.",
      { timeout: 20000 },
    );
    await expect(pb.getByLabel("Document text", { exact: true })).toContainText(
      "From Alice.",
      { timeout: 20000 },
    );
    const documentText = (el: HTMLElement) => {
      const copy = el.cloneNode(true) as HTMLElement;
      copy
        .querySelectorAll(".collaboration-carets__label")
        .forEach((n) => n.remove());
      return copy.textContent;
    };
    expect(
      await pa
        .getByLabel("Document text", { exact: true })
        .evaluate(documentText),
    ).toEqual(
      await pb
        .getByLabel("Document text", { exact: true })
        .evaluate(documentText),
    );
    await addBlock(pa, "Canvas");
    await expect(pb.locator(".block-canvas")).toHaveCount(1);
    await pa.locator(".block-canvas input.block-title").fill("Drawn together");
    const canvasHeader = pb.locator(".block-canvas .block-header-navigation");
    await expect(canvasHeader).toHaveAttribute("title", "Drawn together");
    await canvasHeader.click();
    await expect(pb.locator(".block-viewport")).not.toHaveClass(
      /is-navigating/,
    );
    await expect(pb.locator(".block-canvas input.block-title")).toHaveValue(
      "Drawn together",
    );
    await pa.reload();
    await expect(pa.getByLabel("Document text", { exact: true })).toContainText(
      "From Alice.",
    );
    await expect(pa.getByLabel("Document text", { exact: true })).toContainText(
      "From Bob.",
    );
    expect(errors).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});
test("mobile profile keeps navigation, editing, drawing, and horizontal slides usable", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Toggle sidebar", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Toggle sidebar", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Documents" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close sidebar", exact: true })
    .click();
  await expect(page.getByLabel("Document text", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Go to canvas block/ }).click();
  await expect(page.locator(".block-canvas .drawing-surface")).toBeInViewport();
  await page.getByRole("button", { name: /Go to slides block/ }).click();
  await expect(
    page.locator(".block-slides .slide-card").first(),
  ).toBeInViewport();
  await page.getByRole("button", { name: "Map: slide 2", exact: true }).click();
  await expect(page.locator(".slide-card").nth(1)).toBeInViewport();
  await expect(page.getByLabel("Slide note", { exact: true })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
