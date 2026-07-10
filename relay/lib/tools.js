const TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/;
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

export function validateToolConfig(input) {
  assertPlainObject(input, "tool configuration");
  if (!Array.isArray(input.tools)) throw new Error("tool configuration must contain a tools array");
  if (input.tools.length > 32) throw new Error("at most 32 tools are allowed");

  const names = new Set();
  const tools = input.tools.filter((source) => source?.enabled !== false).map((source) => {
    assertPlainObject(source, "tool");
    if (!TOOL_NAME.test(source.name || "")) throw new Error(`invalid tool name: ${source.name || "<empty>"}`);
    if (names.has(source.name)) throw new Error(`duplicate tool name: ${source.name}`);
    names.add(source.name);
    if (!['forth', 'http'].includes(source.exec)) throw new Error(`invalid executor for ${source.name}`);
    assertPlainObject(source.parameters, `parameters for ${source.name}`);

    const tool = {
      name: source.name,
      description: String(source.description || "").slice(0, 1024),
      parameters: source.parameters,
      exec: source.exec,
    };

    if (source.exec === "http") {
      assertPlainObject(source.http, `http configuration for ${source.name}`);
      if (String(source.http.url || "").includes("{{")) {
        throw new Error(`URL templates are not allowed for ${source.name}`);
      }
      const url = new URL(source.http.url);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`unsupported URL protocol for ${source.name}`);
      const method = String(source.http.method || "POST").toUpperCase();
      if (!HTTP_METHODS.has(method)) throw new Error(`unsupported HTTP method for ${source.name}`);
      tool.http = {
        url: url.toString(),
        method,
        body: source.http.body == null ? "{{args}}" : String(source.http.body),
        headers: source.http.headers && typeof source.http.headers === "object" ? source.http.headers : {},
      };
    }
    return tool;
  });

  return tools;
}

export function realtimeToolDefinitions(tools) {
  return tools.map(({ name, description, parameters }) => ({
    type: "function",
    name,
    description,
    parameters,
  }));
}

async function readLimited(response, maxBytes = 256_000) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maxBytes) throw new Error("HTTP tool response is too large");
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function executeHttpTool(tool, args, fetchImpl = fetch) {
  if (tool.exec !== "http" || !tool.http) throw new Error("tool is not an HTTP tool");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const body = tool.http.body.replaceAll("{{args}}", args);
    const options = {
      method: tool.http.method,
      headers: {
        "content-type": "application/json",
        ...Object.fromEntries(Object.entries(tool.http.headers).map(([key, value]) => [key, String(value)])),
      },
      signal: controller.signal,
    };
    if (!['GET'].includes(tool.http.method)) options.body = body;
    const response = await fetchImpl(tool.http.url, options);
    const text = await readLimited(response);
    return JSON.stringify({ ok: response.ok, status: response.status, body: text.slice(0, 32_000) });
  } finally {
    clearTimeout(timeout);
  }
}

export class ToolConfigCache {
  constructor({ ttlMs = 60_000, fetchImpl = fetch, maxBytes = 256_000 } = {}) {
    this.ttlMs = ttlMs;
    this.fetchImpl = fetchImpl;
    this.maxBytes = maxBytes;
    this.cache = new Map();
  }

  async get(url) {
    if (!url) return [];
    const cached = this.cache.get(url);
    if (cached && cached.expires > Date.now()) return cached.tools;

    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("tools URL must use HTTP or HTTPS");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await this.fetchImpl(parsed, { signal: controller.signal, redirect: "error" });
      if (!response.ok) throw new Error(`tools URL returned HTTP ${response.status}`);
      const text = await readLimited(response, this.maxBytes);
      const tools = validateToolConfig(JSON.parse(text));
      this.cache.set(url, { tools, expires: Date.now() + this.ttlMs });
      return tools;
    } finally {
      clearTimeout(timeout);
    }
  }
}
