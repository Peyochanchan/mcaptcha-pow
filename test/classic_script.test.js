import { describe, expect, test } from "bun:test"

// Many apps load their bundle as a classic <script>, not a module: Rails with
// jsbundling (Bun, esbuild) does. There, `import.meta` or a leftover `export`
// is a syntax error that takes down every script on the page, even in a branch
// that never runs. `new Function` parses its body as a classic script.
const parsesAsClassicScript = (code) => () => new Function(code)

const bundle = async (entrypoint, format) => {
  const { success, outputs, logs } = await Bun.build({ entrypoints: [entrypoint], format, target: "browser" })
  if (!success) throw new AggregateError(logs, `Could not bundle ${entrypoint}`)
  return outputs[0].text()
}

describe("bundled into an app loaded as a classic script", () => {
  // What a Rails app does: Bun's default ESM output of an entry with no exports.
  test("an app importing mcaptcha-pow", async () => {
    const code = await bundle(`${import.meta.dir}/fixtures/classic_app.js`, "esm")
    expect(parsesAsClassicScript(code)).not.toThrow()
  })

  test("mcaptcha-pow as an IIFE", async () => {
    const code = await bundle(`${import.meta.dir}/../src/index.js`, "iife")
    expect(parsesAsClassicScript(code)).not.toThrow()
  })

  // The worker is started with { type: "module" }, but holds no import either.
  test("the self-contained worker", async () => {
    const code = await bundle(`${import.meta.dir}/../src/worker.js`, "esm")
    expect(parsesAsClassicScript(code)).not.toThrow()
  })

  test("but not mcaptcha-pow/auto, which needs a module-aware bundler", async () => {
    const code = await bundle(`${import.meta.dir}/fixtures/auto_app.js`, "esm")
    expect(parsesAsClassicScript(code)).toThrow(SyntaxError)
  })
})
