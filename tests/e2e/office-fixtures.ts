import { expect, type Page, type APIRequestContext } from "@playwright/test";
export async function openBlockActions(page: Page) {
  const heading = page.locator(".office-block.is-active .block-heading");
  const overflow = heading.getByRole("button", {
    name: "More block actions",
    exact: true,
  });
  if (
    (await overflow.isVisible()) &&
    (await overflow.getAttribute("aria-expanded")) !== "true"
  )
    await overflow.click();
  return heading;
}
export async function clickBlockAction(page: Page, name: string) {
  const heading = await openBlockActions(page);
  await heading.getByRole("button", { name, exact: true }).click();
}
export async function newDocument(
  page: Page,
  request: APIRequestContext,
  name: string,
) {
  const response = await request.post("/api/documents", {
    data: { name, folderId: "" },
  });
  expect(response.ok()).toBe(true);
  const document = await response.json();
  await page.goto(`/#document=${document.id}`);
  await expect(
    page.getByRole("button", { name: "Add your first block" }),
  ).toBeVisible();
  return document.id as string;
}
export async function newBlock(page: Page, kind: string, name: string) {
  const first = await page
    .getByRole("button", { name: "Add your first block", exact: true })
    .count();
  await page
    .getByRole("button", {
      name: first ? "Add your first block" : "Add block from map",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(`^${kind}`) })
    .click();
  await page.locator(".office-block.is-active .block-title").fill(name);
  return (await page
    .locator(".office-block.is-active")
    .getAttribute("data-block-id")) as string;
}
export async function selectCell(page: Page, address: string) {
  const field = page.getByLabel("Cell address", { exact: true });
  await field.fill(address);
  await field.press("Enter");
}
export async function setCell(
  page: Page,
  address: string,
  input: string,
  expected?: string,
) {
  await selectCell(page, address);
  const field = page.getByLabel("Cell value or formula", { exact: true });
  await field.fill(input);
  await field.press("Enter");
  if (expected !== undefined)
    await expect(
      page.getByLabel("Selected cell result", { exact: true }),
    ).toHaveText(`${address}: ${expected}`);
}
