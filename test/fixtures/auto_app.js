// The same app, importing the entry point meant for Vite and webpack.
import { solve } from "../../src/auto.js"

window.solveCaptcha = () => solve({ instanceUrl: "https://mcaptcha.example.org", sitekey: "a-sitekey" })
