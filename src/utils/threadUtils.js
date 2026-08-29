// Reading a graph as a conversation.
//
// The graph is the navigation surface; a thread is what you actually read. A
// thread is the path from the root down to a node, which is the sequence of
// exchanges that produced it.

// Walks parents from a node up to its root, oldest first.
export const threadForNode = (nodeId, nodes, connections) => {
  if (nodeId === null || nodeId === undefined || !nodes.length) return [];

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parentOf = new Map();
  for (const conn of connections || []) parentOf.set(conn.to, conn.from);

  const thread = [];
  const seen = new Set();
  let cursor = nodeId;

  while (cursor !== undefined && cursor !== null && byId.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor);
    thread.unshift(byId.get(cursor));
    cursor = parentOf.get(cursor);
  }

  return thread;
};

// Nodes sharing a parent are alternative continuations of the same point, so
// they can be compared against each other.
export const siblingsOf = (nodeId, nodes, connections) => {
  if (nodeId === null || nodeId === undefined) return [];

  const parentOf = new Map();
  for (const conn of connections || []) parentOf.set(conn.to, conn.from);

  const parent = parentOf.get(nodeId);
  if (parent === undefined) {
    // Roots are siblings of the other roots.
    return nodes.filter((n) => !parentOf.has(n.id));
  }

  return nodes.filter((n) => parentOf.get(n.id) === parent);
};

export const childrenOf = (nodeId, nodes, connections) => {
  const childIds = new Set(
    (connections || []).filter((c) => c.from === nodeId).map((c) => c.to)
  );
  return nodes.filter((n) => childIds.has(n.id));
};

// A quoted excerpt anchors a follow-up to the exact passage it came from,
// rather than to the whole reply.
export const buildQuotePrompt = (quote, question, sourceLabel) => {
  const trimmed = (quote || '').trim();
  if (!trimmed) return question;

  const from = sourceLabel ? ` from "${sourceLabel}"` : '';
  return `CONTEXT: continuing from this passage${from}:

> ${trimmed.replace(/\n/g, '\n> ')}

NEW REQUEST: ${question}`;
};
