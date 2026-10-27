export interface Challenge {
  salt: string
  string: string
  difficultyFactor: number
}

export interface Solution {
  nonce: number
  /** The score of the winning digest, a u128 written in decimal. */
  result: string
}

export interface InstanceOptions {
  /** The mCaptcha instance, with or without a trailing slash, possibly under a subpath. */
  instanceUrl: string
  /** The sitekey of your site on that instance. It is public. */
  sitekey: string
  /** Aborting stops the worker and rejects with the signal's reason. */
  signal?: AbortSignal
}

export interface SolveOptions extends InstanceOptions {
  /** Where your app serves dist/worker.js. */
  workerUrl: string | URL
}

/** Fetches a challenge, solves it in a worker, and resolves with the token your form submits. */
export function solve(options: SolveOptions): Promise<string>

export function fetchChallenge(options: InstanceOptions): Promise<Challenge>

export function redeemProof(options: InstanceOptions & { challenge: Pick<Challenge, "string">, solution: Solution }): Promise<string>

/** Solves a challenge synchronously, on the current thread. */
export function solveChallenge(challenge: Challenge, options?: { maxNonce?: number }): Solution

export class McaptchaError extends Error {}

/** The instance could not be reached, or did not hand out a valid challenge. */
export class ChallengeError extends McaptchaError {}

/** The worker crashed or gave up before finding a nonce. */
export class SolveError extends McaptchaError {}

/** The instance rejected the proof, or accepted it without returning a token. */
export class VerifyError extends McaptchaError {}
