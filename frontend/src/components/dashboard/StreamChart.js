import React from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";


const fmtK = (v) => {
  if (v >= 1e7) return (v / 1e7).toFixed(1) + "Cr";
  if (v >= 1e5) return (v / 1e5).toFixed(1) + "L";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "k";
  return Math.round(v);
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="border border-line shadow-2xl overflow-hidden"
      style={{
        background: "rgba(16,19,25,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        minWidth: 140,
      }}
    >
      <div className="px-3 py-2 border-b border-line">
        <p className="data-label text-[10px] text-cobalt">{label}</p>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-[12px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-muted capitalize font-display">{p.name}</span>
            <span className="font-stat tabular-nums text-ink ml-auto pl-4 font-semibold">
              {p.dataKey === "volume" ? "₹" + fmtK(p.value) : Number(p.value).toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Aggregated transaction volume + velocity across visible merchants.
export default function StreamChart({ data, live }) {
  return (
    <div className="w-full h-[300px]" data-testid="stream-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0E76FF" stopOpacity={0.55} />
              <stop offset="60%" stopColor="#0E76FF" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#0E76FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="velFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00E676" stopOpacity={0.35} />
              <stop offset="60%" stopColor="#00E676" stopOpacity={0.05} />
              <stop offset="100%" stopColor="#00E676" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(253,251,247,0.05)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: "rgba(253,251,247,0.35)", fontSize: 10, fontFamily: "Space Mono" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(253,251,247,0.08)" }}
            minTickGap={28}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={fmtK}
            tick={{ fill: "rgba(253,251,247,0.35)", fontSize: 10, fontFamily: "Space Mono" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "rgba(253,251,247,0.35)", fontSize: 10, fontFamily: "Space Mono" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(253,251,247,0.1)", strokeWidth: 1 }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="volume"
            name="volume"
            stroke="#0E76FF"
            strokeWidth={2.5}
            fill="url(#volFill)"
            isAnimationActive={live}
            animationDuration={500}
            dot={false}
            activeDot={{ r: 4, fill: "#0E76FF", strokeWidth: 0 }}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="velocity"
            name="velocity"
            stroke="#00E676"
            strokeWidth={1.5}
            fill="url(#velFill)"
            isAnimationActive={live}
            animationDuration={500}
            dot={false}
            activeDot={{ r: 3, fill: "#00E676", strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
