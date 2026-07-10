import assert from "node:assert/strict";
import test from "node:test";
import { buildForcedToolArgs, chooseForcedTool, createRelayServer } from "../server.js";

test("classifies only explicit rabbit device intents", () => {
  const tools = ["move_ears", "set_led", "play_sound", "rabbit_status"].map((name) => ({ name }));
  assert.equal(chooseForcedTool("Muovi le orecchie alla posizione cinque", tools), "move_ears");
  assert.equal(chooseForcedTool("Accendi la luce del naso di blu", tools), "set_led");
  assert.equal(chooseForcedTool("Fai un suono di conferma", tools), "play_sound");
  assert.equal(chooseForcedTool("Dimmi lo stato del coniglio e il meteo", tools), "rabbit_status");
  assert.equal(chooseForcedTool("Dimmi lo stato corrente del coniglio", tools), "rabbit_status");
  assert.equal(chooseForcedTool("Come sta il coniglio?", tools), "rabbit_status");
  assert.equal(chooseForcedTool("Qual è la posizione delle orecchie?", tools), "rabbit_status");
  assert.equal(chooseForcedTool("Quanto fa due più due?", tools), "");
  assert.equal(chooseForcedTool("Raccontami una storia sul coniglio", tools), "");
  assert.deepEqual(buildForcedToolArgs("move_ears", "sinistro cinque, destro zero"), { left: 5, right: 0 });
  assert.deepEqual(buildForcedToolArgs("move_ears", "muovi entrambe a sette"), { left: 7, right: 7 });
  assert.deepEqual(buildForcedToolArgs("move_ears", "porta il sinistro a sei"), { left: 6, right: 0 });
  assert.deepEqual(buildForcedToolArgs("move_ears", "porta il destro a quattro"), { left: 0, right: 4 });
  assert.deepEqual(buildForcedToolArgs("set_led", "accendi la luce del naso di verde"), { target: "nose", color: 0x00ff00 });
});

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
