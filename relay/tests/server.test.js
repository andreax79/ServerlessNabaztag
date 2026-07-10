import assert from "node:assert/strict";
import test from "node:test";
import { createRelayServer } from "../server.js";

test("health is plain HTTP 200 and reports missing secrets", async (t) => {
  const sessions = { cleanup() {}, close() {} };
  const ticketStore = { cleanup() {}, getSigned() { return null; } };
  const { server } = createRelayServer({ apiKey: "", signingSecret: "", sessions, ticketStore });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/v1/health`, { redirect: "manual" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("location"), null);
  const payload = await response.json();
  assert.equal(payload.ok, 1);
  assert.equal(payload.configured, false);
  assert.equal(payload.model, "gpt-realtime-2.1");
});

test("syncs long prompts in a request body before starting a turn", async (t) => {
  const turns = [];
  const sessions = {
    cleanup() {},
    close() {},
    async get(options) {
      turns.push(options);
      return { async beginTurn() { return { ok: 1, type: "answer", tts: "http://example.test/audio" }; } };
    },
  };
  const ticketStore = { cleanup() {}, getSigned() { return null; } };
  const toolCache = { async get() { return []; } };
  const { server } = createRelayServer({
    apiKey: "test-key",
    signingSecret: "test-secret",
    sessions,
    ticketStore,
    toolCache,
    logger: { info() {} },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const prompt = "Personalità italiana: " + "molto utile e amichevole. ".repeat(100);

  const sync = await fetch(`${base}/v1/config`, {
    method: "POST",
    headers: { "x-rabbit-id": "00:19:db:9e:8a:6c" },
    body: prompt,
  });
  assert.deepEqual(await sync.json(), { ok: 1 });

  const ask = await fetch(`${base}/v1/ask?t=ciao`, {
    method: "POST",
    headers: { "x-rabbit-id": "00:19:db:9e:8a:6c" },
  });
  assert.equal((await ask.json()).ok, 1);
  assert.equal(turns.length, 1);
  assert.equal(turns[0].prompt, prompt);
});
