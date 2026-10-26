// An app entry point, as a Rails app would write it.
import { solve } from "../../src/index.js"

window.solveCaptcha = () => solve({ instanceUrl: "https://mcaptcha.example.org", sitekey: "a-sitekey", workerUrl: "/assets/worker.js" })
