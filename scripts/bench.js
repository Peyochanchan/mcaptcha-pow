// Average solving time per difficulty, over a few challenges each.
//
//   bun run bench        (JavaScriptCore, the engine of Safari)
//   node scripts/bench.js (V8, the engine of Chrome)

import { solveChallenge } from "../src/pow.js"

const DIFFICULTIES = [10_000, 50_000, 200_000, 1_000_000]
const RUNS = 5
const SALT = "a-salt-as-long-as-the-one-an-instance-sends-with-each-challenge"

console.log("difficulty    ms/challenge    hashes/s")

for (const difficultyFactor of DIFFICULTIES) {
  let hashes = 0
  let elapsed = 0

  for (let run = 0; run < RUNS; run++) {
    const challenge = { salt: SALT, string: `bench-${difficultyFactor}-${run}`, difficultyFactor }
    const startedAt = performance.now()
    const { nonce } = solveChallenge(challenge)
    elapsed += performance.now() - startedAt
    hashes += nonce + 1
  }

  const perChallenge = Math.round(elapsed / RUNS)
  const rate = Math.round((hashes / elapsed) * 1000)
  console.log(`${String(difficultyFactor).padStart(10)}    ${String(perChallenge).padStart(12)}    ${String(rate).padStart(8)}`)
}
