import type { Page, WebSocketRoute } from "@playwright/test";
// Browser offline emulation can leave an existing WebSocket alive. Explicitly
// partition the content transport so these tests prove offline reconciliation.
export async function partitionableSession(page: Page) {
  let paused = false;
  let pairs: { client: WebSocketRoute; server: WebSocketRoute }[] = [];
  await page.routeWebSocket("**/api/documents/*/ws", async (client) => {
    if (paused) {
      await client.close({ code: 1001, reason: "Test network partition" });
      return;
    }
    pairs.push({ client, server: client.connectToServer() });
  });
  return {
    pause: async () => {
      paused = true;
      const active = pairs;
      pairs = [];
      await Promise.all(
        active.flatMap((pair) => [
          pair.client.close({ code: 1001, reason: "Test network partition" }),
          pair.server.close({ code: 1001, reason: "Test network partition" }),
        ]),
      );
    },
    resume: async () => {
      paused = false;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
    },
  };
}
