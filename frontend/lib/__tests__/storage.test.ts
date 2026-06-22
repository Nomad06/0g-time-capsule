import { describe, it, expect, vi, beforeEach } from "vitest";

// We test only the error-path parsing — the happy path requires a live server.

describe("downloadFromStorage error handling", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws with HTTP status text when response is not JSON", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:     false,
      status: 502,
      text:   async () => "<html>Bad Gateway</html>",
      json:   async () => { throw new SyntaxError("not json"); },
    } as unknown as Response);

    const { downloadFromStorage } = await import("../storage");
    await expect(downloadFromStorage("0xdeadbeef" as `0x${string}`))
      .rejects.toThrow("Storage download failed");
  });

  it("throws with JSON error field when response is JSON error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   false,
      status: 404,
      text: async () => JSON.stringify({ error: "file not found" }),
      json: async () => ({ error: "file not found" }),
    } as unknown as Response);

    const { downloadFromStorage } = await import("../storage");
    await expect(downloadFromStorage("0xdeadbeef" as `0x${string}`))
      .rejects.toThrow("file not found");
  });
});
