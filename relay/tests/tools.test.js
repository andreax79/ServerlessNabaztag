import assert from "node:assert/strict";
import test from "node:test";
import { executeHttpTool, validateToolConfig } from "../lib/tools.js";

test("validates Forth and fixed-URL HTTP tools", () => {
  const tools = validateToolConfig({ tools: [
    { name: "move_ears", description: "Move", parameters: { type: "object", properties: {} }, exec: "forth" },
    { name: "notify", description: "Notify", parameters: { type: "object", properties: {} }, exec: "http", http: { url: "https://example.com/hook", method: "POST" } },
  ] });
  assert.equal(tools.length, 2);
  assert.throws(() => validateToolConfig({ tools: [{
    name: "unsafe", parameters: { type: "object" }, exec: "http",
    http: { url: "https://example.com/{{args}}" },
  }] }), /URL templates/);
});

test("HTTP tool substitutes arguments only in its body", async () => {
  const [tool] = validateToolConfig({ tools: [{
    name: "notify", description: "Notify", parameters: { type: "object" }, exec: "http",
    http: { url: "https://example.com/hook", body: "{\"payload\":{{args}}}" },
  }] });
  const output = await executeHttpTool(tool, "{\"value\":1}", async (url, options) => {
    assert.equal(url, "https://example.com/hook");
    assert.equal(options.body, "{\"payload\":{\"value\":1}}");
    return new Response("accepted", { status: 202 });
  });
  assert.deepEqual(JSON.parse(output), { ok: true, status: 202, body: "accepted" });
});
