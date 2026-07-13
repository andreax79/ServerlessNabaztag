import { randomBytes } from "node:crypto";
import WebSocket from "ws";
import { executeHttpTool, realtimeToolDefinitions } from "./tools.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject, settled: false };
}

function decodeHeader(value) {
  if (!value) return "";
  try { return decodeURIComponent(value); } catch { return value; }
}

function localeOf(language) {
  const locale = String(language || "");
  if (locale.toLowerCase() === "uk") return "en";
  return /^[a-z]{2}(-[A-Za-z]{2})?$/.test(locale) ? locale : "en";
}

/**
 * Session instructions are written in English on purpose: they are meta
 * directives for the model, not user-facing text. The model answers in the
 * language the user speaks; the configured language is only the default.
 */
function sessionInstructions({ prompt, language, timeZone }) {
  const locale = localeOf(language);
  let now;
  try {
    now = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "long", timeZone }).format(new Date());
  } catch {
    now = new Date().toISOString();
  }
  return [
    decodeHeader(prompt),
    `Current local date and time: ${now}.`,
    `Default conversation language: ${locale}. Always answer in the language the user speaks.`,
    "You are speaking through a physical Nabaztag rabbit. Keep every answer to at most two short sentences of natural speech, with no Markdown, no emoji and no stage directions.",
    "If the audio begins with a wake word (the rabbit's name), it is not part of the request.",
    "For any request to act with the rabbit's body (ears, lights, sounds) or to read its live status, call the matching tool before answering. Base your answer only on the tool result: never claim a physical action happened unless the tool confirmed it, and never claim you are unable to act without a failed tool result.",
  ].filter(Boolean).join("\n\n");
}

function safeArguments(value) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export class RealtimeSession {
  constructor({ rabbitId, apiKey, realtimeUrl, model, voice, prompt, language, timeZone, reasoningEffort = "", tools, ticketStore, ttlMs, onToolTranscript = null }) {
    this.rabbitId = rabbitId;
    this.publicId = randomBytes(18).toString("base64url");
    this.apiKey = apiKey;
    this.realtimeUrl = realtimeUrl;
    this.model = model;
    this.voice = voice;
    this.prompt = prompt;
    this.language = language;
    this.timeZone = timeZone;
    this.reasoningEffort = reasoningEffort;
    this.tools = tools;
    this.toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
    this.ticketStore = ticketStore;
    this.ttlMs = ttlMs;
    this.onToolTranscript = onToolTranscript;
    this.lastUsed = Date.now();
    this.turn = null;
    this.ws = null;
    this.ready = null;
    this.closed = false;
    this.handledCalls = new Set();
  }

  get signature() {
    return JSON.stringify({
      model: this.model,
      voice: this.voice,
      prompt: this.prompt,
      language: this.language,
      reasoningEffort: this.reasoningEffort,
      tools: this.tools,
    });
  }

  sessionConfig() {
    const reasoning = /^gpt-realtime-2(?:[.-]|$)/.test(this.model) && this.reasoningEffort
      ? { effort: this.reasoningEffort }
      : undefined;
    return {
      type: "realtime",
      model: this.model,
      output_modalities: ["audio"],
      instructions: sessionInstructions(this),
      max_output_tokens: 512,
      tool_choice: "auto",
      // The device protocol has one pending-call slot, so physical tools must
      // be sequenced even though reasoning Realtime models support parallelism.
      parallel_tool_calls: false,
      ...(reasoning ? { reasoning } : {}),
      tools: realtimeToolDefinitions(this.tools),
      audio: {
        input: {
          format: { type: "audio/pcmu" },
          turn_detection: null,
        },
        output: {
          format: { type: "audio/pcm", rate: 24000 },
          voice: this.voice,
        },
      },
    };
  }

  async connect() {
    if (this.ready) return this.ready;
    const ready = deferred();
    this.ready = ready.promise.then(() => this);
    this._readyResolve = () => {
      if (!ready.settled) {
        ready.settled = true;
        ready.resolve();
      }
    };
    this._readyReject = (error) => {
      if (!ready.settled) {
        ready.settled = true;
        ready.reject(error);
      }
    };
    const url = new URL(this.realtimeUrl);
    url.searchParams.set("model", this.model);
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${this.apiKey}` } });
    this.ws = ws;

    const timer = setTimeout(() => this._readyReject(new Error("Realtime connection timed out")), 15_000);
    ws.on("open", () => {
      this.send({
        type: "session.update",
        session: this.sessionConfig(),
      });
    });
    ws.on("message", (data) => this.onMessage(data));
    ws.on("error", (error) => {
      this._readyReject(error);
      this.failTurn(error);
    });
    ws.on("close", () => {
      this.closed = true;
      this._readyReject(new Error("Realtime connection closed before setup completed"));
      this.failTurn(new Error("Realtime connection closed"));
    });

    try {
      await this.ready;
      return this;
    } finally {
      clearTimeout(timer);
    }
  }

  send(event) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error("Realtime socket is not open");
    this.ws.send(JSON.stringify(event));
  }

  resolvePayload(payload) {
    if (!this.turn?.deferred || this.turn.deferred.settled) return;
    this.turn.deferred.settled = true;
    this.turn.deferred.resolve({ ok: 1, ...payload });
  }

  failTurn(error) {
    if (!this.turn) return;
    if (this.turn.ticket?.encoder?.stdin && !this.turn.ticket.encoder.stdin.destroyed) {
      this.turn.ticket.encoder.stdin.end();
    }
    if (this.turn.deferred && !this.turn.deferred.settled) {
      this.turn.deferred.settled = true;
      this.turn.deferred.reject(error);
    }
    this.turn = null;
  }

  initializeTurn({ baseUrl, heard }) {
    this.lastUsed = Date.now();
    this.handledCalls.clear();
    this.turn = {
      deferred: deferred(),
      baseUrl,
      heard,
      transcript: "",
      ticket: null,
      callCount: 0,
      state: "generating",
      responseHasAudio: false,
      pending: null,
      toolName: "",
    };
  }

  appendUserInput(text, audio) {
    if (text) {
      this.send({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
      });
    } else {
      this.send({ type: "input_audio_buffer.clear" });
      for (let offset = 0; offset < audio.length; offset += 32_000) {
        this.send({
          type: "input_audio_buffer.append",
          audio: audio.subarray(offset, offset + 32_000).toString("base64"),
        });
      }
      this.send({ type: "input_audio_buffer.commit" });
    }
  }

  async beginTurn({ text, audio, baseUrl, heard = "" }) {
    await this.connect();
    if (this.turn) throw new Error("rabbit session is busy");
    this.initializeTurn({ baseUrl, heard });
    const result = this.turn.deferred.promise;
    this.appendUserInput(text, audio);
    this.send({
      type: "response.create",
      response: { output_modalities: ["audio"] },
    });
    return result;
  }

  async continueWithToolResult(callId, output, baseUrl) {
    if (!this.turn?.pending || this.turn.pending.callId !== callId) throw new Error("unknown or expired tool call");
    this.lastUsed = Date.now();
    this.turn.deferred = deferred();
    this.turn.baseUrl = baseUrl || this.turn.baseUrl;
    this.turn.pending = null;
    const result = this.turn.deferred.promise;
    this.sendToolOutput(callId, output);
    return result;
  }

  /**
   * Drop any commentary audio buffered before a tool call so the follow-up
   * response gets a fresh ticket and the rabbit never plays a half sentence
   * about an action that has not happened yet.
   */
  discardTicket() {
    if (this.turn?.ticket?.encoder?.stdin && !this.turn.ticket.encoder.stdin.destroyed) {
      this.turn.ticket.encoder.stdin.end();
    }
    if (this.turn) {
      this.turn.ticket = null;
      this.turn.responseHasAudio = false;
    }
  }

  /**
   * Return the tool output to the model and let it produce the next step:
   * either the spoken answer or a further tool call (session tool_choice
   * stays "auto"; the call-count guard bounds the chain).
   */
  sendToolOutput(callId, output, toolChoice = null) {
    this.turn.state = "generating";
    this.discardTicket();
    this.send({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: String(output ?? "") },
    });
    const response = { output_modalities: ["audio"] };
    if (toolChoice) response.tool_choice = toolChoice;
    this.send({
      type: "response.create",
      response,
    });
  }

  async handleFunctionCall(event) {
    const callId = event.call_id || event.item?.call_id;
    const name = event.name || event.item?.name;
    const args = event.arguments || event.item?.arguments || "{}";
    if (!this.turn || !callId || this.handledCalls.has(callId)) return;
    this.handledCalls.add(callId);
    this.turn.callCount += 1;
    this.turn.state = "handling-tool";
    this.turn.toolName = name || "";

    if (this.turn.callCount > 4) {
      // Force a final spoken answer instead of killing the whole turn.
      this.sendToolOutput(callId, "error: tool call limit reached for this request", "none");
      return;
    }
    const tool = this.toolsByName.get(name);
    if (!tool) {
      this.sendToolOutput(callId, `error: tool ${name || "<unknown>"} is not declared`);
      return;
    }

    if (tool.exec === "http") {
      try {
        const output = await executeHttpTool(tool, args);
        if (this.turn) this.sendToolOutput(callId, output);
      } catch (error) {
        if (this.turn) this.sendToolOutput(callId, `error: ${error.message}`);
      }
      return;
    }

    this.turn.pending = { callId, name, args };
    this.lastUsed = Date.now();
    this.discardTicket();
    this.resolvePayload({
      type: "call",
      sid: this.publicId,
      call_id: callId,
      name,
      args: safeArguments(args),
      args_b64: Buffer.from(args, "utf8").toString("base64"),
    });
  }

  onMessage(raw) {
    let event;
    try { event = JSON.parse(raw.toString()); } catch { return; }
    if (event.type === "session.updated") {
      // `this.ready` is replaced only once; resolve through the private hook below.
      this._readyResolve?.();
      return;
    }
    if (event.type === "error") {
      const error = new Error(event.error?.message || "Realtime API error");
      // Configuration errors arrive as protocol events, not WebSocket errors.
      // Reject the handshake immediately instead of masking them as a 15 s
      // connection timeout.
      this._readyReject?.(error);
      this.failTurn(error);
      return;
    }
    if (!this.turn) return;

    if (event.type === "response.output_audio_transcript.delta" || event.type === "response.audio_transcript.delta") {
      this.turn.transcript += event.delta || "";
      return;
    }
    if (event.type === "response.output_audio.delta" || event.type === "response.audio.delta") {
      // Buffer the audio, but do not resolve the HTTP payload yet:
      // gpt-realtime-2.1 often speaks a short commentary before emitting a
      // function call in the same response, so only response.done (or a
      // function call) can tell whether this turn is an answer or a call.
      if (!this.turn.ticket) this.turn.ticket = this.ticketStore.createPcmEncoder(24000);
      this.turn.responseHasAudio = true;
      const bytes = Buffer.from(event.delta || "", "base64");
      if (!this.turn.ticket.encoder.stdin.destroyed) this.turn.ticket.encoder.stdin.write(bytes);
      return;
    }
    if (event.type === "response.output_audio.done" || event.type === "response.audio.done") {
      if (this.turn.ticket?.encoder?.stdin && !this.turn.ticket.encoder.stdin.destroyed) this.turn.ticket.encoder.stdin.end();
      return;
    }
    if (event.type === "response.function_call_arguments.done") {
      this.handleFunctionCall(event).catch((error) => this.failTurn(error));
      return;
    }
    if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
      this.handleFunctionCall(event).catch((error) => this.failTurn(error));
      return;
    }
    if (event.type === "response.done") {
      // The documented response.done event contains complete function calls.
      // Treat it as the authoritative fallback and always ignore the done for
      // a tool-producing response. This also closes a race where a very fast
      // device tool result starts the next response before the previous done
      // event reaches us.
      const functionCall = event.response?.output?.find((item) => item?.type === "function_call");
      if (functionCall) {
        this.handleFunctionCall({ response_id: event.response?.id, item: functionCall })
          .catch((error) => this.failTurn(error));
        return;
      }
      if (this.turn.state === "handling-tool") return;
      if (this.turn.responseHasAudio) {
        if (this.turn.ticket?.encoder?.stdin && !this.turn.ticket.encoder.stdin.destroyed) this.turn.ticket.encoder.stdin.end();
        if (!this.turn.deferred.settled && this.turn.ticket) {
          this.resolvePayload({
            type: "answer",
            heard: this.turn.heard,
            answer: "",
            tts: this.ticketStore.urlFor(this.turn.ticket, this.turn.baseUrl),
          });
        }
        if (this.turn.toolName && this.turn.transcript && this.onToolTranscript) {
          this.onToolTranscript({
            rabbitId: this.rabbitId,
            name: this.turn.toolName,
            transcript: this.turn.transcript,
          });
        }
        this.lastUsed = Date.now();
        this.turn = null;
      } else if (event.response?.status === "failed" || event.response?.status === "cancelled") {
        this.failTurn(new Error(event.response?.status_details?.error?.message || `Realtime response ${event.response.status}`));
      } else {
        this.failTurn(new Error("Realtime response completed without audio or tool call"));
      }
    }
  }

  close() {
    this.closed = true;
    this.failTurn(new Error("session closed"));
    if (this.ws && this.ws.readyState < WebSocket.CLOSING) this.ws.close();
  }
}

export class RealtimeSessionManager {
  constructor({ apiKey, realtimeUrl, ticketStore, timeZone, reasoningEffort = "", maxSessions = 32, defaultTtlMs = 75_000, onToolTranscript = null }) {
    this.apiKey = apiKey;
    this.realtimeUrl = realtimeUrl;
    this.ticketStore = ticketStore;
    this.timeZone = timeZone;
    this.reasoningEffort = reasoningEffort;
    this.maxSessions = Number.isFinite(maxSessions) ? Math.max(1, maxSessions) : 32;
    this.defaultTtlMs = defaultTtlMs;
    this.onToolTranscript = onToolTranscript;
    this.byRabbit = new Map();
    this.byPublicId = new Map();
  }

  async get({ rabbitId, model, voice, prompt, language, tools, ttlMs }) {
    const options = {
      rabbitId,
      apiKey: this.apiKey,
      realtimeUrl: this.realtimeUrl,
      model,
      voice,
      prompt,
      language,
      timeZone: this.timeZone,
      reasoningEffort: this.reasoningEffort,
      tools,
      ticketStore: this.ticketStore,
      ttlMs: ttlMs || this.defaultTtlMs,
      onToolTranscript: this.onToolTranscript,
    };
    const signature = JSON.stringify({ model, voice, prompt, language, reasoningEffort: this.reasoningEffort, tools });
    let session = this.byRabbit.get(rabbitId);
    if (session && session.turn) {
      // The firmware always cancels its previous exchange before a new ask,
      // so a busy session here has lost its waiter (impatient re-press,
      // vanished rabbit, abandoned tool call). Replace it immediately
      // instead of answering "busy" until the 60 s cleanup.
      this.remove(session);
      session = null;
    }
    if (session && (session.closed || session.signature !== signature)) {
      this.remove(session);
      session = null;
    }
    if (!session) {
      if (this.byRabbit.size >= this.maxSessions) {
        const oldestIdle = [...this.byRabbit.values()]
          .filter((candidate) => !candidate.turn)
          .sort((a, b) => a.lastUsed - b.lastUsed)[0];
        if (!oldestIdle) throw new Error("relay session capacity reached");
        this.remove(oldestIdle);
      }
      session = new RealtimeSession(options);
      this.byRabbit.set(rabbitId, session);
      this.byPublicId.set(session.publicId, session);
    }
    session.ttlMs = ttlMs || this.defaultTtlMs;
    try {
      await session.connect();
      return session;
    } catch (error) {
      // Do not leave a permanently rejected session cached until its TTL.
      if (this.byRabbit.get(rabbitId) === session) this.remove(session);
      throw error;
    }
  }

  findByPublicId(id) {
    return this.byPublicId.get(id);
  }

  remove(session) {
    this.byRabbit.delete(session.rabbitId);
    this.byPublicId.delete(session.publicId);
    session.close();
  }

  cleanup(now = Date.now()) {
    for (const session of this.byRabbit.values()) {
      // A rabbit can disappear while a Forth tool is parked. Bound active
      // turns as well so one lost /tool-result never leaves a session busy.
      const maxIdle = session.turn ? 60_000 : session.ttlMs;
      if (now - session.lastUsed > maxIdle) this.remove(session);
    }
  }

  close() {
    for (const session of [...this.byRabbit.values()]) this.remove(session);
  }
}
