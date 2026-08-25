# CairnStone V7 Console

A thin, provider-neutral client for the live CairnStone V7 runtime.

## V7.2 scope

This console intentionally stays inside the V7.2 authority boundary:

- delegated chat uses `cairnstone_delegate`;
- evidence is rendered from the compact delegation result;
- inbox reads use `cairnstone_get_inbox` / `cairnstone_read_message`;
- handoffs use `cairnstone_dispatch_handoff`;
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
