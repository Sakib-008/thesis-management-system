// Shared chart styling. Colours are plain hex because SVG attributes can't read the CSS theme variables;
// only the tooltip box uses the theme variables, since it is regular HTML.
export const AXIS_TICK = { fontSize: 12, fill: "#94a3b8" };
export const GRID = "rgba(148,163,184,0.25)";
export const CURSOR = { fill: "rgba(148,163,184,0.12)" };
export const TOOLTIP = {
  contentStyle: {
    background: "rgb(var(--surface))",
    border: "1px solid rgb(var(--line))",
    borderRadius: 8,
    fontSize: 12,
    color: "rgb(var(--ink))",
  },
  labelStyle: { color: "rgb(var(--ink))" },
  itemStyle: { color: "rgb(var(--ink))" },
};