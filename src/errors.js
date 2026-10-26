export class McaptchaError extends Error {
  constructor(message, options) {
    super(message, options)
    this.name = new.target.name
  }
}

// The instance could not be reached, or did not hand out a challenge.
export class ChallengeError extends McaptchaError {}

// The worker crashed or gave up before finding a nonce.
export class SolveError extends McaptchaError {}

// The instance rejected the proof, or accepted it without returning a token.
export class VerifyError extends McaptchaError {}
