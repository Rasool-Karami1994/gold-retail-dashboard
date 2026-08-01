/**
 * Recharts styling, derived from the design tokens.
 *
 * Recharts takes colours as SVG attributes, not classes, so these are literal
 * values rather than Tailwind utilities. They mirror the `@theme` block in
 * globals.css -- if you change a token there, change it here too.
 *
 * The categorical series palette is ordered for distinguishability, and every
 * entry clears 3:1 contrast against the `surface` background so a thin line or
 * a small bar segment stays visible.
 */

export const chartColors = {
  grid: "#232b4a",
  axis: "#6e779b",
  tooltipBg: "#1b2342",
  tooltipBorder: "#2f3860",
  text: "#f1f4ff",
  textMuted: "#a9b1d0",
} as const;

/** Series colours, in the order they should be assigned. */
export const chartSeries = [
  "#4c5bf5", // primary
  "#34d399", // success
  "#7c5cff", // accent
  "#f97316", // warning
  "#6e8bff", // info
  "#ef4444", // danger
] as const;

export function seriesColor(index: number): string {
  return chartSeries[index % chartSeries.length]!;
}

/**
 * Axis defaults for RTL.
 *
 * Recharts has no RTL mode. Left to itself it runs the category axis
 * left-to-right and puts the value axis on the left, both of which read
 * backwards in Persian. `reversed` on the X axis and `orientation: "right"` on
 * the Y axis fix that; spread these onto <XAxis> / <YAxis>.
 */
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
    width: 56,
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
    // Recharts renders the tooltip in a plain div outside the RTL flow.
    direction: "rtl" as const,
    fontFamily: "var(--font-sans)",
  },
  labelStyle: { color: chartColors.textMuted, marginBottom: 4 },
  itemStyle: { color: chartColors.text },
  cursor: { fill: "rgba(76, 91, 245, 0.08)" },
} as const;
