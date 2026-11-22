import type { GitCommit } from "../lib/types";

interface GraphNode {
  commit: GitCommit;
  lane: number;
}

const COLORS = ["#4f7f66", "#b4714b", "#55768d", "#8b6f99", "#a48b45"];

function layout(commits: GitCommit[]): {
  nodes: GraphNode[];
  lookup: Map<string, GraphNode>;
  lanes: number;
} {
  const lanes: Array<string | null> = [];
  const nodes: GraphNode[] = [];
  for (const commit of commits) {
    let lane = lanes.indexOf(commit.id);
    if (lane < 0) {
      lane = lanes.findIndex((value) => value === null);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = commit.id;
    }
    nodes.push({ commit, lane });
    lanes[lane] = commit.parents[0] ?? null;
    for (const parent of commit.parents.slice(1)) {
      if (lanes.includes(parent)) continue;
      let parentLane = lanes.findIndex((value) => value === null);
      if (parentLane < 0) parentLane = lanes.length;
      lanes[parentLane] = parent;
    }
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
  }
  return {
    nodes,
    lookup: new Map(nodes.map((node) => [node.commit.id, node])),
    lanes: Math.max(1, ...nodes.map((node) => node.lane + 1)),
  };
}

export default function GitGraph({ commits }: { commits: GitCommit[] }) {
  if (commits.length === 0) return <p className="git-empty">No commits yet.</p>;
  const graph = layout(commits);
  const width = graph.lanes * 15 + 12;
  return (
    <div className="git-graph">
      {graph.nodes.map((node) => {
        const x = node.lane * 15 + 9;
        const parents = node.commit.parents
          .map((parent) => graph.lookup.get(parent))
          .filter((parent): parent is GraphNode => Boolean(parent));
        return (
          <article className="commit-row" key={node.commit.id}>
            <svg className="commit-lanes" width={width} height="58" viewBox={`0 0 ${width} 58`} aria-hidden="true">
              <line x1={x} y1="0" x2={x} y2="8" stroke={COLORS[node.lane % COLORS.length]} strokeWidth="1.5" />
              {parents.map((parent) => {
                const parentX = parent.lane * 15 + 9;
                return (
                  <path
                    key={parent.commit.id}
                    d={parentX === x
                      ? `M ${x} 8 L ${x} 54`
                      : `M ${x} 8 C ${x} 30, ${parentX} 24, ${parentX} 54`}
                    fill="none"
                    stroke={COLORS[parent.lane % COLORS.length]}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                );
              })}
              <circle cx={x} cy="8" r="4.2" fill={COLORS[node.lane % COLORS.length]} stroke="#f6f4ef" strokeWidth="2" />
            </svg>
            <div>
              <strong>{node.commit.message.split("\n")[0]}</strong>
              <small>{node.commit.author} · {new Date(node.commit.timestamp * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</small>
              <code>{node.commit.shortId}</code>
            </div>
          </article>
        );
      })}
    </div>
  );
}
