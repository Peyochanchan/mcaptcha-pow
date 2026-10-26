import { describe, expect, test } from "bun:test"
import { fetchChallenge, redeemProof } from "../src/instance.js"
import { ChallengeError, VerifyError } from "../src/errors.js"
import { stubInstance } from "./support/instance_stub.js"

const sitekey = "a-sitekey"
const challenge = { salt: "a-salt", string: "a-challenge", difficulty_factor: 500 }

describe("fetchChallenge", () => {
  test.each([
    ["https://mcaptcha.example.org", "https://mcaptcha.example.org/api/v1/pow/config"],
    ["https://mcaptcha.example.org/", "https://mcaptcha.example.org/api/v1/pow/config"],
    ["https://example.org/mcaptcha", "https://example.org/mcaptcha/api/v1/pow/config"],
    ["https://example.org/mcaptcha/", "https://example.org/mcaptcha/api/v1/pow/config"]
  ])("calls the instance at %s without a double slash", async (instanceUrl, expected) => {
    const requests = stubInstance({ [new URL(expected).pathname]: { json: challenge } })

    await fetchChallenge({ instanceUrl, sitekey })

    expect(requests[0].url).toBe(expected)
  })

  test("names the difficulty factor in camelCase", async () => {
    stubInstance({ "/api/v1/pow/config": { json: challenge } })

    expect(await fetchChallenge({ instanceUrl: "https://mcaptcha.example.org", sitekey }))
      .toEqual({ salt: "a-salt", string: "a-challenge", difficultyFactor: 500 })
  })

  test.each([
    ["an empty body", {}],
    ["no salt", { ...challenge, salt: undefined }],
    ["an empty string", { ...challenge, string: "" }],
    ["a difficulty of 0", { ...challenge, difficulty_factor: 0 }],
    ["a difficulty as text", { ...challenge, difficulty_factor: "500" }]
  ])("fails with a ChallengeError on %s", async (_, json) => {
    stubInstance({ "/api/v1/pow/config": { json } })

    await expect(fetchChallenge({ instanceUrl: "https://mcaptcha.example.org", sitekey })).rejects.toBeInstanceOf(ChallengeError)
  })
})

describe("redeemProof", () => {
  test("fails with a VerifyError when the token is not a string", async () => {
    stubInstance({ "/api/v1/pow/verify": { json: { token: 42 } } })
    const solution = { nonce: 1, result: "1" }

    await expect(redeemProof({ instanceUrl: "https://mcaptcha.example.org", sitekey, challenge, solution })).rejects.toBeInstanceOf(VerifyError)
  })
})
