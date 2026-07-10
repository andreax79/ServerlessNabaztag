# Nabaztag Realtime relay

Stateful Node.js relay between the rabbit's plain-HTTP firmware and the OpenAI Realtime API. It keeps the OpenAI key on the Raspberry Pi, maintains one short-lived WebSocket session per rabbit, converts the rabbit's 8 kHz IMA ADPCM recording to G.711 μ-law, streams Realtime PCM output through FFmpeg as MP3, and brokers user-defined tools.

## Requirements

- Node.js 20 or newer
- FFmpeg in `PATH`
- an OpenAI API project key with a project budget limit
- a long random signing secret

## Local run

```sh
cd relay
npm ci
cp .env.example .env
# Fill OPENAI_API_KEY and TTS_SIGNING_SECRET.
node --env-file=.env server.js
curl -sv http://127.0.0.1:8787/v1/health
```

The health request must return HTTP 200 directly, without a redirect. `configured` becomes `true` only when both relay secrets are present.

Generate a signing secret with:

```sh
openssl rand -hex 32
```

Never put `.env` in Git or copy the OpenAI key into the rabbit. The rabbit sends only its non-secret AI preferences and the recording over the trusted LAN.

## Raspberry Pi service

Install Node.js and FFmpeg, copy `relay/` to `/opt/nabaztag-relay`, then create `/etc/nabaztag-relay.env` from `.env.example`. The following systemd unit keeps the relay running:

```ini
[Unit]
Description=Nabaztag OpenAI Realtime relay
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/nabaztag-relay
EnvironmentFile=/etc/nabaztag-relay.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=3
User=nabaztag
Group=nabaztag
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
ProtectClock=true
ProtectHostname=true
ProtectProc=invisible
ProcSubset=pid
RestrictNamespaces=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true
CapabilityBoundingSet=
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
```

The default firmware relay address is `192.168.1.214:8787`. Keep port 8787 reachable only from the home LAN. TLS is used from the relay to OpenAI; the legacy rabbit-to-relay hop is plain HTTP because the firmware has no TLS stack.

## API contract

- `GET /v1/health` — readiness and non-secret configuration state.
- `POST /v1/config` — caches the rabbit's non-secret personality prompt from the request body. The firmware calls this before every turn so relay restarts and UI changes are handled automatically.
- `POST /v1/ask?lang=it&mode=button|wake&wake=nabaztag` — WAV body or `t=` text; returns an answer ticket, a Forth tool call, or `{ok:0}`. All application outcomes use HTTP 200 for compatibility with the rabbit.
- `POST /v1/tool-result?sid=...&call_id=...` — resumes a parked Realtime response after a Forth tool.
- `GET /v1/tts?sid=...&exp=...&sig=...` — signed live MP3 stream.
- `POST /v1/say?voice=marin` — service TTS for `ai-say`.

The relay caps request sizes, applies per-rabbit rate limits, expires sessions automatically, signs MP3 URLs with HMAC-SHA256, limits each exchange to four tool calls, and places 10-second timeouts on HTTP tools.

Tool routing is done by the model itself: sessions run with `tool_choice: "auto"` and the tools declared in `ai_tools.json`, so a physical request in any language triggers the matching function call natively — the relay contains no utterance parsing and no per-language rules. Button audio goes straight to the Realtime session (audio to audio, no transcription step); the transcription API is used only in wake mode, as a cheap gate that checks the configured wake word before a Realtime turn is spent. Verification lives in the hot-reloadable Forth tools on the rabbit: `move_ears` waits for the ears to reach their target and reports the verified positions (`ok: …`) or a concrete failure (`error: …`), and the session instructions tell the model to base its spoken confirmation only on that result.

## Tests

```sh
npm test
ffmpeg -i spoken-input.wav -ar 8000 -ac 1 -c:a adpcm_ima_wav sample-adpcm.wav
npm run test:live -- http://127.0.0.1:8787 sample-adpcm.wav
```

The live test writes `live-response.mp3` and can be repeated immediately to verify conversational memory inside the configured session TTL.
