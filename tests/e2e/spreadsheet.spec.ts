import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { newDocument, newBlock, selectCell, setCell } from "./office-fixtures";
for (const mobile of [false, true])
  test(`Glide spreadsheet calculates, moves persistent cells, undoes, and edits fullscreen on ${mobile ? "mobile" : "desktop"}`, async ({
    browser,
    request,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1500, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const id = await newDocument(page, request, `Grid ${Date.now()}`);
    try {
      await newBlock(page, "Sheet", "Budget");
      await expect(page.locator(".sheet-grid canvas").first()).toBeVisible();
      if (!mobile) {
        await page
          .locator(".sheet-grid .dvn-scroller")
          .first()
          .dblclick({ position: { x: 100, y: 50 } });
        await expect(page.locator(".gdg-input")).toBeVisible();
        await page.locator(".gdg-input").fill("5");
        await page.locator(".gdg-input").press("Enter");
        await expect(page.locator(".gdg-input")).toHaveCount(0);
        await expect(
          page.getByLabel("Cell address", { exact: true }),
        ).toHaveValue("A2");
        await selectCell(page, "A1");
        await expect(page.getByLabel("Selected cell result")).toHaveText(
          "A1: 5",
        );
      }
      await setCell(page, "A1", "10", "10");
      await setCell(page, "A2", "20", "20");
      await setCell(page, "B1", "=SUM(A1:A2)", "30");
      await setCell(page, "C1", "=B1*2", "60");
      await setCell(page, "A1", "15", "15");
      await selectCell(page, "C1");
      await expect(page.getByLabel("Selected cell result")).toHaveText(
        "C1: 70",
      );
      await selectCell(page, "A1");
      await page
        .getByRole("button", { name: "Move row down", exact: true })
        .click();
      await selectCell(page, "C2");
      await expect(page.getByLabel("Selected cell result")).toHaveText(
        "C2: 70",
      );
      await expect(page.getByLabel("Cell value or formula")).toHaveValue(
        "=(B2*2)",
      );
      await page
        .getByRole("button", { name: "Undo spreadsheet", exact: true })
        .click();
      await selectCell(page, "C1");
      await expect(page.getByLabel("Selected cell result")).toHaveText(
        "C1: 70",
      );
      await setCell(page, "E1", "=SEQUENCE(3,2)", "1");
      await selectCell(page, "F3");
      await expect(page.getByLabel("Selected cell result")).toHaveText("F3: 6");
      await setCell(page, "H1", "=IFERROR(1/0,99)", "99");
      await expect(page.getByText("All changes saved")).toBeVisible();
      await page.reload();
      await expect(page.locator(".sheet-grid canvas").first()).toBeVisible();
      await selectCell(page, "C1");
      await expect(page.getByLabel("Selected cell result")).toHaveText(
        "C1: 70",
      );
      await page
        .getByRole("button", { name: "Fullscreen spreadsheet", exact: true })
        .click();
      await expect(
        page.locator(".sheet-editor.editor-fullscreen"),
      ).toBeVisible();
      const fullscreenBounds = (await page
        .locator(".sheet-editor.editor-fullscreen")
        .boundingBox())!;
      const screen = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
      }));
      expect(fullscreenBounds.x).toBe(0);
      expect(fullscreenBounds.y).toBe(0);
      expect(fullscreenBounds.width).toBe(screen.width);
      expect(fullscreenBounds.height).toBe(screen.height);
      await setCell(page, "A1", "30", "30");
      await selectCell(page, "C1");
      await expect(page.getByLabel("Selected cell result")).toHaveText(
        "C1: 100",
      );
      await page
        .getByRole("button", { name: "Exit fullscreen", exact: true })
        .click();
      await expect(page.locator(".editor-fullscreen")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/spreadsheet-${mobile ? "mobile" : "desktop"}.png`,
      });
      expect(errors).toEqual([]);
    } finally {
      await context.close();
      await request.delete(`/api/documents/${id}`);
    }
  });

test("local formula worker continues offline through a full page reload and merges spreadsheet changes", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const id = await newDocument(page, request, `Offline grid ${Date.now()}`);
  const peerContext = await browser.newContext({ baseURL });
  const peer = await peerContext.newPage();
  try {
    await newBlock(page, "Sheet", "Offline budget");
    await setCell(page, "A1", "10", "10");
    await setCell(page, "B1", "=A1*3", "30");
    await expect(page.getByText("All changes saved")).toBeVisible();
    await peer.goto(`/#document=${id}`);
    await selectCell(peer, "B1");
    await expect(peer.getByLabel("Selected cell result")).toHaveText("B1: 30");
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
        timeout: 15000,
      })
      .toBe(true);
    await page.context().setOffline(true);
    await page.reload();
    await expect(page.locator(".sheet-grid canvas").first()).toBeVisible();
    await setCell(page, "A1", "21", "21");
    await selectCell(page, "B1");
    await expect(page.getByLabel("Selected cell result")).toHaveText("B1: 63");
    await setCell(peer, "C1", "8", "8");
    await page.context().setOffline(false);
    await expect(page.getByText("All changes saved")).toBeVisible();
    await selectCell(peer, "B1");
    await expect(peer.getByLabel("Selected cell result")).toHaveText("B1: 63");
    await selectCell(page, "C1");
    await expect(page.getByLabel("Selected cell result")).toHaveText("C1: 8");
  } finally {
    await page.context().setOffline(false);
    await peerContext.close();
    await request.delete(`/api/documents/${id}`);
  }
});
