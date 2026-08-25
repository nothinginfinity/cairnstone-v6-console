# CairnStone V7 Console

A thin, provider-neutral client for the live CairnStone V7 runtime.

## V7.2 scope

This console intentionally stays inside the V7.2 authority boundary:

- delegated chat uses `cairnstone_delegate`;
- evidence is rendered from the compact delegation result;
- inbox reads use `cairnstone_get_inbox` / `cairnstone_read_message`;
- handoffs use `cairnstone_dispatch_handoff`;
- handoffs may explicitly request an optional GitHub-backed inbox mirror for inspectable asynchronous transport;
- GitHub mirror artifacts are deterministic per-recipient/message files and remain subordinate to the immutable AC1 message stone;
- mirror write failures are isolated and never roll back the canonical AC1 handoff;
- delegated models receive zero tools and zero execution/mutation authority;
- the console does not implement the V7.3 MCP tool broker or autonomous execution loop.

Default runtime: `https://cairnstone-v6.jaredtechfit.workers.dev/mcp`

The browser client talks to the MCP endpoint directly over JSON-RPC.

## Run locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Authority model

The Console is a client, not a source of accepted state. CairnStone chain/path HEADs remain canonical authority. AC1 handoff messages are immutable correspondence artifacts and transport intent only.

The optional GitHub inbox mirror is transport-only. The browser sends only the target owner/repo/branch/path prefix to CairnStone; GitHub credentials remain server-side in the runtime. A mirror artifact records its AC1 stone hash and explicitly carries zero execution, mutation, external-mirror, or accepted-state authority.
