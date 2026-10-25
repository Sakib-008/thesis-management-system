import type { Config } from "tailwindcss";

// Colours come from CSS variables (see globals.css) so light and dark mode share one set of class names.
const rgb = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: rgb("canvas"),
        surface: rgb("surface"),
        ink: rgb("ink"),
        subtle: rgb("subtle"),
        line: rgb("line"),
        brand: rgb("brand"),
        "on-brand": rgb("on-brand"),
        success: rgb("success"),
        warning: rgb("warning"),
        danger: rgb("danger"),
        info: rgb("info"),
      },
      boxShadow: {
        soft: "0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px rgb(15 23 42 / 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;