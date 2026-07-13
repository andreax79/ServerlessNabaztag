import assert from "node:assert/strict";
import test from "node:test";
import WebSocket from "ws";
import { RealtimeSession, RealtimeSessionManager } from "../lib/realtime.js";

function stubSession(tools) {
  const events = [];
  const tickets = [];
  const session = new RealtimeSession({
    rabbitId: "rabbit",
    apiKey: "test",
    realtimeUrl: "wss://example.test",
    model: "gpt-realtime-2.1",
    voice: "marin",
    prompt: "test",
    language: "it",
    timeZone: "Europe/Rome",
    reasoningEffort: "low",
    tools,
    ticketStore: {
      createPcmEncoder() {
        const ticket = { ended: 0, encoder: { stdin: { destroyed: false, write() {}, end() { ticket.ended += 1; } } } };
        tickets.push(ticket);
        return ticket;
      },
      urlFor() { return "http://relay/v1/tts?sid=ticket"; },
    },
    ttlMs: 75_000,
  });
  session.connect = async () => session;
  session.ws = {
    readyState: WebSocket.OPEN,
    send(raw) { events.push(JSON.parse(raw)); },
  };
  return { session, events, tickets };
}

test("session configuration sequences tools and uses low reasoning", () => {
  const { session } = stubSession([]);
  const config = session.sessionConfig();
  assert.equal(config.tool_choice, "auto");
  assert.equal(config.parallel_tool_calls, false);
  assert.deepEqual(config.reasoning, { effort: "low" });
});

function audioDelta() {
  return JSON.stringify({ type: "response.output_audio.delta", delta: Buffer.from([0, 0]).toString("base64") });
}

function responseDone() {
  return JSON.stringify({ type: "response.done", response: { status: "completed" } });
}

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

test("session capacity evicts the oldest idle session", async (t) => {
  const manager = new RealtimeSessionManager({
    apiKey: "test",
    realtimeUrl: "wss://example.test",
    ticketStore: {},
    timeZone: "Europe/Rome",
    maxSessions: 1,
  });
  let closed = false;
  const old = {
    rabbitId: "old",
    publicId: "old-session",
    turn: null,
    lastUsed: 1,
    ttlMs: 75_000,
    close() { closed = true; },
  };
  manager.byRabbit.set(old.rabbitId, old);
  manager.byPublicId.set(old.publicId, old);
  const original = RealtimeSession.prototype.connect;
  RealtimeSession.prototype.connect = async function stubConnect() { return this; };
  t.after(() => { RealtimeSession.prototype.connect = original; });

  await manager.get({
    rabbitId: "new", model: "gpt-realtime-2.1", voice: "marin",
    prompt: "", language: "en", tools: [], ttlMs: 75_000,
  });
  assert.equal(closed, true);
  assert.equal(manager.byRabbit.has("old"), false);
  assert.equal(manager.byRabbit.has("new"), true);
});

test("a new ask replaces a session stuck in an abandoned turn", async (t) => {
  const manager = new RealtimeSessionManager({
    apiKey: "test",
    realtimeUrl: "wss://example.test",
    ticketStore: {},
    timeZone: "Europe/Rome",
  });
  let closed = false;
  const stuck = {
    rabbitId: "rabbit",
    publicId: "stuck",
    turn: { pending: { callId: "call_lost" } },
    lastUsed: Date.now(),
    ttlMs: 75_000,
    close() { closed = true; },
  };
  manager.byRabbit.set(stuck.rabbitId, stuck);
  manager.byPublicId.set(stuck.publicId, stuck);

  const original = RealtimeSession.prototype.connect;
  RealtimeSession.prototype.connect = async function stubConnect() { return this; };
  t.after(() => { RealtimeSession.prototype.connect = original; });

  const session = await manager.get({
    rabbitId: "rabbit",
    model: "gpt-realtime-2.1",
    voice: "marin",
    prompt: "",
    language: "it",
    tools: [],
    ttlMs: 75_000,
  });

  assert.equal(closed, true, "the stuck session must be closed");
  assert.notEqual(session.publicId, "stuck");
  assert.equal(session.turn, null, "the fresh session must accept the new turn");
  assert.equal(manager.byPublicId.has("stuck"), false);
});

test("turns never restrict the model's own tool choice", async () => {
  const { session, events } = stubSession([
    { name: "rabbit_status", description: "status", parameters: { type: "object" }, exec: "forth" },
  ]);

  const answer = session.beginTurn({ text: "Tell me a story", audio: null, baseUrl: "http://relay" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(events.map((event) => event.type), ["conversation.item.create", "response.create"]);
  const response = events.at(-1).response;
  assert.equal("tool_choice" in response, false);
  assert.equal("instructions" in response, false);
  assert.equal(events.some((event) => event.type === "session.update"), false);

  session.resolvePayload({ type: "answer" });
  assert.deepEqual(await answer, { ok: 1, type: "answer" });
});

test("forwards a model-initiated Forth tool call to the rabbit and resumes", async () => {
  const { session, events } = stubSession([
    { name: "move_ears", description: "move", parameters: { type: "object" }, exec: "forth" },
  ]);

  const turn = session.beginTurn({ text: "please move your ears to three", audio: null, baseUrl: "http://relay" });
  await new Promise((resolve) => setImmediate(resolve));
  session.onMessage(JSON.stringify({
    type: "response.function_call_arguments.done",
    call_id: "call_1",
    name: "move_ears",
    arguments: "{\"left\":3,\"right\":3}",
  }));

  const payload = await turn;
  assert.equal(payload.type, "call");
  assert.equal(payload.name, "move_ears");
  assert.deepEqual(payload.args, { left: 3, right: 3 });
  assert.equal(Buffer.from(payload.args_b64, "base64").toString("utf8"), "{\"left\":3,\"right\":3}");

  const continuation = session.continueWithToolResult("call_1", "ok: ears at left=3 right=3", "http://relay");
  const output = events.find((event) => event.item?.type === "function_call_output");
  assert.equal(output.item.call_id, "call_1");
  assert.equal(output.item.output, "ok: ears at left=3 right=3");
  const response = events.at(-1);
  assert.equal(response.type, "response.create");
  assert.equal("tool_choice" in response.response, false, "tool chaining must stay possible");
  assert.equal("instructions" in response.response, false, "no hardcoded per-language coaching");

  session.onMessage(audioDelta());
  session.onMessage(responseDone());
  const answer = await continuation;
  assert.equal(answer.type, "answer");
  assert.equal(answer.tts, "http://relay/v1/tts?sid=ticket");
});

test("commentary audio before a function call still resolves as a call", async () => {
  const { session, events, tickets } = stubSession([
    { name: "move_ears", description: "move", parameters: { type: "object" }, exec: "forth" },
  ]);

  const turn = session.beginTurn({ text: "move your ears", audio: null, baseUrl: "http://relay" });
  await new Promise((resolve) => setImmediate(resolve));
  // gpt-realtime-2.1 narrates before acting: audio deltas arrive first…
  session.onMessage(audioDelta());
  session.onMessage(audioDelta());
  // …then the function call lands in the same response.
  session.onMessage(JSON.stringify({
    type: "response.function_call_arguments.done",
    call_id: "call_9",
    name: "move_ears",
    arguments: "{\"left\":1,\"right\":1}",
  }));

  const payload = await turn;
  assert.equal(payload.type, "call", "the turn must not be released as an answer by commentary audio");
  assert.equal(payload.name, "move_ears");
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].ended, 1, "the commentary ticket must be discarded");
  assert.equal(session.turn.ticket, null, "the follow-up response must get a fresh ticket");
  assert.equal(events.some((event) => event.type === "session.update"), false);
});

test("response.done is a function-call fallback and cannot cancel its continuation", async () => {
  const { session } = stubSession([
    { name: "set_led", description: "light", parameters: { type: "object" }, exec: "forth" },
  ]);
  const doneWithCall = JSON.stringify({
    type: "response.done",
    response: {
      id: "resp_tool",
      status: "completed",
      output: [{ type: "function_call", call_id: "call_done", name: "set_led", arguments: "{\"target\":\"nose\",\"color\":255}" }],
    },
  });

  const turn = session.beginTurn({ text: "blue nose", audio: null, baseUrl: "http://relay" });
  await new Promise((resolve) => setImmediate(resolve));
  session.onMessage(doneWithCall);
  assert.equal((await turn).type, "call");

  const continuation = session.continueWithToolResult("call_done", "ok: nose LED override=255", "http://relay");
  // Simulate the previous response.done arriving after the fast tool result.
  session.onMessage(doneWithCall);
  assert.ok(session.turn, "the continuation must remain active");
  session.onMessage(audioDelta());
  session.onMessage(responseDone());
  assert.equal((await continuation).type, "answer");
});

test("undeclared tools are answered with an error output, not a crash", async () => {
  const { session, events } = stubSession([]);
  const turn = session.beginTurn({ text: "hello", audio: null, baseUrl: "http://relay" });
  await new Promise((resolve) => setImmediate(resolve));

  session.onMessage(JSON.stringify({
    type: "response.function_call_arguments.done",
    call_id: "call_x",
    name: "does_not_exist",
    arguments: "{}",
  }));
  await new Promise((resolve) => setImmediate(resolve));

  const output = events.find((event) => event.item?.type === "function_call_output");
  assert.match(output.item.output, /^error: tool does_not_exist is not declared$/);

  session.resolvePayload({ type: "answer" });
  assert.equal((await turn).type, "answer");
});

test("caps runaway tool chains with a final spoken answer", async () => {
  const { session, events } = stubSession([
    { name: "move_ears", description: "move", parameters: { type: "object" }, exec: "forth" },
  ]);
  const turn = session.beginTurn({ text: "loop", audio: null, baseUrl: "http://relay" });
  await new Promise((resolve) => setImmediate(resolve));
  session.turn.callCount = 4;

  session.onMessage(JSON.stringify({
    type: "response.function_call_arguments.done",
    call_id: "call_5",
    name: "move_ears",
    arguments: "{}",
  }));
  await new Promise((resolve) => setImmediate(resolve));

  const output = events.find((event) => event.item?.type === "function_call_output");
  assert.match(output.item.output, /tool call limit/);
  assert.equal(events.at(-1).response.tool_choice, "none");

  session.resolvePayload({ type: "answer" });
  assert.equal((await turn).type, "answer");
});
