import { afterEach, describe, expect, test } from "bun:test"
import { solve } from "../src/solve.js"
import { solve as solveAuto } from "../src/auto.js"
import { ChallengeError, SolveError, VerifyError } from "../src/errors.js"
import { solveChallenge } from "../src/pow.js"
import { stubInstance } from "./support/instance_stub.js"

const instanceUrl = "https://mcaptcha.example.org"
const sitekey = "a-sitekey"
const workerUrl = "/assets/mcaptcha-pow-worker-0123abcd.js"
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

    expect(await solve({ instanceUrl, sitekey, workerUrl })).toBe("a-token")

    const [config, verify] = requests
    expect(config).toMatchObject({ path: "/api/v1/pow/config", body: { key: sitekey } })
    expect(verify.body).toMatchObject({ key: sitekey, string: challenge.string })
    expect(verify.body.nonce).toBeNumber()
    expect(workers[0].terminated).toBe(true)
  })

  test("starts a module worker from workerUrl", async () => {
    instanceAnswering({ token: "a-token" })
    const workers = stubWorker()

    await solve({ instanceUrl, sitekey, workerUrl })

    expect(workers[0].url).toBe(workerUrl)
    expect(workers[0].options).toEqual({ type: "module" })
  })

  test("requires workerUrl, before calling the instance", async () => {
    const requests = instanceAnswering({ token: "a-token" })

    await expect(solve({ instanceUrl, sitekey })).rejects.toThrow(/workerUrl is required/)
    expect(requests).toHaveLength(0)
  })

  test("mcaptcha-pow/auto starts the worker shipped with the package", async () => {
    instanceAnswering({ token: "a-token" })
    const workers = stubWorker()

    expect(await solveAuto({ instanceUrl, sitekey })).toBe("a-token")
    expect(String(workers[0].url)).toEndWith("/src/worker.js")
  })

  test("fails with a ChallengeError when the instance answers an error", async () => {
    stubInstance({ "/api/v1/pow/config": { status: 503, json: {} } })
    const workers = stubWorker()

    await expect(solve({ instanceUrl, sitekey, workerUrl })).rejects.toBeInstanceOf(ChallengeError)
    expect(workers).toHaveLength(0)
  })

  test("fails with a VerifyError when no token comes back", async () => {
    instanceAnswering({})
    stubWorker()

    await expect(solve({ instanceUrl, sitekey, workerUrl })).rejects.toBeInstanceOf(VerifyError)
  })

  test("fails with a SolveError when the worker crashes", async () => {
    instanceAnswering({ token: "a-token" })
    const workers = stubWorker(worker => worker.onerror({ message: "boom" }))

    await expect(solve({ instanceUrl, sitekey, workerUrl })).rejects.toThrow(new SolveError("boom"))
    expect(workers[0].terminated).toBe(true)
  })

  test("stops the worker when aborted", async () => {
    instanceAnswering({ token: "a-token" })
    const controller = new AbortController()
    const workers = stubWorker(() => controller.abort())

    await expect(solve({ instanceUrl, sitekey, workerUrl, signal: controller.signal })).rejects.toThrow("aborted")
    expect(workers[0].terminated).toBe(true)
  })
})
