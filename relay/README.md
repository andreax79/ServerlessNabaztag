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
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/nabaztag-relay

[Install]
WantedBy=multi-user.target
```

The default firmware relay address is `192.168.1.214:8787`. Keep port 8787 reachable only from the home LAN. TLS is used from the relay to OpenAI; the legacy rabbit-to-relay hop is plain HTTP because the firmware has no TLS stack.

## API contract

- `GET /v1/health` — readiness and non-secret configuration state.
- `POST /v1/ask?lang=it&mode=button|wake&wake=nabaztag` — WAV body or `t=` text; returns an answer ticket, a Forth tool call, or `{ok:0}`. All application outcomes use HTTP 200 for compatibility with the rabbit.
- `POST /v1/tool-result?sid=...&call_id=...` — resumes a parked Realtime response after a Forth tool.
- `GET /v1/tts?sid=...&exp=...&sig=...` — signed live MP3 stream.
- `POST /v1/say?voice=marin` — service TTS for `ai-say`.

The relay caps request sizes, applies per-rabbit rate limits, expires sessions automatically, signs MP3 URLs with HMAC-SHA256, limits each exchange to four tool calls, and places 10-second timeouts on HTTP tools.

## Tests

```sh
npm test
ffmpeg -i spoken-input.wav -ar 8000 -ac 1 -c:a adpcm_ima_wav sample-adpcm.wav
npm run test:live -- http://127.0.0.1:8787 sample-adpcm.wav
```

The live test writes `live-response.mp3` and can be repeated immediately to verify conversational memory inside the configured session TTL.
