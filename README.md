# CairnStone V7 Console

A thin, provider-neutral client for the live CairnStone V7 runtime.

## V7.3.3 scope

The Console now includes the first trusted human-confirmation surface for V7.3.3 while preserving the V7.2 read-only delegation boundary:

- delegated chat uses `cairnstone_delegate`;
- evidence is rendered from the compact delegation result;
- inbox reads use `cairnstone_get_inbox` / `cairnstone_read_message`;
- handoffs use `cairnstone_dispatch_handoff`;
- handoffs may explicitly request an optional GitHub-backed inbox mirror for inspectable asynchronous transport;
- GitHub mirror artifacts are deterministic per-recipient/message files and remain subordinate to the immutable AC1 message stone;
- mirror write failures are isolated and never roll back the canonical AC1 handoff;
- delegated models receive zero tools and zero execution/mutation authority;
- V7.3.3 pending mutation requests are reviewed in the **Authorize** tab;
- approval/denial uses REST-only operator endpoints that are deliberately absent from the MCP tool catalog;
- the operator bearer comes from the Worker secret `CAIRNSTONE_OPERATOR_TOKEN`, is entered by the human operator, and is stored only in browser `sessionStorage`;
- approval binds to the immutable request Stone, exact argument digest, and concurrency guard; execution accepts no replacement mutation arguments;
- the server atomically consumes one grant, rechecks the reviewed guard, executes once, independently reads back the result, and writes immutable grant/execution evidence;
- a missing operator secret fails closed and leaves all pending requests non-executable.

Default runtime: `https://cairnstone-v6.jaredtechfit.workers.dev/mcp`

The browser client talks to the MCP endpoint directly over JSON-RPC.

## Run locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Operator setup

Set a strong Worker secret named `CAIRNSTONE_OPERATOR_TOKEN` on `cairnstone-v6`. Do **not** put it in this repository or any model prompt. The human operator enters it in the Authorize tab for the browser session only. The optional plain-text binding `CAIRNSTONE_OPERATOR_SUBJECT` may name the human/operator identity recorded in grant evidence; otherwise the runtime records `operator:cairnstone-console`.

## Authority model

The Console is a client, not a source of accepted state. CairnStone chain/path HEADs remain canonical authority. AC1 handoff messages are immutable correspondence artifacts and transport intent only.

The optional GitHub inbox mirror is transport-only. The browser sends only the target owner/repo/branch/path prefix to CairnStone; GitHub credentials remain server-side in the runtime. A mirror artifact records its AC1 stone hash and explicitly carries zero execution, mutation, external-mirror, or accepted-state authority.
