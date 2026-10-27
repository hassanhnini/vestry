// Critical user journey, run against the real app with the real on-device background-removal model.
import { expect, test, type Page } from "@playwright/test";

const fixtures = (n: string) => `e2e/fixtures/${n}`;

async function closetIds(page: Page) {
  await page.goto("/closet");
  await expect(page.getByText(/\d+ pieces/)).toBeVisible();
  const hrefs = await page.locator('main a[href^="/closet/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
  return new Set(hrefs.map((h) => h.split("/").pop()!));
}

test("demo journey: add → process → save → style → save outfit → plan → edit → delete", async ({ page, context }) => {
  // 1. Enter clearly-labelled demo mode, skip onboarding.
  await page.goto("/");
  await expect(page.getByText(/Demo mode: no account needed/)).toBeVisible();
  await page.getByRole("button", { name: "Start building my closet" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: "Skip" }).click();
  await page.waitForURL("**/add");

  // 2. Invalid file → helpful validation error.
  await page.setInputFiles('[data-testid="gallery-input"]', fixtures("notes.txt"));
  await expect(page.getByText("That file type isn't supported")).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();

  // 3. Bulk upload five photos; each is processed by the real background-removal model.
  const files = ["navy-tshirt.jpg", "jeans.jpg", "IMG_2041.jpg", "striped-shirt.jpg", "white-sneakers.jpg"];
  await page.setInputFiles('[data-testid="gallery-input"]', files.map(fixtures));
  const cards = page.locator('[data-testid="draft-card"]');
  await expect(cards).toHaveCount(5);
  // Photos are processed one at a time (predictable memory use on phones).
  for (let i = 0; i < 6; i++) {
    const active = await cards.evaluateAll((els) => els.filter((e) => ["preparing", "removing", "analyzing"].includes(e.getAttribute("data-status")!)).length);
    expect(active).toBeLessThanOrEqual(1);
    await page.waitForTimeout(1500);
  }
  await expect
    .poll(async () => (await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-status")))).every((s) => s === "ready"), {
      timeout: 480_000,
      intervals: [3000],
    })
    .toBe(true);

  // The cut-out is a real transparent image (not a decorative placeholder).
  const alpha = await page.locator('[data-testid="draft-card"] img').first().evaluate(async (img: HTMLImageElement) => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let transparent = 0, opaque = 0;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 10) transparent++;
      else if (d[i] > 245) opaque++;
    }
    return { transparent: transparent / (d.length / 4), opaque: opaque / (d.length / 4) };
  });
  expect(alpha.transparent).toBeGreaterThan(0.05);
  expect(alpha.opaque).toBeGreaterThan(0.3);

  // 4. Correct the predictions where needed.
  const fix = async (i: number, category: string, name: string) => {
    const card = cards.nth(i);
    await card.getByLabel("Category").selectOption(category);
    await card.getByLabel("Name").fill(name);
  };
  await fix(0, "t-shirt", "Navy tee");
  await fix(2, "dress", "Red midi dress");
  await fix(3, "shirt", "Striped shirt");
  await fix(4, "sneakers", "White sneakers");
  await expect(cards.nth(1).getByLabel("Category")).toHaveValue("jeans"); // from file name
  await page.getByRole("button", { name: /Save all \(5\)/ }).click();
  await expect.poll(async () => (await cards.evaluateAll((els) => els.map((e) => e.getAttribute("data-status")))).every((s) => s === "saved")).toBe(true);

  // 5. Persisted: survives a full reload.
  await page.reload();
  let ids = await closetIds(page);
  expect(ids.size).toBe(5);
  await page.reload();
  await expect(page.getByText("Red midi dress")).toBeVisible();

  // 6. Generate outfits — every piece must exist in the closet.
  await page.goto("/stylist");
  await page.getByRole("button", { name: "Create outfits" }).click();
  const results = page.locator('[data-testid="outfit-result"]');
  await expect(results.first()).toBeVisible();
  const used = await results.locator('a[href^="/closet/"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")!.split("/").pop()!));
  expect(used.length).toBeGreaterThan(0);
  for (const id of used) expect(ids.has(id)).toBe(true);
  await expect(results.first()).toContainText("On-device stylist");

  // 7. Save an outfit and verify it persists.
  await results.first().getByRole("button", { name: "Save", exact: true }).click();
  await expect(results.first().getByRole("button", { name: "Saved" })).toBeVisible();
  await page.goto("/outfits");
  await page.reload();
  const saved = page.locator('main a[href^="/outfits/"]');
  await expect(saved).toHaveCount(1);

  // 8. Plan it for today.
  await saved.first().click();
  const outfitName = (await page.locator("h1").first().innerText()).trim();
  await page.getByRole("button", { name: "Add to planner" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Add to (?!planner)/ }).click();
  await page.goto("/planner");
  await expect(page.getByText(outfitName).first()).toBeVisible();
  await expect(page.getByText("Today", { exact: true })).toBeVisible();

  // 9. Edit an item.
  await page.goto("/closet");
  await page.getByRole("link", { name: /Navy tee/ }).first().click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Name").fill("Navy cotton tee");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Navy cotton tee" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Navy cotton tee" })).toBeVisible();

  // 10. Delete an item (with confirmation).
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await page.waitForURL("**/closet");
  ids = await closetIds(page);
  expect(ids.size).toBe(4);

  // 11. Offline state is surfaced.
  await context.setOffline(true);
  await expect(page.getByText(/You're offline/)).toBeVisible();
  await context.setOffline(false);
});

test("empty states guide new users", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start building my closet" }).click();
  await page.waitForURL("**/onboarding");
  await page.getByRole("button", { name: "Skip" }).click();
  await page.goto("/closet");
  await expect(page.getByText("Your closet is waiting")).toBeVisible();
  await page.goto("/stylist");
  await expect(page.getByText("A few more pieces first")).toBeVisible();
  await page.goto("/planner");
  await expect(page.getByText("Plan your week in outfits")).toBeVisible();
  await page.goto("/outfits");
  await expect(page.getByText("No saved outfits yet")).toBeVisible();
});
