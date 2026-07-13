import assert from "node:assert/strict";
import test from "node:test";
import { decodeWavImaAdpcm, hasWakeWordAtStart, pcm16ToMuLaw } from "../lib/audio.js";

function makeImaWav(data) {
  const fmtSize = 20;
  const header = Buffer.alloc(12 + 8 + fmtSize + 8);
  header.write("RIFF", 0);
  header.writeUInt32LE(header.length + data.length - 8, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(fmtSize, 16);
  header.writeUInt16LE(0x11, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(4000, 28);
  header.writeUInt16LE(data.length, 32);
  header.writeUInt16LE(4, 34);
  header.writeUInt16LE(2, 36);
  header.writeUInt16LE((data.length - 4) * 2 + 1, 38);
  header.write("data", 40);
  header.writeUInt32LE(data.length, 44);
  return Buffer.concat([header, data]);
}

test("decodes mono IMA ADPCM blocks and converts them to PCMU", () => {
  const block = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x11, 0x11]);
  const pcm = decodeWavImaAdpcm(makeImaWav(block));
  assert.deepEqual([...pcm], [0, 1, 2, 3, 4]);
  const mulaw = pcm16ToMuLaw(pcm);
  assert.equal(mulaw.length, pcm.length);
  assert.equal(mulaw[0], 0xff);
});

test("wake word matching is accent-insensitive and fuzzy only at the start", () => {
  assert.equal(hasWakeWordAtStart("Nabastag, che tempo fa?", "nabaztag"), true);
  assert.equal(hasWakeWordAtStart("Nabaz tag accendi le luci", "nabaztag"), true);
  assert.equal(hasWakeWordAtStart("Ehi Nabaztag", "nabaztag"), false);
  assert.equal(hasWakeWordAtStart("Coniglio, svegliati", "nabaztag"), false);
  assert.equal(hasWakeWordAtStart("hey rabbit", "hi"), false, "short wake words must not allow two edits");
  assert.equal(hasWakeWordAtStart("你好，请告诉我时间", "你好"), true, "non-Latin wake words are supported");
});
