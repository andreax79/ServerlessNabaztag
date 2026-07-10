import fs from "node:fs/promises";

const [relay = "http://127.0.0.1:8787", wavPath] = process.argv.slice(2);
if (!wavPath) throw new Error("usage: npm run test:live -- http://relay:8787 sample-adpcm.wav");
const wav = await fs.readFile(wavPath);
const ask = await fetch(`${relay}/v1/ask?lang=it&mode=button`, {
  method: "POST",
  headers: { "content-type": "audio/wav", "x-rabbit-id": "live-test" },
  body: wav,
});
const payload = await ask.json();
console.log(payload);
if (!payload.ok || payload.type !== "answer") process.exitCode = 1;
else {
  const audio = await fetch(payload.tts);
  await fs.writeFile("live-response.mp3", Buffer.from(await audio.arrayBuffer()));
  console.log("wrote live-response.mp3");
}
