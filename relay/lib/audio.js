const IMA_INDEX_TABLE = [
  -1, -1, -1, -1, 2, 4, 6, 8,
  -1, -1, -1, -1, 2, 4, 6, 8,
];

const IMA_STEP_TABLE = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31,
  34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130,
  143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449,
  494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411,
  1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026,
  4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442,
  11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623,
  27086, 29794, 32767,
];

function findChunk(wav, wanted) {
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString("ascii", offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === wanted) return { start, size: Math.min(size, wav.length - start) };
    offset = start + size + (size & 1);
  }
  return null;
}

function decodeImaNibble(nibble, state) {
  const step = IMA_STEP_TABLE[state.index];
  let diff = step >> 3;
  if (nibble & 1) diff += step >> 2;
  if (nibble & 2) diff += step >> 1;
  if (nibble & 4) diff += step;
  state.predictor += nibble & 8 ? -diff : diff;
  state.predictor = Math.max(-32768, Math.min(32767, state.predictor));
  state.index = Math.max(0, Math.min(88, state.index + IMA_INDEX_TABLE[nibble]));
  return state.predictor;
}

export function decodeWavImaAdpcm(wav) {
  if (!Buffer.isBuffer(wav)) wav = Buffer.from(wav);
  if (wav.length < 12 || wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("invalid WAV container");
  }

  const fmt = findChunk(wav, "fmt ");
  const data = findChunk(wav, "data");
  if (!fmt || fmt.size < 16 || !data) throw new Error("WAV is missing fmt or data chunk");

  const format = wav.readUInt16LE(fmt.start);
  const channels = wav.readUInt16LE(fmt.start + 2);
  const sampleRate = wav.readUInt32LE(fmt.start + 4);
  const blockAlign = wav.readUInt16LE(fmt.start + 12);
  const bitsPerSample = wav.readUInt16LE(fmt.start + 14);
  if (format !== 0x11 || channels !== 1 || bitsPerSample !== 4 || blockAlign < 5) {
    throw new Error("expected mono 4-bit IMA ADPCM WAV");
  }
  if (sampleRate !== 8000) throw new Error(`expected 8000 Hz input, received ${sampleRate}`);

  const samples = [];
  const dataEnd = data.start + data.size;
  for (let blockStart = data.start; blockStart + 4 <= dataEnd; blockStart += blockAlign) {
    const blockEnd = Math.min(blockStart + blockAlign, dataEnd);
    const state = {
      predictor: wav.readInt16LE(blockStart),
      index: Math.min(88, wav[blockStart + 2]),
    };
    samples.push(state.predictor);
    for (let i = blockStart + 4; i < blockEnd; i += 1) {
      const byte = wav[i];
      samples.push(decodeImaNibble(byte & 0x0f, state));
      samples.push(decodeImaNibble(byte >> 4, state));
    }
  }
  return Int16Array.from(samples);
}

export function pcm16ToMuLaw(samples) {
  const output = Buffer.alloc(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    let sample = samples[i];
    const sign = sample < 0 ? 0x80 : 0;
    if (sample < 0) sample = -sample;
    sample = Math.min(32635, sample) + 0x84;

    let exponent = 7;
    for (let mask = 0x4000; exponent > 0 && (sample & mask) === 0; mask >>= 1) exponent -= 1;
    const mantissa = (sample >> (exponent + 3)) & 0x0f;
    output[i] = (~(sign | (exponent << 4) | mantissa)) & 0xff;
  }
  return output;
}

export function wavImaAdpcmToMuLaw(wav) {
  return pcm16ToMuLaw(decodeWavImaAdpcm(wav));
}

export function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = saved;
    }
  }
  return previous[b.length];
}

function normalizeWords(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function hasWakeWordAtStart(transcript, wakeWord, maxDistance = 2) {
  const words = normalizeWords(transcript);
  const wakeWords = normalizeWords(wakeWord);
  const wake = wakeWords.join("");
  if (!words.length || !wake) return false;
  // Short wake words must not inherit the two-edit tolerance intended for
  // "nabaztag", otherwise almost any short word could spend a Realtime turn.
  const allowedDistance = Math.min(maxDistance, Math.floor(wake.length / 3));
  const candidates = [];
  const maxWords = Math.min(words.length, Math.max(2, wakeWords.length + 1));
  for (let count = 1; count <= maxWords; count += 1) {
    candidates.push(words.slice(0, count).join(""));
  }
  return candidates.some((candidate) => levenshtein(candidate, wake) <= allowedDistance);
}
