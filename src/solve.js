import { SolveError } from "./errors.js"
import { fetchChallenge, redeemProof } from "./instance.js"

// Gets a challenge from the mCaptcha instance, solves it off the main thread,
// and trades the proof for a token. The token is what your form submits, and
// what your server checks with /api/v1/pow/siteverify.
//
// `workerUrl` is where your app serves dist/worker.js. There is no default:
// resolving one would need `import.meta`, which is a syntax error in the
// classic scripts many bundles are loaded as. With Vite or webpack, import
// from "mcaptcha-pow/auto" instead, which bundles the worker for you.
export function solve({ instanceUrl, sitekey, workerUrl, signal }) {
  if (!workerUrl) {
    return Promise.reject(new TypeError(
      'workerUrl is required: serve dist/worker.js and pass its URL, or import from "mcaptcha-pow/auto" with Vite or webpack'
    ))
  }
  return solveWithWorker(() => new Worker(workerUrl, { type: "module" }), { instanceUrl, sitekey, signal })
}

export async function solveWithWorker(createWorker, { instanceUrl, sitekey, signal }) {
  const challenge = await fetchChallenge({ instanceUrl, sitekey, signal })
  const solution = await runWorker(createWorker(), challenge, signal)
  return redeemProof({ instanceUrl, sitekey, challenge, solution, signal })
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
