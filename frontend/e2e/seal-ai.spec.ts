import { test, expect, connect } from "./fixtures/mock-wallet";

/**
 * Suite 3.6 — AI assist on the seal page.
 *
 * The /api/ai-assist route needs server-side AI creds, which a test runner
 * won't have. We mock the route so this verifies the UI wiring deterministically:
 * prompt → draft inserted into the message field, plaintext never leaving the client.
 */

test.describe("3.6 AI assist", () => {
  test("generated draft is inserted into the message field", async ({ page }) => {
    const DRAFT = "Dear future me, on this day I sealed a prediction.";

    await page.route("**/api/ai-assist", async (route) => {
      const body = route.request().postDataJSON();
      expect(body.prompt, "prompt sent to API").toBeTruthy();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ text: DRAFT, provider: "0g-compute" }),
      });
    });

    await page.goto("/seal");
    await connect(page);

    // Open the assistant, type a prompt, generate.
    await page.getByRole("button", { name: /AI assist/i }).click();
    await page
      .getByPlaceholder(/Describe what you want to seal/i)
      .fill("A letter to my daughter for her 18th birthday");
    await page.getByRole("button", { name: /Generate draft/i }).click();

    // Draft lands in the message textarea.
    await expect(page.getByPlaceholder("Write your message…")).toHaveValue(DRAFT, {
      timeout: 15_000,
    });
  });

  test("API failure surfaces an error toast, no crash", async ({ page }) => {
    await page.route("**/api/ai-assist", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "AI down" }) }),
    );
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/seal");
    await connect(page);
    await page.getByRole("button", { name: /AI assist/i }).click();
    await page.getByPlaceholder(/Describe what you want to seal/i).fill("anything");
    await page.getByRole("button", { name: /Generate draft/i }).click();

    await expect(page.getByText(/AI failed|AI down/i).first()).toBeVisible({ timeout: 15_000 });
    // Message field stays empty; app alive.
    await expect(page.getByPlaceholder("Write your message…")).toHaveValue("");
    expect(errors, errors.join("; ")).toEqual([]);
  });
});
