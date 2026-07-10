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

function sessionInstructions({ prompt, language, timeZone }) {
  const now = new Intl.DateTimeFormat(language === "it" ? "it-IT" : "en-GB", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone,
  }).format(new Date());
  return [
    decodeHeader(prompt),
    `Data e ora locali: ${now}.`,
    `Lingua della conversazione: ${language || "it"}.`,
    "Rispondi in non più di due frasi, con stile naturale da parlato e senza Markdown.",
    "La parola di attivazione all'inizio dell'audio non fa parte della richiesta.",
    "Quando esprimi un gesto, un colore o un suono del corpo del coniglio, usa i tool fisici disponibili invece di limitarti a descriverlo. Non leggere ad alta voce le azioni tra asterischi.",
    "Se l'utente chiede un'azione fisica o nomina esplicitamente un tool disponibile, DEVI chiamare quel tool prima di parlare. Non affermare mai che un'azione è avvenuta senza un risultato positivo del tool.",
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
  constructor({ rabbitId, apiKey, realtimeUrl, model, voice, prompt, language, timeZone, tools, ticketStore, ttlMs }) {
    this.rabbitId = rabbitId;
    this.publicId = randomBytes(18).toString("base64url");
    this.apiKey = apiKey;
    this.realtimeUrl = realtimeUrl;
    this.model = model;
    this.voice = voice;
    this.prompt = prompt;
    this.language = language;
    this.timeZone = timeZone;
    this.tools = tools;
    this.toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
    this.ticketStore = ticketStore;
    this.ttlMs = ttlMs;
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
      tools: this.tools,
    });
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
    const url = new URL(this.realtimeUrl);
    url.searchParams.set("model", this.model);
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${this.apiKey}` } });
    this.ws = ws;

    const timer = setTimeout(() => {
      if (!ready.settled) {
        ready.settled = true;
        ready.reject(new Error("Realtime connection timed out"));
      }
    }, 15_000);
    ws.on("open", () => {
      this.send({
        type: "session.update",
        session: {
          type: "realtime",
          model: this.model,
          output_modalities: ["audio"],
          instructions: sessionInstructions(this),
          max_output_tokens: 512,
          tool_choice: "auto",
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
        },
      });
    });
    ws.on("message", (data) => this.onMessage(data));
    ws.on("error", (error) => {
      if (!ready.settled) {
        ready.settled = true;
        ready.reject(error);
      }
      this.failTurn(error);
    });
    ws.on("close", () => {
      this.closed = true;
      if (!ready.settled) {
        ready.settled = true;
        ready.reject(new Error("Realtime connection closed before setup completed"));
      }
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

  setToolChoice(toolChoice) {
    this.send({
      type: "session.update",
      session: { type: "realtime", tool_choice: toolChoice },
    });
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

  initializeTurn({ baseUrl, heard, state = "generating", callCount = 0, pending = null, deferredState = deferred() }) {
    this.lastUsed = Date.now();
    this.handledCalls.clear();
    this.turn = {
      deferred: deferredState,
      baseUrl,
      heard,
      transcript: "",
      ticket: null,
      callCount,
      state,
      responseHasAudio: false,
      pending,
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

    const initialToolChoice = this.tools.length ? "auto" : "none";
    this.setToolChoice(initialToolChoice);
    this.appendUserInput(text, audio);
    this.send({
      type: "response.create",
      response: {
        output_modalities: ["audio"],
        tool_choice: initialToolChoice,
      },
    });
    return result;
  }

  /**
   * Park a deterministic, relay-created function call in the Realtime
   * conversation. This avoids relying on model tool-choice compliance while
   * keeping the user turn and verified tool output in conversation memory.
   */
  async beginForcedTool({ text, audio, baseUrl, heard = "", name, args }) {
    await this.connect();
    if (this.turn) throw new Error("rabbit session is busy");
    if (!this.toolsByName.has(name)) throw new Error(`tool ${name} is not declared`);
    const callId = `call_${randomBytes(12).toString("base64url")}`;
    const argumentsJson = JSON.stringify(args || {});
    const pending = { callId, name, args: argumentsJson };
    this.initializeTurn({
      baseUrl,
      heard,
      state: "handling-tool",
      callCount: 1,
      pending,
      deferredState: null,
    });
    this.handledCalls.add(callId);
    this.appendUserInput(text, audio);
    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call",
        call_id: callId,
        name,
        arguments: argumentsJson,
        status: "completed",
      },
    });
    return {
      ok: 1,
      type: "call",
      sid: this.publicId,
      call_id: callId,
      name,
      args: args || {},
      args_b64: Buffer.from(argumentsJson, "utf8").toString("base64"),
    };
  }

  async continueWithToolResult(callId, output, baseUrl) {
    if (!this.turn?.pending || this.turn.pending.callId !== callId) throw new Error("unknown or expired tool call");
    this.lastUsed = Date.now();
    this.turn.deferred = deferred();
    this.turn.baseUrl = baseUrl || this.turn.baseUrl;
    this.turn.pending = null;
    const result = this.turn.deferred.promise;
    this.sendToolOutput(callId, output, "auto");
    return result;
  }

  sendToolOutput(callId, output, toolChoice = "auto") {
    this.turn.state = "generating";
    this.turn.responseHasAudio = false;
    this.send({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: String(output ?? "") },
    });
    this.setToolChoice(toolChoice);
    this.send({
      type: "response.create",
      response: { output_modalities: ["audio"], tool_choice: toolChoice },
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

    if (this.turn.callCount > 4) {
      this.failTurn(new Error("tool call limit exceeded"));
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
      this.failTurn(new Error(event.error?.message || "Realtime API error"));
      return;
    }
    if (!this.turn) return;

    if (event.type === "response.output_audio_transcript.delta" || event.type === "response.audio_transcript.delta") {
      this.turn.transcript += event.delta || "";
      return;
    }
    if (event.type === "response.output_audio.delta" || event.type === "response.audio.delta") {
      if (!this.turn.ticket) this.turn.ticket = this.ticketStore.createPcmEncoder(24000);
      this.turn.responseHasAudio = true;
      const bytes = Buffer.from(event.delta || "", "base64");
      if (!this.turn.ticket.encoder.stdin.destroyed) this.turn.ticket.encoder.stdin.write(bytes);
      this.resolvePayload({
        type: "answer",
        heard: this.turn.heard,
        // The HTTP response is released on the first audio delta; the final
        // transcript is not available yet and the firmware does not need it.
        answer: "",
        tts: this.ticketStore.urlFor(this.turn.ticket, this.turn.baseUrl),
      });
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
        this.lastUsed = Date.now();
        this.turn = null;
      } else if (event.response?.status === "failed" || event.response?.status === "cancelled") {
        this.failTurn(new Error(event.response?.status_details?.error?.message || `Realtime response ${event.response.status}`));
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
  constructor({ apiKey, realtimeUrl, ticketStore, timeZone, defaultTtlMs = 75_000 }) {
    this.apiKey = apiKey;
    this.realtimeUrl = realtimeUrl;
    this.ticketStore = ticketStore;
    this.timeZone = timeZone;
    this.defaultTtlMs = defaultTtlMs;
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
      tools,
      ticketStore: this.ticketStore,
      ttlMs: ttlMs || this.defaultTtlMs,
    };
    const signature = JSON.stringify({ model, voice, prompt, language, tools });
    let session = this.byRabbit.get(rabbitId);
    if (session && (session.closed || session.signature !== signature)) {
      if (session.turn) throw new Error("cannot reconfigure a busy session");
      this.remove(session);
      session = null;
    }
    if (!session) {
      session = new RealtimeSession(options);
      this.byRabbit.set(rabbitId, session);
      this.byPublicId.set(session.publicId, session);
    }
    session.ttlMs = ttlMs || this.defaultTtlMs;
    await session.connect();
    return session;
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
