# One-next-action workspace invite

Default Work: TARGET KIND selects the workflow.

Give access + current workspace:
- One card: Give <name> read access to <workspace>?
- One button: Approve & send invite (Human Commit)
- Mint workspace invite scopes ls+read only
- Then: Waiting for <name> to claim
- Then: <name> has read access

Do not use access_grant_create for workspace.
Do not show Route intent / Commit proposal / Dispatch / Task Run / Events / Retention / Code Session / raw JSON for this flow.

Branch implements this in work-guide.js oneNextActionModel + invite mint helper.
