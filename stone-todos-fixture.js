/**
 * Illustrative local samples, NOT accepted vault state.
 * Repeated-digit hashes and sample paths are placeholders, not retrievable stones.
 */
export const STONE_TODOS_FIXTURE = Object.freeze([
  Object.freeze({
    todo_id: 'sample-operator-review',
    title: 'Review the Next Work operator flow',
    why_next: 'Confirm the copy-and-paste handoff is clear before adding live data.',
    destination_actor: 'grok:cairnstone-v6',
    asked_outcome: 'Return a short read-only review of the card fields and operator handoff; list unclear labels. Do not change code or accepted state.',
    source_stone_hash: '1'.repeat(64),
    source_path: 'samples/next-work/operator-review.md',
    status: 'ready',
    sequence: 1,
    sample: true
  }),
  Object.freeze({
    todo_id: 'sample-phone-checklist',
    title: 'Prepare an iPhone acceptance checklist',
    why_next: 'The operator primarily uses iPhone; copying must remain usable on a narrow screen.',
    destination_actor: 'chatgpt:cairnstone-v6',
    asked_outcome: 'Draft a checklist for card readability, source wrapping, prompt preview, clipboard success and failure, and manual paste. No deployment or runtime mutation.',
    source_stone_hash: '2'.repeat(64),
    source_path: 'samples/next-work/phone-checklist.md',
    status: 'queued',
    sequence: 2,
    sample: true
  }),
  Object.freeze({
    todo_id: 'sample-read-adapter',
    title: 'Review the future read-only adapter boundary',
    why_next: 'Keep the board a projection rather than a second source of truth.',
    destination_actor: 'claude:cairnstone-v6',
    asked_outcome: 'Describe a bounded read-only adapter contract and its failure states. Propose only; do not create a chain, schema, stone, or write integration.',
    source_stone_hash: '3'.repeat(64),
    source_path: 'samples/next-work/read-adapter.md',
    status: 'blocked',
    sequence: 3,
    sample: true
  })
]);