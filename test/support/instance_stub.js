import { afterEach } from "bun:test"

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

// Stands in for an mCaptcha instance: answers each path with the given
// response, and records the requests.
export function stubInstance(responses) {
  const requests = []
  globalThis.fetch = async (url, options) => {
    const { pathname } = new URL(url)
    requests.push({ url, path: pathname, body: JSON.parse(options.body) })
    const { status = 200, json } = responses[pathname]
    return new Response(JSON.stringify(json), { status })
  }
  return requests
}
