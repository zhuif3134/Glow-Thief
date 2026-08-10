import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Glow Thief game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>夜光小贼 · Glow Thief<\/title>/i);
  assert.match(html, /夜光小贼/);
  assert.match(html, /GLOW THIEF/);
  assert.match(html, /游戏区域：使用 WASD 或方向键移动并决定冲刺方向，空格直线冲刺/);
  assert.match(html, /开始遛影子/);
});

test("keeps the expected controls and local-only persistence", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /window\.localStorage\.getItem\("glow-thief-best"\)/);
  assert.match(page, /event\.code === "Space"/);
  assert.match(page, /event\.code === "KeyR"/);
  assert.match(page, /event\.code === "KeyQ"/);
  assert.match(page, /event\.code === "Escape" \|\| event\.code === "KeyP"/);
  assert.match(page, /new AudioCtor\(\)/);
  assert.doesNotMatch(page, /fetch\(|XMLHttpRequest|WebSocket/);
});
