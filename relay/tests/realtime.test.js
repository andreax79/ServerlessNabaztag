import assert from "node:assert/strict";
import test from "node:test";
import { RealtimeSessionManager } from "../lib/realtime.js";

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
