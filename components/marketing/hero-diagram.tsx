/**
 * Hero product visual — a small, tidy architecture diagram rendered as SVG.
 * Purely illustrative. Theme-aware via CSS variables (works in light + dark).
 * Node accent colors match the app's node categories (lib/canvas-utils.ts).
 */

interface Node {
  x: number;
  y: number;
  label: string;
  cat: string;
  color: string;
}

const W = 132;
const H = 52;

const NODES: Record<string, Node> = {
  client: { x: 16, y: 104, label: "Web Client", cat: "CLIENT", color: "#0ea5e9" },
  gateway: { x: 196, y: 104, label: "API Gateway", cat: "GATEWAY", color: "#0891b2" },
  order: { x: 376, y: 28, label: "Order Service", cat: "SERVICE", color: "#2563eb" },
  auth: { x: 376, y: 180, label: "Auth Service", cat: "SERVICE", color: "#2563eb" },
  db: { x: 556, y: 28, label: "PostgreSQL", cat: "DATABASE", color: "#16a34a" },
  cache: { x: 556, y: 180, label: "Redis", cat: "CACHE", color: "#f97316" },
};

/** Center-right of a node → center-left of another, with a mid-point label. */
function edge(from: Node, to: Node) {
  const x1 = from.x + W;
  const y1 = from.y + H / 2;
  const x2 = to.x;
  const y2 = to.y + H / 2;
  const midX = (x1 + x2) / 2;
  return { x1, y1, x2, y2, midX, midY: (y1 + y2) / 2 };
}

const EDGES: { from: Node; to: Node; label: string }[] = [
  { from: NODES.client, to: NODES.gateway, label: "HTTPS" },
  { from: NODES.gateway, to: NODES.order, label: "routes" },
  { from: NODES.gateway, to: NODES.auth, label: "verifies" },
  { from: NODES.order, to: NODES.db, label: "queries" },
  { from: NODES.order, to: NODES.cache, label: "caches" },
];

export function HeroDiagram() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl shadow-black/10">
      {/* Window chrome */}
      <div className="flex h-10 items-center gap-1.5 border-b border-[var(--border-default)] px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--state-error)]/50" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--state-warning)]/50" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--state-success)]/50" />
        <span className="ml-3 text-xs text-[var(--text-muted)]">SYPI · E-Commerce Platform</span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[var(--state-success)]/12 px-2 py-0.5 text-[10px] font-medium text-[var(--state-success)]">
          Plan approved
        </span>
      </div>

      {/* Canvas */}
      <div
        className="p-2"
        style={{
          backgroundImage:
            "radial-gradient(circle, color-mix(in srgb, var(--text-muted) 28%, transparent) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      >
        <svg viewBox="0 0 704 260" className="w-full" role="img" aria-label="Architecture diagram preview">
          {/* Edges */}
          {EDGES.map((e, i) => {
            const g = edge(e.from, e.to);
            return (
              <g key={i}>
                <line
                  x1={g.x1}
                  y1={g.y1}
                  x2={g.x2}
                  y2={g.y2}
                  stroke="var(--border-subtle)"
                  strokeWidth={1.5}
                />
                <g transform={`translate(${g.midX}, ${g.midY})`}>
                  <rect x={-22} y={-9} width={44} height={18} rx={5} fill="var(--bg-base)" stroke="var(--border-default)" strokeWidth={1} />
                  <text x={0} y={3} textAnchor="middle" fontSize={10} fill="var(--text-muted)" className="font-mono">
                    {e.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Nodes */}
          {Object.entries(NODES).map(([key, n]) => (
            <g key={key} transform={`translate(${n.x}, ${n.y})`}>
              <rect width={W} height={H} rx={10} fill="var(--bg-base)" stroke="var(--border-subtle)" strokeWidth={1.5} />
              <rect width={4} height={H} rx={2} fill={n.color} />
              <text x={14} y={21} fontSize={12} fontWeight={600} fill="var(--text-primary)">
                {n.label}
              </text>
              <text x={14} y={38} fontSize={9} fontWeight={600} fill={n.color} className="font-mono">
                {n.cat}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
