// Entry point for bundlers that emit a worker when they find `new URL(…,
// import.meta.url)` written inside `new Worker(…)`: Vite and webpack. Keep the
// pattern inline, they do not follow it through a variable.
//
// Not for Bun, esbuild or a classic <script>: `import.meta` is a syntax error
// there. Import from "mcaptcha-pow" and pass `workerUrl`.

import { solveWithWorker } from "./solve.js"

export * from "./index.js"

export function solve({ instanceUrl, sitekey, signal }) {
  return solveWithWorker(
    () => new Worker(new URL("./worker.js", import.meta.url), { type: "module" }),
    { instanceUrl, sitekey, signal }
  )
}
