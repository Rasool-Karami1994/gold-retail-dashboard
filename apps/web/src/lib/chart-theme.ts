export const chartColors = {
  grid: "#232b4a",
  axis: "#6e779b",
  tooltipBg: "#1b2342",
  tooltipBorder: "#2f3860",
  text: "#f1f4ff",
  textMuted: "#a9b1d0",
} as const;

export const chartSeries = [
  "#4c5bf5",
  "#34d399",
  "#7c5cff",
  "#f97316",
  "#6e8bff",
  "#ef4444",
] as const;

export function seriesColor(index: number): string {
  return chartSeries[index % chartSeries.length]!;
}

export const rtlAxisProps = {
  x: {
    reversed: true,
    tickLine: false,
    axisLine: { stroke: chartColors.grid },
    tick: { fill: chartColors.axis, fontSize: 11 },
  },
  y: {
    orientation: "right" as const,
    tickLine: false,
    axisLine: false,
    tick: { fill: chartColors.axis, fontSize: 11 },
    width: "auto" as const,
  },
} as const;

export const gridProps = {
  stroke: chartColors.grid,
  strokeDasharray: "3 3",
  vertical: false,
} as const;

export const tooltipProps = {
  contentStyle: {
    background: chartColors.tooltipBg,
    border: `1px solid ${chartColors.tooltipBorder}`,
    borderRadius: 10,
    fontSize: 12,
    direction: "rtl" as const,
    fontFamily: "var(--font-sans)",
  },
  labelStyle: { color: chartColors.textMuted, marginBottom: 4 },
  itemStyle: { color: chartColors.text },
  cursor: { fill: "rgba(76, 91, 245, 0.08)" },
} as const;
