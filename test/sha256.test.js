import { describe, expect, test } from "bun:test"
import { createHash, randomBytes } from "node:crypto"
import { INITIAL_STATE, absorb, finish, sha256 } from "../src/sha256.js"

const hex = (state) => [...state].map(word => word.toString(16).padStart(8, "0")).join("")
const reference = (bytes) => createHash("sha256").update(bytes).digest("hex")

describe("sha256", () => {
  test("hashes the FIPS 180-4 example", () => {
    expect(hex(sha256(new TextEncoder().encode("abc")))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  })

  // Every length up to three blocks, so the padding is checked on both sides
  // of each block boundary (55/56 bytes: one or two final blocks).
  test.each(Array.from({ length: 193 }, (_, length) => length))("matches node:crypto on %i bytes", (length) => {
    const bytes = new Uint8Array(randomBytes(length))
    expect(hex(sha256(bytes))).toBe(reference(bytes))
  })
})

describe("absorb and finish", () => {
  test("hash a message in two steps as in one", () => {
    const prefix = new Uint8Array(randomBytes(150))
    const suffix = new TextEncoder().encode("12345")

    const state = INITIAL_STATE.slice()
    const rest = absorb(state, prefix)
    const block = new Uint8Array(128)
    block.set(rest)
    block.set(suffix, rest.length)
    finish(state, block, rest.length + suffix.length, prefix.length + suffix.length)

    expect(hex(state)).toBe(reference(Buffer.concat([prefix, suffix])))
  })
})
