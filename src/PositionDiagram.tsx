import { useMemo } from "react";
import { POSITIONS, type Gem } from "./types";

const CENTER = { x: 120, y: 80 };

function ring(count: number, radius: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return {
      x: CENTER.x + radius * Math.cos(angle),
      y: CENTER.y + radius * Math.sin(angle),
    };
  });
}

/** 镶嵌位置示意图：高亮当前批次中已有宝石的位置 */
export function PositionDiagram({ gems }: { gems: Gem[] }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of gems) {
      map[g.position] = (map[g.position] ?? 0) + 1;
    }
    return map;
  }, [gems]);

  const on = (pos: string) => (counts[pos] ? "on" : "");

  return (
    <div className="diagram">
      <svg viewBox="0 0 240 170" role="img" aria-label="镶嵌位置示意图">
        <path className={`band ${on("戒臂")}`} d="M 92 152 Q 46 128 40 88" />
        <path className={`band ${on("戒臂")}`} d="M 148 152 Q 194 128 200 88" />
        {ring(12, 50).map((p, i) => (
          <circle
            key={`b-${i}`}
            className={`zone ${on("围石B组")}`}
            cx={p.x}
            cy={p.y}
            r={3}
          />
        ))}
        {ring(8, 36).map((p, i) => (
          <circle
            key={`a-${i}`}
            className={`zone ${on("围石A组")}`}
            cx={p.x}
            cy={p.y}
            r={4}
          />
        ))}
        <circle className={`zone ${on("副石位")}`} cx={54} cy={80} r={8.5} />
        <circle className={`zone ${on("副石位")}`} cx={186} cy={80} r={8.5} />
        <circle
          className={`zone main ${on("主石位")}`}
          cx={CENTER.x}
          cy={CENTER.y}
          r={22}
        />
      </svg>
      <div className="legend">
        {POSITIONS.map((pos) => (
          <span key={pos} className={counts[pos] ? "on" : ""}>
            {pos} · {counts[pos] ?? 0}
          </span>
        ))}
      </div>
    </div>
  );
}
