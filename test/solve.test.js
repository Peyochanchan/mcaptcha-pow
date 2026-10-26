import { afterEach, describe, expect, test } from "bun:test"
import { solve } from "../src/solve.js"
import { ChallengeError, SolveError, VerifyError } from "../src/errors.js"
import { solveChallenge } from "../src/pow.js"
import { stubInstance } from "./support/instance_stub.js"

const instanceUrl = "https://mcaptcha.example.org"
const sitekey = "a-sitekey"
const challenge = { salt: "a-salt-long-enough-for-mcaptcha", string: "a-challenge", difficulty_factor: 500 }

const originalWorker = globalThis.Worker
afterEach(() => { globalThis.Worker = originalWorker })

// Replaces the global Worker with one that runs `onMessage` in-process, and
// records every worker created.
const stubWorker = (onMessage = (worker, data) => worker.reply({ solution: solveChallenge(data) })) => {
  const workers = []
  globalThis.Worker = class {
    terminated = false
    constructor(url, options) { this.url = url; this.options = options; workers.push(this) }
    terminate() { this.terminated = true }
    postMessage(data) { onMessage(this, data) }
    reply(data) { queueMicrotask(() => this.onmessage({ data })) }
  }
  return workers
}

const instanceAnswering = (verify) => stubInstance({
  "/api/v1/pow/config": { json: challenge },
  "/api/v1/pow/verify": { json: verify }
})

describe("solve", () => {
  test("trades a solved challenge for a token", async () => {
    const requests = instanceAnswering({ token: "a-token" })
    const workers = stubWorker()

    expect(await solve({ instanceUrl, sitekey })).toBe("a-token")

    const [config, verify] = requests
    expect(config).toMatchObject({ path: "/api/v1/pow/config", body: { key: sitekey } })
    expect(verify.body).toMatchObject({ key: sitekey, string: challenge.string })
    expect(verify.body.nonce).toBeNumber()
    expect(workers[0].terminated).toBe(true)
  })

  test("starts a module worker from the package by default", async () => {
    instanceAnswering({ token: "a-token" })
    const workers = stubWorker()

    await solve({ instanceUrl, sitekey })

    expect(String(workers[0].url)).toEndWith("/src/worker.js")
    expect(workers[0].options).toEqual({ type: "module" })
  })

  test("starts the worker from workerUrl when given", async () => {
    instanceAnswering({ token: "a-token" })
    const workers = stubWorker()

    await solve({ instanceUrl, sitekey, workerUrl: "/assets/mcaptcha-pow-worker.js" })

    expect(workers[0].url).toBe("/assets/mcaptcha-pow-worker.js")
  })

  test("fails with a ChallengeError when the instance answers an error", async () => {
    stubInstance({ "/api/v1/pow/config": { status: 503, json: {} } })
    const workers = stubWorker()

    await expect(solve({ instanceUrl, sitekey })).rejects.toBeInstanceOf(ChallengeError)
    expect(workers).toHaveLength(0)
  })

  test("fails with a VerifyError when no token comes back", async () => {
    instanceAnswering({})
    stubWorker()

    await expect(solve({ instanceUrl, sitekey })).rejects.toBeInstanceOf(VerifyError)
  })

  test("fails with a SolveError when the worker crashes", async () => {
    instanceAnswering({ token: "a-token" })
    const workers = stubWorker(worker => worker.onerror({ message: "boom" }))

    await expect(solve({ instanceUrl, sitekey })).rejects.toThrow(new SolveError("boom"))
    expect(workers[0].terminated).toBe(true)
  })

  test("stops the worker when aborted", async () => {
    instanceAnswering({ token: "a-token" })
    const controller = new AbortController()
    const workers = stubWorker(() => controller.abort())

    await expect(solve({ instanceUrl, sitekey, signal: controller.signal })).rejects.toThrow("aborted")
    expect(workers[0].terminated).toBe(true)
  })
})
