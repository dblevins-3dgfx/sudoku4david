import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchChains, unwindChain, type ChainGraph, type ChainPath, type StrongOut } from "./chain";

/** A graph on `size` nodes from two-way strong links [a, b, label] and two-way weak links [a, b]. */
function graphOf(size: number, strong: [number, number, string][], weak: [number, number][]): ChainGraph<string> {
  const strongOut: StrongOut<string>[][] = Array.from({ length: size }, () => []);
  const weakOut: number[][] = Array.from({ length: size }, () => []);
  for (const [a, b, label] of strong) {
    strongOut[a].push({ to: b, label });
    strongOut[b].push({ to: a, label });
  }
  for (const [a, b] of weak) {
    weakOut[a].push(b);
    weakOut[b].push(a);
  }
  return { strong: strongOut, weak: weakOut };
}

/** Every chain the search reports from `start`, as its node list, in the order reported. */
function chainsFrom(graph: ChainGraph<string>, start: number, limit = () => Infinity): number[][] {
  const out: number[][] = [];
  searchChains(graph, start, limit, (path) => out.push(unwindChain(path)!.nodes));
  return out;
}

describe("chain search", () => {
  it("reports a strong-weak-strong chain with its nodes and link labels", () => {
    const graph = graphOf(4, [[0, 1, "A"], [2, 3, "B"]], [[1, 2]]);
    const found: ChainPath<string>[] = [];
    searchChains(graph, 0, () => Infinity, (path) => found.push(path));
    assert.equal(found.length, 1);
    assert.equal(found[0].length, 3);
    assert.deepEqual(unwindChain(found[0]), { nodes: [0, 1, 2, 3], labels: ["A", "B"] });
  });

  it("reports shorter chains first, and stops at the limit the caller lowers", () => {
    const graph = graphOf(6, [[0, 1, "A"], [2, 3, "B"], [4, 5, "C"]], [[1, 2], [3, 4]]);
    assert.deepEqual(chainsFrom(graph, 0), [
      [0, 1, 2, 3],
      [0, 1, 2, 3, 4, 5],
    ]);
    let best = Infinity;
    const lowered: number[][] = [];
    searchChains(graph, 0, () => best, (path) => {
      lowered.push(unwindChain(path)!.nodes);
      best = path.length;
    });
    assert.deepEqual(lowered, [[0, 1, 2, 3]], "the five-link chain can't beat a three-link one");
  });

  it("starts with a strong link and ends on one", () => {
    // From node 0 the only link is weak, so no chain starts there. From node
    // 1 the chain 1-2-0 ends on a weak link, which proves nothing.
    const graph = graphOf(3, [[1, 2, "A"]], [[0, 1], [2, 0]]);
    assert.deepEqual(chainsFrom(graph, 0), []);
    assert.deepEqual(chainsFrom(graph, 1), []);
  });

  it("reaches each node in each state once, by its shortest chain", () => {
    // Two equally short routes lead to node 2 (through 1 or through 4), but
    // the chain on to 3 is reported once.
    const graph = graphOf(5, [[0, 1, "A"], [0, 4, "B"], [2, 3, "C"]], [[1, 2], [4, 2]]);
    assert.deepEqual(chainsFrom(graph, 0), [[0, 1, 2, 3]]);
  });

  it("unwinding gives null when a node appears twice", () => {
    // 0 -A- 1 ~ 0 -A- 1: built by hand, since the search itself never
    // revisits a node in the same state.
    const p0: ChainPath<string> = { at: 0, on: false, link: null, back: null, length: 0 };
    const p1: ChainPath<string> = { at: 1, on: true, link: { to: 1, label: "A" }, back: p0, length: 1 };
    const p2: ChainPath<string> = { at: 0, on: false, link: null, back: p1, length: 2 };
    const p3: ChainPath<string> = { at: 1, on: true, link: { to: 1, label: "A" }, back: p2, length: 3 };
    assert.equal(unwindChain(p3), null);
  });
});
