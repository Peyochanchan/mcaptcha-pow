// SHA-256 (FIPS 180-4), synchronous and allocation-free once loaded.
//
// Split in two steps so a constant prefix is hashed only once: `absorb` folds
// every full 64-byte block into a state, `finish` pads and folds the rest.
// Messages are limited to 2^53 bits, far beyond what a challenge needs.

export const INITIAL_STATE = Uint32Array.of(
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
)

const K = Uint32Array.of(
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
)

const BLOCK_SIZE = 64
// Signed, like every intermediate value below (`| 0`): the arithmetic stays in
// 32-bit integers end to end, which the JIT can keep out of floating point.
const schedule = new Int32Array(64)

// Folds every full block of `bytes` into `state`; returns the bytes left over.
export function absorb(state, bytes) {
  const fullLength = bytes.length - (bytes.length % BLOCK_SIZE)
  for (let offset = 0; offset < fullLength; offset += BLOCK_SIZE) compress(state, bytes, offset)
  return bytes.subarray(fullLength)
}

// Pads the last `length` bytes of the message, written at the start of `block`,
// and folds them into `state`. `messageLength` is the length of the whole
// message, prefix included.
//
// Padding adds at least 9 bytes, so the tail fills one final block or spills
// into a second: `block` is 128 bytes of scratch space, and `length` must stay
// below 120. The solver never exceeds 83 (63 bytes of prefix, 20 digits).
export function finish(state, block, length, messageLength) {
  const end = length + 9 <= BLOCK_SIZE ? BLOCK_SIZE : 2 * BLOCK_SIZE
  const bits = messageLength * 8

  block[length] = 0x80
  block.fill(0, length + 1, end - 8)
  writeUint32(block, end - 8, Math.floor(bits / 2 ** 32))
  writeUint32(block, end - 4, bits >>> 0)

  for (let offset = 0; offset < end; offset += BLOCK_SIZE) compress(state, block, offset)
}

export function sha256(bytes) {
  const state = INITIAL_STATE.slice()
  const rest = absorb(state, bytes)
  const block = new Uint8Array(2 * BLOCK_SIZE)

  block.set(rest)
  finish(state, block, rest.length, bytes.length)
  return state
}

function compress(state, bytes, offset) {
  for (let i = 0; i < 16; i++) {
    const j = offset + 4 * i
    schedule[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3]
  }
  for (let i = 16; i < 64; i++) {
    const w15 = schedule[i - 15]
    const w2 = schedule[i - 2]
    const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3)
    const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10)
    schedule[i] = (schedule[i - 16] + s0 + schedule[i - 7] + s1) | 0
  }

  // Read one by one: destructuring a typed array goes through its iterator,
  // which cuts the hash rate by more than half in this hot path.
  let a = state[0], b = state[1], c = state[2], d = state[3]
  let e = state[4], f = state[5], g = state[6], h = state[7]
  for (let i = 0; i < 64; i++) {
    const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + schedule[i]) | 0
    const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
    h = g; g = f; f = e; e = (d + t1) | 0
    d = c; c = b; b = a; a = (t1 + t2) | 0
  }

  state[0] += a; state[1] += b; state[2] += c; state[3] += d
  state[4] += e; state[5] += f; state[6] += g; state[7] += h
}

function rotr(word, bits) {
  return (word >>> bits) | (word << (32 - bits))
}

function writeUint32(bytes, offset, word) {
  bytes[offset] = word >>> 24
  bytes[offset + 1] = word >>> 16
  bytes[offset + 2] = word >>> 8
  bytes[offset + 3] = word
}
