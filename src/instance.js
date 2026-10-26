// The two calls a browser makes to an mCaptcha instance.

import { ChallengeError, VerifyError } from "./errors.js"
import { isDifficultyFactor } from "./pow.js"

export async function fetchChallenge({ instanceUrl, sitekey, signal }) {
  const { salt, string, difficulty_factor } = await postJson(endpoint(instanceUrl, "config"), { key: sitekey }, { signal, error: ChallengeError })

  // An instance can answer 200 with an unexpected body: fail here, with the
  // right error, rather than inside the worker.
  if (!isNonEmptyString(salt) || !isNonEmptyString(string) || !isDifficultyFactor(difficulty_factor)) {
    throw new ChallengeError("The instance answered without a valid challenge (salt, string, difficulty_factor)")
  }

  return { salt, string, difficultyFactor: difficulty_factor }
}

// Trades a solved challenge for the token the form submits.
export async function redeemProof({ instanceUrl, sitekey, challenge, solution, signal }) {
  const { token } = await postJson(endpoint(instanceUrl, "verify"), {
    key: sitekey,
    string: challenge.string,
    nonce: solution.nonce,
    result: solution.result
  }, { signal, error: VerifyError })

  if (!isNonEmptyString(token)) throw new VerifyError("The instance accepted the proof but returned no token")
  return token
}

// Resolved against the instance URL with or without a trailing slash, and
// under a subpath if the instance is served from one.
function endpoint(instanceUrl, name) {
  const base = instanceUrl.endsWith("/") ? instanceUrl : `${instanceUrl}/`
  return new URL(`api/v1/pow/${name}`, base).href
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0
}

async function postJson(url, body, { signal, error: ErrorClass }) {
  let response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal
    })
  } catch (cause) {
    if (signal?.aborted) throw signal.reason
    throw new ErrorClass(`Could not reach ${url}`, { cause })
  }

  if (!response.ok) throw new ErrorClass(`${url} answered ${response.status}`)

  try {
    return await response.json()
  } catch (cause) {
    throw new ErrorClass(`${url} did not answer with JSON`, { cause })
  }
}
