import { SolveError } from "./errors.js"
import { fetchChallenge, redeemProof } from "./instance.js"

// Gets a challenge from the mCaptcha instance, solves it off the main thread,
// and trades the proof for a token. The token is what your form submits, and
// what your server checks with /api/v1/pow/siteverify.
export async function solve({ instanceUrl, sitekey, signal, workerUrl }) {
  const challenge = await fetchChallenge({ instanceUrl, sitekey, signal })
  const solution = await runWorker(createWorker(workerUrl), challenge, signal)
  return redeemProof({ instanceUrl, sitekey, challenge, solution, signal })
}

// Vite and webpack bundle the worker only when they find `new URL(…,
// import.meta.url)` written inside `new Worker(…)`: keep it inline. Bun and
// esbuild leave it as is; there, serve dist/worker.js and pass its URL.
function createWorker(workerUrl) {
  return workerUrl
    ? new Worker(workerUrl, { type: "module" })
    : new Worker(new URL("./worker.js", import.meta.url), { type: "module" })
}

function runWorker(worker, challenge, signal) {
  return new Promise((resolve, reject) => {
    const settle = (callback, value) => {
      worker.terminate()
      signal?.removeEventListener("abort", abort)
      callback(value)
    }
    const abort = () => settle(reject, signal.reason)

    if (signal?.aborted) return abort()
    signal?.addEventListener("abort", abort, { once: true })

    worker.onmessage = ({ data }) => {
      if (data.error) settle(reject, new SolveError(data.error))
      else settle(resolve, data.solution)
    }
    worker.onerror = (event) => {
      event.preventDefault?.()
      settle(reject, new SolveError(event.message || "The worker crashed"))
    }

    worker.postMessage(challenge)
  })
}
