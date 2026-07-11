import assert from "node:assert/strict";
import test from "node:test";
import { createRelayServer, transcribeAudio } from "../server.js";

function makeImaWav(data) {
  const fmtSize = 20;
  const header = Buffer.alloc(12 + 8 + fmtSize + 8);
  header.write("RIFF", 0);
  header.writeUInt32LE(header.length + data.length - 8, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(fmtSize, 16);
  header.writeUInt16LE(0x11, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(4000, 28);
  header.writeUInt16LE(data.length, 32);
  header.writeUInt16LE(4, 34);
  header.writeUInt16LE(2, 36);
  header.writeUInt16LE((data.length - 4) * 2 + 1, 38);
  header.write("data", 40);
  header.writeUInt32LE(data.length, 44);
  return Buffer.concat([header, data]);
}

function testServer(t, overrides) {
  const { server } = createRelayServer({
    apiKey: "test-key",
    signingSecret: "test-secret",
    logger: { info() {} },
    ...overrides,
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      t.after(() => new Promise((done) => server.close(done)));
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

test("transcription biases toward the configured wake word, not a fixed language", async () => {
  let submitted;
  const text = await transcribeAudio(
    Buffer.from("RIFF"),
    { transcribeModel: "gpt-4o-mini-transcribe", apiKey: "test" },
    async (_url, options) => {
      submitted = options.body;
      return { ok: true, async json() { return { text: "nabaztag quelle heure est-il" }; } };
    },
    "fr",
    "nabaztag",
  );
  assert.equal(text, "nabaztag quelle heure est-il");
  assert.equal(submitted.get("language"), "fr");
  assert.equal(submitted.get("prompt"), "nabaztag");
});

test("maps the legacy English code to ISO-639-1 before transcription", async () => {
  let submitted;
  await transcribeAudio(
    Buffer.from("RIFF"),
    { transcribeModel: "gpt-4o-mini-transcribe", apiKey: "test" },
    async (_url, options) => {
      submitted = options.body;
      return { ok: true, async json() { return { text: "nabaztag" }; } };
    },
    "uk",
    "nabaztag",
  );
  assert.equal(submitted.get("language"), "en");
});

test("button turns never call the transcription API", async (t) => {
  const turns = [];
  const sessions = {
    cleanup() {},
    close() {},
    async get(options) {
      turns.push(options);
      return {
        async beginTurn({ audio }) {
          assert.ok(audio && audio.length > 0, "audio must reach the realtime session");
          return { ok: 1, type: "answer", tts: "http://example.test/audio" };
        },
      };
    },
  };
  const base = await testServer(t, {
    sessions,
    ticketStore: { cleanup() {}, getSigned() { return null; } },
    toolCache: { async get() { return [{ name: "move_ears", exec: "forth" }]; } },
    async fetchImpl(url) {
      throw new Error(`unexpected upstream HTTP call: ${url}`);
    },
  });
  const response = await fetch(`${base}/v1/ask?lang=uk&mode=button`, {
    method: "POST",
    headers: { "x-rabbit-id": "00:19:db:9e:8a:6c", "content-type": "audio/wav" },
    body: makeImaWav(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x11, 0x11])),
  });
  const payload = await response.json();
  assert.deepEqual(payload, { ok: 1, type: "answer", tts: "http://example.test/audio" });
  assert.equal(turns.length, 1);
  assert.equal(turns[0].language, "en", "legacy English settings must be normalized before the Realtime session");
});

test("wake mode still gates on the wake word", async (t) => {
  const turns = [];
  const sessions = {
    cleanup() {},
    close() {},
    async get() {
      return { async beginTurn(options) { turns.push(options); return { ok: 1, type: "answer", tts: "http://tts" }; } };
    },
  };
  const base = await testServer(t, {
    sessions,
    ticketStore: { cleanup() {}, getSigned() { return null; } },
    toolCache: { async get() { return []; } },
    async fetchImpl(url) {
      throw new Error(`unexpected upstream HTTP call: ${url}`);
    },
  });
  const rejected = await fetch(`${base}/v1/ask?mode=wake&wake=nabaztag&t=${encodeURIComponent("what time is it")}`, {
    method: "POST",
    headers: { "x-rabbit-id": "wake-test" },
  });
  assert.deepEqual(await rejected.json(), { ok: 0, reason: "no-wake" });
  assert.equal(turns.length, 0);

  const accepted = await fetch(`${base}/v1/ask?mode=wake&wake=nabaztag&t=${encodeURIComponent("nabastag what time is it")}`, {
    method: "POST",
    headers: { "x-rabbit-id": "wake-test" },
  });
  assert.equal((await accepted.json()).ok, 1);
  assert.equal(turns.length, 1);
});

test("health is plain HTTP 200 and reports missing secrets", async (t) => {
  const base = await testServer(t, {
    apiKey: "",
    signingSecret: "",
    sessions: { cleanup() {}, close() {} },
    ticketStore: { cleanup() {}, getSigned() { return null; } },
  });
  const response = await fetch(`${base}/v1/health`, { redirect: "manual" });
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
  const base = await testServer(t, {
    sessions,
    ticketStore: { cleanup() {}, getSigned() { return null; } },
    toolCache: { async get() { return []; } },
  });
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
