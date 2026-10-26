import { solveChallenge } from "./pow.js"

self.onmessage = ({ data: challenge }) => {
  try {
    self.postMessage({ solution: solveChallenge(challenge) })
  } catch (error) {
    self.postMessage({ error: error.message })
  }
}
