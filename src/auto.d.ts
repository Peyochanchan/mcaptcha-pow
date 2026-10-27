import type { InstanceOptions } from "./index.js"

export * from "./index.js"

/** Same as the main entry, with the worker bundled by Vite or webpack: no workerUrl. */
export function solve(options: InstanceOptions): Promise<string>
