// The SHA-256 of a whole photo, in plain JavaScript: a worker of the phone's page (served at /phone/sha256.js). The page
// is no secure context (http:// of the computer's address), so neither crypto.subtle nor anything like it is there.
// Asked {id, blob}; answers {id, progress} as it reads, then {id, sha} (hex) or {id, error}.
"use strict";

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256() {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rest = new Uint8Array(64);
  let restLength = 0;
  let total = 0;

  const block = (b, at) => {
    for (let i = 0; i < 16; i++) w[i] = (b[at + 4 * i] << 24) | (b[at + 4 * i + 1] << 16) | (b[at + 4 * i + 2] << 8) | b[at + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h[0], bb = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = bb;
      bb = a;
      a = (t1 + t2) | 0;
    }
    h[0] += a; h[1] += bb; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  };

  return {
    update(bytes) {
      total += bytes.length;
      let at = 0;
      if (restLength) {
        const take = Math.min(64 - restLength, bytes.length);
        rest.set(bytes.subarray(0, take), restLength);
        restLength += take;
        at = take;
        if (restLength < 64) return;
        block(rest, 0);
        restLength = 0;
      }
      for (; at + 64 <= bytes.length; at += 64) block(bytes, at);
      rest.set(bytes.subarray(at), 0);
      restLength = bytes.length - at;
    },
    hex() {
      const bits = total * 8;
      const pad = new Uint8Array(restLength < 56 ? 64 - restLength : 128 - restLength);
      pad[0] = 0x80;
      const hi = Math.floor(bits / 0x100000000);
      const lo = bits >>> 0;
      const n = pad.length;
      pad[n - 8] = hi >>> 24; pad[n - 7] = hi >>> 16; pad[n - 6] = hi >>> 8; pad[n - 5] = hi;
      pad[n - 4] = lo >>> 24; pad[n - 3] = lo >>> 16; pad[n - 2] = lo >>> 8; pad[n - 1] = lo;
      total -= n;
      this.update(pad);
      return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
    },
  };
}

// read in parts (a photo of tens of MB never whole in memory twice)
const PART = 4 * 1024 * 1024;

async function read(blob, from, to) {
  const part = blob.slice(from, to);
  if (typeof part.arrayBuffer === "function") return new Uint8Array(await part.arrayBuffer());
  // older Safari: no Blob.arrayBuffer
  return new Uint8Array(new FileReaderSync().readAsArrayBuffer(part));
}

self.onmessage = async (event) => {
  const { id, blob } = event.data || {};
  try {
    const hash = sha256();
    for (let at = 0; at < blob.size; at += PART) {
      hash.update(await read(blob, at, Math.min(blob.size, at + PART)));
      self.postMessage({ id, progress: Math.min(1, (at + PART) / blob.size) });
    }
    self.postMessage({ id, sha: hash.hex() });
  } catch (e) {
    self.postMessage({ id, error: String((e && e.message) || e) });
  }
};
