// The breadth-first chain search that X-chains and AICs share. The caller
// numbers its nodes (cells for an X-chain, candidates for an AIC) and lists
// each node's links as plain arrays, like adjacency lists in C; this file
// knows nothing about Sudoku.

/** A strong link out of a node: if the node is false, node `to` is true. `label` is the caller's own note on the link. */
export type StrongOut<L> = { to: number; label: L };

/**
 * The graph to search. `strong[i]` and `weak[i]` are node i's links. A weak
 * link joins two nodes of which at most one is true.
 */
export type ChainGraph<L> = { strong: readonly (readonly StrongOut<L>[])[]; weak: readonly (readonly number[])[] };

/**
 * One end of a partial chain. A chain is a linked list through `back`, like a
 * C struct with a parent pointer, so the paths that share a beginning share
 * its nodes. `on` marks the far end of a strong link (the node proved true if
 * the start is false); `link` is the strong link that reached this node, or
 * null after a weak one.
 */
export type ChainPath<L> = {
  at: number;
  on: boolean;
  link: StrongOut<L> | null;
  back: ChainPath<L> | null;
  length: number;
};

/**
 * Searches outward from `start`, taking strong and weak links in turn and
 * starting with a strong one. Each chain of three or more links that ends on
 * a strong link is passed to `found`, shortest first. Each node is reached at
 * most once as true and once as false, by its shortest chain.
 *
 * `limit()` is the length a chain has to beat. It is read again before each
 * path is extended, so `found` can lower it as better chains turn up (the
 * caller keeps its own best, the way a callback in C keeps state in a struct
 * it is handed).
 */
export function searchChains<L>(
  graph: ChainGraph<L>,
  start: number,
  limit: () => number,
  found: (path: ChainPath<L>) => void,
): void {
  // seen[2i] / seen[2i+1]: node i already reached as false / as true.
  const seen = new Uint8Array(graph.weak.length * 2);
  seen[2 * start] = 1;
  let frontier: ChainPath<L>[] = [{ at: start, on: false, link: null, back: null, length: 0 }];
  while (frontier.length > 0) {
    const next: ChainPath<L>[] = [];
    for (const path of frontier) {
      // Nothing longer than the best chain so far can beat it.
      if (path.length + 1 >= limit()) continue;
      for (const grown of extend(graph, path, seen)) {
        next.push(grown);
        if (grown.on && grown.length >= 3) found(grown);
      }
    }
    frontier = next;
  }
}

/** The paths one link longer than `path` that reach a node in a state not seen yet; marks those states seen. */
function extend<L>(graph: ChainGraph<L>, path: ChainPath<L>, seen: Uint8Array): ChainPath<L>[] {
  const steps = path.on ? graph.weak[path.at].map((to) => ({ to, link: null })) : graph.strong[path.at].map((link) => ({ to: link.to, link }));
  const grown: ChainPath<L>[] = [];
  for (const step of steps) {
    const slot = 2 * step.to + (path.on ? 0 : 1);
    if (seen[slot]) continue;
    seen[slot] = 1;
    grown.push({ at: step.to, on: !path.on, link: step.link, back: path, length: path.length + 1 });
  }
  return grown;
}

/**
 * The chain that ends at `path`, from the start: its nodes in order and the
 * labels of its strong links. Strong link i runs from nodes[2i] to
 * nodes[2i+1]. Null when a node appears twice, which makes the chain useless.
 */
export function unwindChain<L>(path: ChainPath<L>): { nodes: number[]; labels: L[] } | null {
  const nodes: number[] = [];
  const labels: L[] = [];
  for (let p: ChainPath<L> | null = path; p; p = p.back) {
    nodes.unshift(p.at);
    if (p.link) labels.unshift(p.link.label);
  }
  return new Set(nodes).size === nodes.length ? { nodes, labels } : null;
}
