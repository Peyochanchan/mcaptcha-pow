import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { challengePrefix, difficultyThreshold, score, solveChallenge } from "../src/pow.js"
import { sha256 } from "../src/sha256.js"
import vectors from "./fixtures/vectors.json"

// Reference score, computed with Node's SHA-256 rather than this package's.
const referenceScore = (prefix, nonce) => {
  const digest = createHash("sha256").update(prefix).update(String(nonce)).digest()
  return digest.readBigUInt64BE(0) << 64n | digest.readBigUInt64BE(8)
}

describe("challengePrefix", () => {
  test("is the salt, the string length as a little-endian u64, then the string", () => {
    expect([...challengePrefix("ab", "xyz")]).toEqual([97, 98, 3, 0, 0, 0, 0, 0, 0, 0, 120, 121, 122])
  })

  test("counts the string length in UTF-8 bytes", () => {
    expect([...challengePrefix("", "é")]).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0xc3, 0xa9])
  })
})

describe("difficultyThreshold", () => {
  test("accepts any digest at difficulty 1", () => {
    expect(difficultyThreshold(1)).toBe(0n)
  })

  test("accepts half of the digests at difficulty 2", () => {
    expect(difficultyThreshold(2)).toBe(1n << 127n)
  })

  test.each([0, -5, 1.5, undefined, "50000"])("rejects %p as a difficulty factor", (difficultyFactor) => {
    expect(() => difficultyThreshold(difficultyFactor)).toThrow(RangeError)
  })
})

describe("score", () => {
  test("reads the first 16 bytes of the digest as a big-endian u128", () => {
    expect(score(sha256(new TextEncoder().encode("abc")))).toBe(0xba7816bf8f01cfea414140de5dae2223n)
  })
})

describe("solveChallenge", () => {
  // The prefix is the salt, 8 bytes of length, then the string: these lengths
  // leave 0 to 63 bytes after the last full block, so the nonce lands in one
  // final block or spills into a second one.
  test.each([0, 1, 40, 47, 48, 55, 56, 63])("finds the smallest valid nonce with %i bytes of prefix past the last block", (rest) => {
    const salt = "s".repeat(64)
    const challenge = { salt, string: "c".repeat(64 - 8 + rest), difficultyFactor: 3000 }
    const prefix = challengePrefix(challenge.salt, challenge.string)
    const threshold = difficultyThreshold(challenge.difficultyFactor)

    const { nonce, result } = solveChallenge(challenge)

    expect(BigInt(result)).toBe(referenceScore(prefix, nonce))
    expect(BigInt(result) >= threshold).toBe(true)
    for (let smaller = 0; smaller < nonce; smaller++) {
      expect(referenceScore(prefix, smaller) < threshold).toBe(true)
    }
  })

  test("gives up past maxNonce", () => {
    const impossible = { salt: "salt", string: "string", difficultyFactor: 2 ** 32 }
    expect(() => solveChallenge(impossible, { maxNonce: 128 })).toThrow("No solution below nonce 128")
  })
})

describe("vectors accepted by a live mCaptcha instance", () => {
  test("at least one vector has been captured (bun run capture)", () => {
    expect(vectors.length).toBeGreaterThan(0)
  })

  test.each(vectors)("difficulty $difficultyFactor, nonce $nonce", (vector) => {
    expect(solveChallenge(vector)).toEqual({ nonce: vector.nonce, result: vector.result })
  })
})
