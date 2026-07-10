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
