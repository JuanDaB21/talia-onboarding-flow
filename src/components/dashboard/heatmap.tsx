import { cn } from "@/lib/utils";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function Heatmap({ data }: { data: number[][] }) {
  const flat = data.flat();
  const max = Math.max(1, ...flat);
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="grid" style={{ gridTemplateColumns: "auto repeat(24, minmax(18px, 1fr))" }}>
          <div />
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-center text-[10px] text-muted-foreground">
              {h % 3 === 0 ? h : ""}
            </div>
          ))}
          {DIAS.map((d, di) => (
            <div key={d} className="contents">
              <div className="pr-2 text-xs text-muted-foreground">{d}</div>
              {Array.from({ length: 24 }).map((_, hi) => {
                const v = data[di][hi];
                const op = v === 0 ? 0 : 0.1 + (v / max) * 0.9;
                return (
                  <div
                    key={hi}
                    title={`${d} ${hi}:00 · $${Math.round(v).toLocaleString()}`}
                    className={cn("aspect-square rounded-sm border border-border/30")}
                    style={{ backgroundColor: v === 0 ? "transparent" : `color-mix(in oklab, hsl(var(--primary)) ${op * 100}%, transparent)` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
