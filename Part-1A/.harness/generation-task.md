# Generation Task — Tasks API (Part 1A)

Generate a Node.js implementation and its automated tests from the supplied
OpenAPI contract.

Required output JSON:

```
{
  "appJs": "complete contents of src/app.js",
  "testJs": "complete contents of tests/app.test.js"
}
```

The implementation MUST use Node's native `http` module, export the server,
and listen only when run directly. The tests MUST start the exported server
on an ephemeral port (`listen(0)`), send one valid request and one invalid
request **per endpoint**, assert the **exact** HTTP status codes (see
harness-rules.md #8), and close the server in a `finally` block.

The deterministic runner (`.harness/run_all.js`) writes these two files to
the working directory, runs `sensor.js`, and on failure feeds **only** the
observed `findings[]` back for a bounded repair (max 2 attempts). No LLM and
no network call is made.
