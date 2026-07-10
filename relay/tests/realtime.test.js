import assert from "node:assert/strict";
import test from "node:test";
import WebSocket from "ws";
import { RealtimeSession, RealtimeSessionManager } from "../lib/realtime.js";

test("expires a parked tool turn after one minute", () => {
  const manager = new RealtimeSessionManager({
    apiKey: "test",
    realtimeUrl: "wss://example.test",
    ticketStore: {},
    timeZone: "Europe/Rome",
  });
  let closed = false;
  const session = {
    rabbitId: "rabbit",
    publicId: "session",
    turn: { pending: true },
    lastUsed: 1,
    ttlMs: 300_000,
    close() { closed = true; },
  };
  manager.byRabbit.set(session.rabbitId, session);
  manager.byPublicId.set(session.publicId, session);

  manager.cleanup(60_002);

  assert.equal(closed, true);
  assert.equal(manager.byRabbit.size, 0);
  assert.equal(manager.byPublicId.size, 0);
});

test("creates a deterministic device function-call item before answering", async () => {
  const events = [];
  const session = new RealtimeSession({
    rabbitId: "rabbit",
    apiKey: "test",
    realtimeUrl: "wss://example.test",
    model: "gpt-realtime-2.1",
    voice: "marin",
    prompt: "test",
    language: "it",
    timeZone: "Europe/Rome",
    tools: [{ name: "move_ears", description: "move", parameters: { type: "object" }, exec: "forth" }],
    ticketStore: {},
    ttlMs: 75_000,
  });
  session.connect = async () => session;
  session.ws = {
    readyState: WebSocket.OPEN,
    send(raw) { events.push(JSON.parse(raw)); },
  };

  const payload = await session.beginForcedTool({
    text: "muovi le orecchie",
    audio: null,
    baseUrl: "http://relay",
    name: "move_ears",
    args: { left: 5, right: 0 },
  });
  assert.equal(payload.type, "call");
  assert.equal(payload.name, "move_ears");
  assert.deepEqual(payload.args, { left: 5, right: 0 });
  const functionItem = events.find((event) => event.item?.type === "function_call");
  assert.equal(functionItem.item.name, "move_ears");
  assert.deepEqual(JSON.parse(functionItem.item.arguments), { left: 5, right: 0 });
  assert.equal(events.some((event) => event.type === "response.create"), false);
});
