export const HOP_CARD_SNAPSHOT = {
  schema: "cairnstone-hop-card-v0",
  live: false,
  writes_heads: false,
  thread_id: "thread:hop-card-skill-20261006",
  prior_thread_id: "thread:hop-bar-20261006",
  steps: [
    {
      id: "before",
      label: "Before",
      title: "Hop bar repo note",
      pointer: "Read stone 0b9b8b4e path project-memory/hop-bar/2026-10-06-hop-bar-repo-created.md",
      stone: "0b9b8b4e08f764312f4295e7839b2500c150c3b663eeda5c3617be442644d02b",
      path: "project-memory/hop-bar/2026-10-06-hop-bar-repo-created.md",
      thread_id: "thread:hop-bar-20261006",
      notice: "41a1b01e3567955e1cb9e2c74187e932ca0275d3d877e78446385c896210fde2",
      console_href: "./index.html#inbox"
    },
    {
      id: "now",
      label: "Now",
      title: "Hop card skill is in the seeded inboxes",
      pointer: "Read stone 9c858614 thread:hop-card-skill-20261006 as recipient_id grok:cairnstone-v6",
      stone: "9c85861410827564f2786b3dec7e35fbecdab35298c42a1d7df711ed9a60b451",
      path: null,
      thread_id: "thread:hop-card-skill-20261006",
      message_id: "msg:hop-card-skill-20261006-grok",
      console_href: "./index.html#inbox"
    },
    {
      id: "after",
      label: "After",
      title: "Open the next app with the pointer",
      pointer: "Check AC1 inbox thread:hop-card-skill-20261006",
      stone: null,
      path: null,
      thread_id: "thread:hop-card-skill-20261006",
      console_href: "./next-work.html"
    }
  ],
  hops: [
    { name: "ChatGPT", url: "https://chatgpt.com/", param: "q", documented: false },
    { name: "Claude Code", url: "https://claude.ai/code/new", param: "q", documented: true },
    { name: "Grok", url: "https://grok.com/", param: "q", documented: false },
    { name: "Perplexity", url: "https://www.perplexity.ai/search", param: "q", documented: false },
    { name: "Cursor", url: "https://cursor.com/agents", param: null, documented: false },
    { name: "GitHub", url: "https://github.com/nothinginfinity", param: null, documented: false }
  ]
};

export function hopUrl(hop, pointer, prefill) {
  if (!prefill || !hop.param || !pointer) return hop.url;
  const join = hop.url.includes("?") ? "&" : "?";
  return hop.url + join + hop.param + "=" + encodeURIComponent(pointer);
}

export function cardModel(snapshot = HOP_CARD_SNAPSHOT, index = 1) {
  const steps = snapshot.steps;
  const i = Math.max(0, Math.min(steps.length - 1, index));
  return {
    index: i,
    step: steps[i],
    before: steps[i - 1] || null,
    after: steps[i + 1] || null,
    writes_heads: false
  };
}
