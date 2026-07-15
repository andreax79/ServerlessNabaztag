import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";

function safeEqualHex(a, b) {
  if (!/^[a-f0-9]{64}$/i.test(String(a)) || !/^[a-f0-9]{64}$/i.test(String(b))) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function signTicket(secret, id, expires) {
  return createHmac("sha256", secret).update(`${id}.${expires}`).digest("hex");
}

export function verifyTicket(secret, id, expires, signature, now = Date.now()) {
  const expiry = Number(expires);
  if (!id || !Number.isSafeInteger(expiry) || expiry < now) return false;
  return safeEqualHex(signTicket(secret, id, expiry), signature);
}

class AudioTicket {
  constructor(id, expires, maxBytes) {
    this.id = id;
    this.expires = expires;
    this.maxBytes = maxBytes;
    this.chunks = [];
    this.bytes = 0;
    this.done = false;
    this.error = null;
    this.subscribers = new Set();
    this.encoder = null;
  }

  append(chunk) {
    if (this.done || !chunk?.length) return;
    const value = Buffer.from(chunk);
    this.bytes += value.length;
    if (this.bytes > this.maxBytes) {
      this.fail(new Error("encoded audio exceeded the ticket size limit"));
      return;
    }
    this.chunks.push(value);
    for (const response of this.subscribers) response.write(value);
  }

  finish() {
    if (this.done) return;
    this.done = true;
    for (const response of this.subscribers) response.end();
    this.subscribers.clear();
  }

  fail(error) {
    if (this.done) return;
    this.error = error;
    this.done = true;
    for (const response of this.subscribers) response.end();
    this.subscribers.clear();
    if (this.encoder && !this.encoder.killed) this.encoder.kill();
  }

  subscribe(response) {
    for (const chunk of this.chunks) response.write(chunk);
    if (this.done) response.end();
    else this.subscribers.add(response);
    response.on("close", () => this.subscribers.delete(response));
  }
}

export class TicketStore {
  constructor({ secret, publicBaseUrl, ffmpegPath = "ffmpeg", ttlMs = 300_000, maxBytes = 4_000_000 }) {
    this.secret = secret;
    this.publicBaseUrl = publicBaseUrl;
    this.ffmpegPath = ffmpegPath;
    this.ttlMs = ttlMs;
    this.maxBytes = maxBytes;
    this.tickets = new Map();
  }

  create() {
    const id = randomBytes(18).toString("base64url");
    const expires = Date.now() + this.ttlMs;
    const ticket = new AudioTicket(id, expires, this.maxBytes);
    this.tickets.set(id, ticket);
    return ticket;
  }

  createBuffered(buffer) {
    const ticket = this.create();
    ticket.append(buffer);
    ticket.finish();
    return ticket;
  }

  createPcmEncoder(sampleRate = 24000) {
    const ticket = this.create();
    const child = spawn(this.ffmpegPath, [
      "-hide_banner", "-loglevel", "error",
      "-f", "s16le", "-ar", String(sampleRate), "-ac", "1", "-i", "pipe:0",
      "-codec:a", "libmp3lame", "-b:a", "64k", "-f", "mp3", "pipe:1",
    ], { stdio: ["pipe", "pipe", "pipe"] });
    ticket.encoder = child;

    let stderr = "";
    child.stdout.on("data", (chunk) => ticket.append(chunk));
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-2000); });
    // A missing/crashed FFmpeg can close the pipe while Realtime audio is
    // still arriving. Handle EPIPE on stdin so it cannot become an uncaught
    // stream error that terminates the relay process.
    child.stdin.on("error", (error) => ticket.fail(error));
    child.on("error", (error) => ticket.fail(error));
    child.on("close", (code) => {
      if (code === 0) ticket.finish();
      else ticket.fail(new Error(`ffmpeg exited with ${code}: ${stderr.trim()}`));
    });
    return ticket;
  }

  urlFor(ticket, requestBaseUrl) {
    const base = (this.publicBaseUrl || requestBaseUrl).replace(/\/$/, "");
    const sig = signTicket(this.secret, ticket.id, ticket.expires);
    return `${base}/v1/tts?sid=${encodeURIComponent(ticket.id)}&exp=${ticket.expires}&sig=${sig}`;
  }

  getSigned(id, expires, signature) {
    if (!verifyTicket(this.secret, id, expires, signature)) return null;
    const ticket = this.tickets.get(id);
    return ticket && ticket.expires >= Date.now() ? ticket : null;
  }

  cleanup(now = Date.now()) {
    for (const [id, ticket] of this.tickets) {
      if (ticket.expires < now) {
        ticket.fail(new Error("ticket expired"));
        this.tickets.delete(id);
      }
    }
  }
}
