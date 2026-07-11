import http from "node:http";
import { pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import { hasWakeWordAtStart, wavImaAdpcmToMuLaw } from "./lib/audio.js";
import { RealtimeSessionManager } from "./lib/realtime.js";
import { TicketStore } from "./lib/tickets.js";
import { ToolConfigCache } from "./lib/tools.js";

const VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"]);
const MODEL_NAME = /^[a-zA-Z0-9._-]{1,47}$/;
const RABBIT_ID = /^[a-zA-Z0-9:._-]{1,80}$/;

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export function loadConfig(overrides = {}) {
  const signingSecret = overrides.signingSecret ?? process.env.TTS_SIGNING_SECRET ?? "";
  return {
    host: process.env.HOST || "0.0.0.0",
    port: envNumber("PORT", 8787),
    apiKey: process.env.OPENAI_API_KEY || "",
    signingSecret,
    effectiveSigningSecret: signingSecret || randomBytes(32).toString("hex"),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
    toolsUrl: process.env.TOOLS_URL || "",
    realtimeUrl: process.env.OPENAI_REALTIME_URL || "wss://api.openai.com/v1/realtime",
    realtimeModel: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
    ttsModel: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
    voice: process.env.OPENAI_VOICE || "marin",
    timeZone: process.env.TIME_ZONE || "Europe/Rome",
    sessionTtlMs: envNumber("SESSION_TTL_SECONDS", 75) * 1000,
    maxAudioBytes: envNumber("MAX_AUDIO_BYTES", 1_048_576),
    ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
    ...overrides,
  };
}

class SlidingRateLimiter {
  constructor() {
    this.hits = new Map();
  }

  take(key, limit, windowMs) {
    const now = Date.now();
    const fresh = (this.hits.get(key) || []).filter((time) => now - time < windowMs);
    if (fresh.length >= limit) {
      this.hits.set(key, fresh);
      return false;
    }
    fresh.push(now);
    this.hits.set(key, fresh);
    return true;
  }
}

function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function header(req, name, maxLength = 8192) {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function decoded(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function normalizedLanguage(value) {
  const language = String(value || "").trim().slice(0, 8);
  return language.toLowerCase() === "uk" ? "en" : language;
}

async function readBody(req, maxBytes) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > maxBytes) throw new Error("request body is too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendJson(res, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "content-length": body.length,
    "cache-control": "no-store",
    connection: "close",
  });
  res.end(body);
}

function requestBaseUrl(req) {
  return `http://${req.headers.host || "127.0.0.1"}`;
}

/**
 * Transcription is used only as the wake-word gate: it is cheaper than a
 * Realtime turn on every loud noise. The conversation itself is audio to
 * audio and never depends on this text. `prompt` biases the decoder toward
 * the configured wake word, whatever the language.
 */
export async function transcribeAudio(wav, config, fetchImpl, language = "", prompt = "") {
  const form = new FormData();
  form.append("model", config.transcribeModel);
  form.append("file", new Blob([wav], { type: "audio/wav" }), "nabaztag.wav");
  const normalized = normalizedLanguage(language);
  const inputLanguage = /^[a-z]{2}$/i.test(normalized) ? normalized.toLowerCase() : "";
  if (inputLanguage) form.append("language", inputLanguage);
  if (prompt) form.append("prompt", String(prompt).slice(0, 200));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || `transcription failed with HTTP ${response.status}`);
    return String(payload.text || "");
  } finally {
    clearTimeout(timeout);
  }
}

async function synthesize(text, voice, config, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetchImpl("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.ttsModel,
        voice,
        input: text,
        response_format: "mp3",
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let message = `speech generation failed with HTTP ${response.status}`;
      try { message = (await response.json()).error?.message || message; } catch { /* no JSON body */ }
      throw new Error(message);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

function publicError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 500);
}

export function createRelayServer(overrides = {}) {
  const config = loadConfig(overrides);
  const fetchImpl = overrides.fetchImpl || fetch;
  const logger = overrides.logger || console;
  const ticketStore = overrides.ticketStore || new TicketStore({
    secret: config.effectiveSigningSecret,
    publicBaseUrl: config.publicBaseUrl,
    ffmpegPath: config.ffmpegPath,
  });
  const toolCache = overrides.toolCache || new ToolConfigCache({ fetchImpl });
  const sessions = overrides.sessions || new RealtimeSessionManager({
    apiKey: config.apiKey,
    realtimeUrl: config.realtimeUrl,
    ticketStore,
    timeZone: config.timeZone,
    defaultTtlMs: config.sessionTtlMs,
    onToolTranscript: ({ name, transcript }) => {
      logger.info(`[relay] tool confirmation ${name}: ${JSON.stringify(String(transcript).slice(0, 300))}`);
    },
  });
  // The MT-200 firmware has a very small TCP send window. Keep the long,
  // editable personality prompt in the POST body of a separate config sync
  // instead of repeating it in an HTTP header for every audio turn.
  const promptsByRabbit = overrides.promptsByRabbit || new Map();
  const limiter = new SlidingRateLimiter();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", requestBaseUrl(req));
    try {
      if (req.method === "GET" && url.pathname === "/v1/health") {
        sendJson(res, {
          ok: 1,
          configured: Boolean(config.apiKey && config.signingSecret),
          model: config.realtimeModel,
          voice: config.voice,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/tts") {
        const ticket = ticketStore.getSigned(
          url.searchParams.get("sid"),
          url.searchParams.get("exp"),
          url.searchParams.get("sig"),
        );
        res.writeHead(200, {
          "content-type": "audio/mpeg",
          "cache-control": "no-store",
          connection: "close",
        });
        if (!ticket) res.end();
        else {
          logger.info("[relay] signed TTS stream opened");
          ticket.subscribe(res);
        }
        return;
      }

      if (!config.apiKey || !config.signingSecret) throw new Error("relay secrets are not configured");

      if (req.method === "POST" && url.pathname === "/v1/config") {
        const rabbitId = header(req, "x-rabbit-id", 80);
        if (!RABBIT_ID.test(rabbitId)) throw new Error("missing or invalid X-Rabbit-Id");
        if (!limiter.take(`${rabbitId}:config`, 30, 60_000)) throw new Error("rate limit exceeded");
        const prompt = (await readBody(req, 8192)).toString("utf8");
        promptsByRabbit.set(rabbitId, prompt);
        logger.info("[relay] non-secret rabbit configuration synced");
        sendJson(res, { ok: 1 });
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/ask") {
        const rabbitId = header(req, "x-rabbit-id", 80);
        if (!RABBIT_ID.test(rabbitId)) throw new Error("missing or invalid X-Rabbit-Id");
        const mode = url.searchParams.get("mode") === "wake" ? "wake" : "button";
        const limit = mode === "wake" ? 6 : 20;
        if (!limiter.take(`${rabbitId}:${mode}`, limit, 60_000)) throw new Error("rate limit exceeded");

        const text = url.searchParams.get("t")?.slice(0, 4000) || "";
        const body = text ? Buffer.alloc(0) : await readBody(req, config.maxAudioBytes);
        if (!text && !body.length) throw new Error("audio body is empty");

        const modelHeader = header(req, "x-model", 80);
        const model = MODEL_NAME.test(modelHeader) ? modelHeader : config.realtimeModel;
        const voiceHeader = header(req, "x-voice", 24);
        const voice = VOICES.has(voiceHeader) ? voiceHeader : config.voice;
        const language = normalizedLanguage(url.searchParams.get("lang"));
        const prompt = promptsByRabbit.has(rabbitId)
          ? promptsByRabbit.get(rabbitId)
          : decoded(header(req, "x-prompt", 8192));
        const toolsUrl = decoded(header(req, "x-tools-url", 2048)) || config.toolsUrl;
        const tools = await toolCache.get(toolsUrl);

        let heard = text;
        if (mode === "wake") {
          const wake = (url.searchParams.get("wake") || "nabaztag").slice(0, 40);
          if (!text) heard = await transcribeAudio(body, config, fetchImpl, language, wake);
          if (!hasWakeWordAtStart(heard, wake, 2)) {
            sendJson(res, { ok: 0, reason: "no-wake" });
            return;
          }
        }
        logger.info(`[relay] accepted ${mode} turn with ${tools.length} tools`);
        const ttlMs = clamp(header(req, "x-session-ttl", 8), 15, 300, config.sessionTtlMs / 1000) * 1000;
        const audio = text ? null : wavImaAdpcmToMuLaw(body);

        const session = await sessions.get({ rabbitId, model, voice, prompt, language, tools, ttlMs });
        const payload = await session.beginTurn({ text, audio, heard, baseUrl: requestBaseUrl(req) });
        const outcome = payload.type === "call" ? `call:${payload.name}` : (payload.type || payload.reason || "an error");
        logger.info(`[relay] ${mode} turn produced ${outcome}`);
        sendJson(res, payload);
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/tool-result") {
        const sid = url.searchParams.get("sid") || "";
        const callId = url.searchParams.get("call_id") || "";
        const session = sessions.findByPublicId(sid);
        if (!session) throw new Error("unknown or expired session");
        const output = (await readBody(req, 64_000)).toString("utf8");
        logger.info(`[relay] device tool output: ${JSON.stringify(output.slice(0, 500))}`);
        const payload = await session.continueWithToolResult(callId, output, requestBaseUrl(req));
        const outcome = payload.type === "call" ? `call:${payload.name}` : (payload.type || "an error");
        logger.info(`[relay] tool result produced ${outcome}`);
        sendJson(res, payload);
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/say") {
        const text = (await readBody(req, 16_000)).toString("utf8").trim();
        if (!text) throw new Error("text body is empty");
        const requestedVoice = url.searchParams.get("voice") || config.voice;
        const voice = VOICES.has(requestedVoice) ? requestedVoice : config.voice;
        const mp3 = await synthesize(text, voice, config, fetchImpl);
        const ticket = ticketStore.createBuffered(mp3);
        sendJson(res, { ok: 1, tts: ticketStore.urlFor(ticket, requestBaseUrl(req)) });
        return;
      }

      sendJson(res, { ok: 0, err: "not found" });
    } catch (error) {
      sendJson(res, { ok: 0, err: publicError(error) });
    }
  });

  const cleanup = setInterval(() => {
    sessions.cleanup();
    ticketStore.cleanup();
  }, 15_000);
  cleanup.unref();
  server.on("close", () => {
    clearInterval(cleanup);
    sessions.close();
  });
  return { server, config, sessions, ticketStore, promptsByRabbit };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server, config } = createRelayServer();
  server.listen(config.port, config.host, () => {
    console.log(`Nabaztag relay listening on http://${config.host}:${config.port}`);
  });
}
