interface NodeWithDeps {
  depends_on_indices: number[];
}

export function hasCycle(nodes: NodeWithDeps[]): boolean {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Array(nodes.length).fill(WHITE);

  function dfs(i: number): boolean {
    if (color[i] === GRAY) return true;
    if (color[i] === BLACK) return false;
    color[i] = GRAY;
    for (const dep of nodes[i]!.depends_on_indices) {
      if (dep < 0 || dep >= nodes.length) continue;
      if (dfs(dep)) return true;
    }
    color[i] = BLACK;
    return false;
  }

  for (let i = 0; i < nodes.length; i++) {
    if (color[i] === WHITE && dfs(i)) return true;
  }
  return false;
}

/**
 * Find any cycle in a dependency map keyed by task id.
 * Map semantics: `map.get(id)` returns the list of upstream task ids that `id` depends on.
 * Returns the cycle path (first === last) when a cycle exists, or null when the graph is a DAG.
 */
export function findCycleById(deps: Map<number, number[]>): number[] | null {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<number, number>();
  for (const id of deps.keys()) color.set(id, WHITE);

  function dfs(start: number): number[] | null {
    const stack: Array<{ id: number; iter: Iterator<number> }> = [];
    color.set(start, GRAY);
    stack.push({ id: start, iter: (deps.get(start) ?? [])[Symbol.iterator]() });

    while (stack.length > 0) {
      const top = stack[stack.length - 1]!;
      const next = top.iter.next();
      if (next.done) {
        color.set(top.id, BLACK);
        stack.pop();
        continue;
      }
      const child = next.value;
      if (child === top.id) {
        return [child, child];
      }
      const c = color.get(child);
      if (c === GRAY) {
        const path: number[] = [];
        for (let i = 0; i < stack.length; i++) {
          const node = stack[i]!.id;
          if (path.length > 0 || node === child) {
            path.push(node);
          }
        }
        path.push(child);
        return path;
      }
      if (c === undefined || c === WHITE) {
        if (c === undefined) color.set(child, WHITE);
        color.set(child, GRAY);
        stack.push({ id: child, iter: (deps.get(child) ?? [])[Symbol.iterator]() });
      }
    }
    return null;
  }

  for (const id of deps.keys()) {
    if (color.get(id) === WHITE) {
      const cycle = dfs(id);
      if (cycle) return cycle;
    }
  }
  return null;
}
