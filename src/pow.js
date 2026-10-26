// The proof of work behind mCaptcha (Rust crate `pow_sha256`).
//
// A challenge is solved by finding a nonce such that
//
//   score(SHA-256(prefix ‖ decimal(nonce))) >= threshold(difficultyFactor)
//
// where `prefix` is the salt followed by the bincode encoding of the challenge
// string (u64 little-endian length, then the bytes), and `score` reads the first
// 16 bytes of the digest as a big-endian u128.

import { INITIAL_STATE, absorb, finish } from "./sha256.js"

const U128_MAX = (1n << 128n) - 1n
const U64_MAX_DIGITS = 20

const encoder = new TextEncoder()

export function challengePrefix(salt, string) {
  const saltBytes = encoder.encode(salt)
  const stringBytes = encoder.encode(string)
  const prefix = new Uint8Array(saltBytes.length + 8 + stringBytes.length)

  prefix.set(saltBytes)
  new DataView(prefix.buffer).setBigUint64(saltBytes.length, BigInt(stringBytes.length), true)
  prefix.set(stringBytes, saltBytes.length + 8)

  return prefix
}

// Zero would divide by zero, a negative factor would never be reached.
export function isDifficultyFactor(value) {
  return Number.isInteger(value) && value >= 1
}

export function difficultyThreshold(difficultyFactor) {
  if (!isDifficultyFactor(difficultyFactor)) {
    throw new RangeError(`The difficulty factor must be a positive integer, got ${difficultyFactor}`)
  }
  return U128_MAX - U128_MAX / BigInt(difficultyFactor)
}

// The first four words of a SHA-256 state are the first 16 bytes of the digest.
export function score(state) {
  return state.slice(0, 4).reduce((value, word) => (value << 32n) | BigInt(word), 0n)
}

// The prefix never changes, so its full blocks are hashed once (the midstate);
// each attempt then hashes the rest of the prefix and the nonce digits only.
export function solveChallenge({ salt, string, difficultyFactor }, { maxNonce = 5e8 } = {}) {
  const prefix = challengePrefix(salt, string)
  const threshold = toWords(difficultyThreshold(difficultyFactor))

  const midstate = INITIAL_STATE.slice()
  const rest = absorb(midstate, prefix)
  const absorbedLength = prefix.length - rest.length

  const block = new Uint8Array(128)
  block.set(rest)
  const state = new Uint32Array(8)
  const digits = new DecimalDigits()

  for (let nonce = 0; nonce < maxNonce; nonce++, digits.increment()) {
    const length = digits.writeInto(block, rest.length)

    state.set(midstate)
    finish(state, block, length, absorbedLength + length)

    if (reaches(state, threshold)) return { nonce, result: score(state).toString() }
  }

  throw new Error(`No solution below nonce ${maxNonce}`)
}

// Compares the leading words of the digest with the threshold, most significant first.
function reaches(state, threshold) {
  for (let i = 0; i < 4; i++) {
    if (state[i] !== threshold[i]) return state[i] > threshold[i]
  }
  return true
}

function toWords(u128) {
  return Uint32Array.from([96n, 64n, 32n, 0n], shift => Number((u128 >> shift) & 0xffffffffn))
}

// The nonce is hashed as decimal text. Counting in decimal digits, least
// significant first, saves formatting a string on every attempt.
class DecimalDigits {
  digits = new Uint8Array(U64_MAX_DIGITS)
  length = 1

  increment() {
    let i = 0
    while (this.digits[i] === 9) this.digits[i++] = 0
    this.digits[i]++
    if (i === this.length) this.length++
  }

  // Writes the digits at `offset`, most significant first; returns the end offset.
  writeInto(bytes, offset) {
    for (let i = this.length - 1; i >= 0; i--) bytes[offset++] = 0x30 + this.digits[i]
    return offset
  }
}
