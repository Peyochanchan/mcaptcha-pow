# mcaptcha-pow

[![CI](https://github.com/Peyochanchan/mcaptcha-pow/actions/workflows/ci.yml/badge.svg)](https://github.com/Peyochanchan/mcaptcha-pow/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Dependencies: none](https://img.shields.io/badge/dependencies-none-brightgreen)

Solve [mCaptcha](https://mcaptcha.org) proof-of-work challenges in the browser, without the iframe widget.

```js
import { solve } from "mcaptcha-pow"

const token = await solve({
  instanceUrl: "https://mcaptcha.example.org",
  sitekey: "…",
  workerUrl: "/assets/mcaptcha-pow-worker.js" // dist/worker.js, served by your app
})
// submit the token with the form, verify it on your server
```

## Why

mCaptcha is a privacy-respecting, self-hostable captcha: instead of tracking visitors or asking them to click on traffic lights, it makes the browser spend a little CPU on a proof of work.

Its official widget is an iframe served by the instance. Self-hosted instances usually sit behind a reverse proxy that sends `X-Frame-Options: SAMEORIGIN` or `frame-ancestors 'self'`, and the browser then refuses to embed the widget on any other site. Loosening those headers means a security exception to maintain on every instance.

This package talks to the instance API directly and solves the challenge in a Web Worker: no iframe, no header to relax, and the form keeps its own look.

It runs in production on the contact form of a Rails site: Bun bundle loaded as a classic script, assets served by Sprockets, and a Content Security Policy with `worker-src 'self'`, without `blob:`.

## How it works

1. `POST /api/v1/pow/config` returns a challenge: a salt, a string, and a difficulty factor.
2. A Web Worker looks for a nonce such that the first 16 bytes of `SHA-256(salt ‖ string ‖ nonce)` reach the threshold set by the difficulty.
3. `POST /api/v1/pow/verify` trades the proof for a token.
4. The form submits the token; your server checks it with `POST /api/v1/pow/siteverify`.

The proof of work is the one of the Rust crate behind mCaptcha (`pow_sha256`), reimplemented in plain JavaScript. The test suite includes proofs accepted by a live instance.

## Speed

SHA-256 runs synchronously in the worker, and the constant part of the input (salt and string) is hashed once: each attempt only hashes its last block. That is what the Rust implementation does too.

Average time per challenge, on an Apple Silicon Mac, measured with Bun for JavaScriptCore (Safari's engine) and Node for V8 (Chrome's): `bun run bench`, `node scripts/bench.js`.

| Difficulty | JavaScriptCore | V8 |
|---:|---:|---:|
| 10 000 | 5 ms | 5 ms |
| 50 000 | 12 ms | 11 ms |
| 200 000 | 62 ms | 59 ms |
| 1 000 000 | 734 ms | 631 ms |

About 2.2 million hashes per second. For comparison, a straightforward loop awaiting `crypto.subtle.digest` once per nonce needs about 400 ms at difficulty 50 000.

## Install

```sh
npm install mcaptcha-pow
```

No dependencies: ES modules, and a self-contained worker, `dist/worker.js`, that imports nothing.

### Browser support

Module workers are required: Chrome and Edge 80, Safari 15, Firefox 114 and later. Tested in Chromium-based browsers so far.

### The worker

The proof of work runs in a Web Worker, which the browser only loads from your own origin. Serve `dist/worker.js` with your assets and pass its URL as `workerUrl`. There is no default URL on purpose: guessing one would need `import.meta`, a syntax error in the classic scripts many bundles are loaded as, and it would break every script on the page.

**Rails with jsbundling (Bun, esbuild), or any bundle loaded as a classic script.** Copy the worker into the build output, from your build script:

```js
await Bun.write("app/assets/builds/mcaptcha-pow-worker.js", Bun.file("node_modules/mcaptcha-pow/dist/worker.js"))
```

Propshaft or Sprockets then serve it under a digested name, so browsers never keep a stale version. Pass `asset_path("mcaptcha-pow-worker.js")` to the page (see the [Rails example](#rails-example)).

**Vite, webpack.** Import from `mcaptcha-pow/auto` and leave `workerUrl` out: these bundlers find the worker and emit it for you.

```js
import { solve } from "mcaptcha-pow/auto"

const token = await solve({ instanceUrl, sitekey })
```

`mcaptcha-pow/auto` uses `import.meta`: only use it in a bundle loaded as a module.

## API

### `solve({ instanceUrl, sitekey, workerUrl, signal? })`

Fetches a challenge, solves it in a worker, and resolves with the token.

- `instanceUrl`: the instance, with or without a trailing slash, possibly under a subpath.
- `sitekey`: the sitekey of your site on that instance. It is public.
- `workerUrl`: where your app serves `dist/worker.js` (see above). Required: without it, `solve` rejects with a `TypeError` before calling the instance.
- `signal`: an `AbortSignal`. Aborting stops the worker and rejects with the signal's reason.

It rejects with:

| Error | When |
|---|---|
| `ChallengeError` | The instance is unreachable, answers an error, or sends an invalid challenge |
| `SolveError` | The worker crashed, or gave up |
| `VerifyError` | The instance rejected the proof, or returned no token |

All three extend `McaptchaError`.

### Lower level

- `fetchChallenge({ instanceUrl, sitekey, signal })` → `{ salt, string, difficultyFactor }`
- `solveChallenge(challenge)` → `{ nonce, result }`, synchronously, on the current thread
- `redeemProof({ instanceUrl, sitekey, challenge, solution, signal })` → token

## Deploying

### Content Security Policy

On the site that embeds the form:

```
connect-src 'self' https://mcaptcha.example.org;
worker-src 'self';
```

No `frame-src`, no remote `script-src`, no `blob:`.

### CORS

The browser calls the instance from your site's origin, so the instance must allow it on `/api/v1/pow/config` and `/api/v1/pow/verify`, preflight included:

```
Access-Control-Allow-Origin: https://your-site.example.org
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

An allowlist of origins is best. `*` is acceptable on these two endpoints, since no cookie or credential is involved. Do not open `/api/v1/pow/siteverify`: only your server calls it.

### Verify on the server

The browser only produces a token. **The check that counts is `siteverify`, on your server**, with the account secret that never reaches the browser:

```
POST https://mcaptcha.example.org/api/v1/pow/siteverify
{ "token": "…", "key": "<sitekey>", "secret": "<account secret>" }
→ { "valid": true }
```

Fail closed: the instance answers `200` for an invalid token too, so accept the submission only on an explicit `"valid": true`, and reject it on a timeout, an HTTP error or an unexpected body.

## Rails example

[`examples/`](examples) holds a complete Rails integration:

- [`stimulus/mcaptcha_controller.js`](examples/stimulus/mcaptcha_controller.js): solves when the box is ticked, holds the submission until a token is in, announces each state to screen readers.
- [`rails/_mcaptcha.html.erb`](examples/rails/_mcaptcha.html.erb), [`mcaptcha_helper.rb`](examples/rails/mcaptcha_helper.rb), [`mcaptcha.en.yml`](examples/rails/mcaptcha.en.yml): the widget markup, rendered by the server, with translated labels.
- [`rails/mcaptcha_verification.rb`](examples/rails/mcaptcha_verification.rb): the `siteverify` check, fail-closed, with timeouts.

```erb
<%= form_with model: @message, data: mcaptcha_form_data do |form| %>
  <%= form.text_area :body %>
  <%= render "mcaptcha" %>
  <%= form.submit %>
<% end %>
```

```ruby
def create
  @message = Message.new(message_params)
  return render(:new, status: :unprocessable_content) unless McaptchaVerification.valid?(params[:mcaptcha__token])

  @message.save!
  redirect_to root_path
end
```

## Development

```sh
bun install
bun test               # protocol, SHA-256 against node:crypto, live vectors, classic-script bundles
bun run bench
bun run build          # dist/worker.js
bun run capture <instance-url> <sitekey>   # add a vector accepted by a live instance
```

## License

[MIT](LICENSE)
