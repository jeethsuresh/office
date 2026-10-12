import { test, expect, type Page } from "@playwright/test";
import { newDocument, newBlock, selectCell, setCell } from "./office-fixtures";
async function pick(page: Page, query: string) {
  const search = page.getByRole("combobox", {
    name: "Search link targets",
    exact: true,
  });
  await search.fill(query);
  await expect(
    page.getByRole("listbox", { name: "Link targets" }).getByRole("option"),
  ).toHaveCount(1);
  await search.press("Enter");
}
test("slash links connect documents, headings, slides, pins and live cells; moves and renames preserve targets", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as any).copiedURN = text;
        },
      },
    });
  });
  const title = `Targets ${Date.now()}`,
    targetDoc = await newDocument(page, request, title);
  let sourceDoc = "";
  const peerContext = await browser.newContext({ baseURL });
  const peer = await peerContext.newPage();
  try {
    const noteID = await newBlock(page, "Doc", "Meeting notes");
    await page
      .getByLabel("Document text", { exact: true })
      .fill("Revenue anchor");
    await page.getByRole("button", { name: "Heading 1", exact: true }).click();
    const heading = page.locator(".prose h1");
    await expect(heading).toHaveAttribute("data-office-anchor", /h-/);
    const headingID = await heading.getAttribute("data-office-anchor");
    const sheetID = await newBlock(page, "Sheet", "Numbers");
    await setCell(page, "A1", "42", "42");
    await page
      .getByRole("button", { name: "Copy cell reference", exact: true })
      .click();
    const cellURN = await page.evaluate(
      () => (window as any).copiedURN as string,
    );
    expect(cellURN.split(":")).toHaveLength(3);
    const deckID = await newBlock(page, "Slides", "Story");
    await page
      .locator(".slide-card.current")
      .getByLabel("Slide title", { exact: true })
      .fill("Opening anchor");
    const slideID = await page
      .locator(".slide-card.current")
      .getAttribute("data-slide-id");
    await page
      .getByRole("button", { name: "Add content slide", exact: true })
      .click();
    await expect(page.locator(".slide-card").last()).toHaveClass(/current/);
    await page
      .locator(".slide-card.current")
      .getByLabel("Slide title", { exact: true })
      .fill("Closing anchor");
    const canvasID = await newBlock(page, "Canvas", "Drawing");
    await page.getByRole("button", { name: "Pin (I)", exact: true }).click();
    const drawing = page.getByLabel("Drawing workspace", { exact: true });
    const bounds = (await drawing.boundingBox())!;
    await drawing.click({
      position: { x: bounds.width / 3, y: bounds.height / 3 },
    });
    await page
      .getByLabel("Pin name", { exact: true })
      .fill("Checkpoint anchor");
    await page
      .getByRole("button", { name: "Choose pin target", exact: true })
      .click();
    await pick(page, `${title} Numbers A1`);
    await page.getByRole("button", { name: "Save pin", exact: true }).click();
    await expect(page.locator(".canvas-pin text")).toContainText(
      "Checkpoint anchor · A1 = 42",
    );
    const pinID = await page
      .locator(".canvas-pin")
      .getAttribute("data-shape-id");
    await expect(page.getByText("All changes saved")).toBeVisible();
    sourceDoc = await newDocument(page, request, `Links ${Date.now()}`);
    const sourceNote = await newBlock(page, "Doc", "Connected note");
    const note = page.getByLabel("Document text", { exact: true });
    for (const query of [
      `${title} Revenue anchor`,
      `${title} Opening anchor`,
      `${title} Checkpoint anchor`,
      `${title} Numbers A1`,
    ]) {
      await note.click();
      await note.press("ControlOrMeta+End");
      await note.pressSequentially(" /link");
      await expect(
        page.getByRole("dialog", { name: "Slash commands", exact: true }),
      ).toBeVisible();
      await note.press("Enter");
      await pick(page, query);
    }
    await expect(page.locator(".office-reference")).toHaveCount(4);
    await expect(page.locator(".office-reference").last()).toContainText(
      "A1 · 42",
    );
    await page
      .getByRole("button", { name: "Fullscreen note", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: "Open reference: Revenue anchor",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`document=${targetDoc}.*target=${headingID}`),
    );
    await expect(page.locator(".office-block.is-active")).toHaveAttribute(
      "data-block-id",
      noteID,
    );
    await expect(
      page.locator(`.prose [data-office-anchor="${headingID}"]`),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Go to sheet block: Numbers", exact: true })
      .click();
    await selectCell(page, "A1");
    await page
      .getByRole("button", { name: "Move row down", exact: true })
      .click();
    await setCell(page, "A2", "70", "70");
    await page
      .locator(".office-block.is-active .block-title")
      .fill("Renamed numbers");
    await page
      .getByRole("button", { name: "Go to slides block: Story", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Next carousel slide", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Move slide 2 earlier", exact: true })
      .click();
    await expect(
      page
        .locator(".slide-card.current")
        .getByLabel("Slide title", { exact: true }),
    ).toHaveValue("Closing anchor");
    await expect(page.getByText("All changes saved")).toBeVisible();
    await page.goto(`/#document=${sourceDoc}`);
    await expect(page.locator(".office-reference").last()).toContainText(
      "A2 · 70",
    );
    await peer.goto(
      `/#document=${targetDoc}&block=${sheetID}&target=${cellURN.split(":")[2]}`,
    );
    await expect(peer.locator(".office-block.is-active")).toHaveAttribute(
      "data-block-id",
      sheetID,
    );
    await expect(peer.getByLabel("Cell address", { exact: true })).toHaveValue(
      "A2",
    );
    await setCell(peer, "A2", "88", "88");
    await expect(page.locator(".office-reference").last()).toContainText(
      "A2 · 88",
    );
    await page
      .getByRole("button", {
        name: "Open reference: Opening anchor",
        exact: true,
      })
      .click();
    await expect(page.locator(".slide-card.current")).toHaveAttribute(
      "data-slide-id",
      slideID!,
    );
    await page
      .locator(".slide-card.current")
      .getByLabel("Slide title", { exact: true })
      .fill("Renamed opening");
    await page.goto(`/#document=${sourceDoc}`);
    await expect(
      page.getByRole("button", {
        name: "Open reference: Renamed opening",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: "Open reference: Checkpoint anchor",
        exact: true,
      })
      .click();
    await expect(page.locator(".office-block.is-active")).toHaveAttribute(
      "data-block-id",
      canvasID,
    );
    await expect(
      page.locator(`.canvas-pin[data-shape-id="${pinID}"] .selection-rect`),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Show backlinks", exact: true })
      .click();
    await expect(page.locator(".backlink-results")).toContainText(
      "Connected note",
    );
    await page.goto(`/#document=${sourceDoc}`);
    await page.screenshot({ path: "test-results/linked-document.png" });
    expect(errors).toEqual([]);
  } finally {
    await peerContext.close();
    if (sourceDoc) await request.delete(`/api/documents/${sourceDoc}`);
    await request.delete(`/api/documents/${targetDoc}`);
  }
});

test("mobile slash picker and cell links navigate between blocks while retaining fullscreen", async ({
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
  await page.addInitScript(() =>
    Object.defineProperty(document, "fullscreenEnabled", { value: false }),
  );
  const name = `Mobile references ${Date.now()}`,
    id = await newDocument(page, request, name);
  try {
    const sheet = await newBlock(page, "Sheet", "Values");
    await setCell(page, "A1", "9", "9");
    const noteID = await newBlock(page, "Doc", "Mobile note");
    const note = page.getByLabel("Document text", { exact: true });
    await note.pressSequentially("/link");
    await note.press("Enter");
    await pick(page, `${name} Values A1`);
    await expect(page.locator(".office-reference")).toContainText("A1 · 9");
    await page
      .getByRole("button", { name: "Fullscreen note", exact: true })
      .tap();
    await page
      .getByRole("button", { name: "Open reference: A1", exact: true })
      .tap();
    await expect(page.locator(".sheet-editor.editor-fullscreen")).toBeVisible();
    await expect(page.getByLabel("Cell address", { exact: true })).toHaveValue(
      "A1",
    );
    await page
      .getByLabel("Cell value or formula", { exact: true })
      .fill("/link");
    await page
      .getByLabel("Cell value or formula", { exact: true })
      .press("Enter");
    await pick(page, `${name} Mobile note`);
    await expect(page.getByLabel("Selected cell result")).toContainText(
      "Mobile note",
    );
    await page
      .getByRole("button", { name: "Open linked cell target", exact: true })
      .tap();
    await expect(page.locator(".doc-editor.editor-fullscreen")).toBeVisible();
    await page
      .getByRole("button", { name: "Exit fullscreen", exact: true })
      .tap();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: "test-results/link-picker-mobile.png" });
  } finally {
    await context.close();
    await request.delete(`/api/documents/${id}`);
  }
});
