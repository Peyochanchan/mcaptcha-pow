// Captures a test vector from a live mCaptcha instance: asks for a challenge,
// solves it with this package, and keeps it only if the instance accepts the
// proof (it answers with a token). The instance URL and sitekey are not saved.
//
//   bun run capture https://mcaptcha.example.org <sitekey>

import { fetchChallenge, redeemProof } from "../src/instance.js"
import { solveChallenge } from "../src/pow.js"

const [instanceUrl, sitekey] = process.argv.slice(2)
if (!instanceUrl || !sitekey) {
  console.error("Usage: bun run capture <instance-url> <sitekey>")
  process.exit(1)
}

const challenge = await fetchChallenge({ instanceUrl, sitekey })

const startedAt = performance.now()
const solution = solveChallenge(challenge)
const elapsed = Math.round(performance.now() - startedAt)

await redeemProof({ instanceUrl, sitekey, challenge, solution })

const file = Bun.file(new URL("../test/fixtures/vectors.json", import.meta.url))
const vectors = (await file.exists()) ? await file.json() : []
vectors.push({ ...challenge, ...solution })
await Bun.write(file, JSON.stringify(vectors, null, 2) + "\n")

console.log(`Accepted by the instance: difficulty ${challenge.difficultyFactor}, nonce ${solution.nonce}, solved in ${elapsed} ms`)
console.log(`${vectors.length} vector(s) in test/fixtures/vectors.json`)
