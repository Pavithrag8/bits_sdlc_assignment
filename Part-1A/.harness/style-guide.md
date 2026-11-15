# JavaScript Style Guide — Tasks API (Part 1A)

Mirror of Lab Sheet 2 §4.4, extended for the full Tasks API.

1. Use CommonJS (`require` and `module.exports`).
2. Use **only Node.js built-in modules**. Do not install dependencies
   (zero third-party runtime deps — Constitution "Additional Constraints").
3. Keep functions small and give them descriptive names.
4. Use `const` by default and `let` only when reassignment is required.
5. Return JSON responses with `Content-Type: application/json`.
6. Use the response shape `{ "error": "..." }` for all 4xx responses.
7. Do not hard-code secrets, API keys, or machine-specific paths.
8. Export the server from `src/app.js`; listen **only when `app.js` is run
   directly** (`require.main === module`), so tests can bind an ephemeral
   port (`listen(0)`).
9. Tests must use `node:test` and `node:assert/strict`, start the exported
   server on an ephemeral port, send requests, assert the **exact** HTTP
   status codes, and close the server in a `finally` block.
10. Add concise comments only where the intent is not obvious.
