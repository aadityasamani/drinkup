import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pool: "var(--pool)",
        dieCut: "var(--die-cut)",
        fizz: "var(--fizz)",
        fizzEdge: "var(--fizz-edge)",
        bubblegum: "var(--bubblegum)",
        sheet: "var(--sheet)",
        sheetDot: "var(--sheet-dot)",
        card: "var(--card)",
        line: "var(--line)",
        text: "var(--text)",
        muted: "var(--muted)",
        ink: "var(--ink)",
        onPool: "var(--on-pool)",
        onPoolSoft: "var(--on-pool-soft)",
      },
      fontFamily: {
        display: [
          "var(--font-display)",
          "'Bricolage Grotesque'",
          "'Segoe UI Variable Display'",
          "'Segoe UI'",
          "system-ui",
          "sans-serif",
        ],
        label: [
          "var(--font-label)",
          "'Space Mono'",
          "'Cascadia Mono'",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        sticker: "0 10px 24px var(--shadow-sheet), 0 2px 4px rgba(10, 16, 60, 0.08)",
        keycap: "0 3px 0 var(--fizz-edge)",
        keycapHover: "0 4px 0 var(--fizz-edge)",
        keycapActive: "0 1px 0 var(--fizz-edge)",
      },
      keyframes: {
        slap: {
          "0%": {
            opacity: "0",
            transform: "translateY(-8px) rotate(-10deg) scale(1.2)",
          },
          "45%": {
            opacity: "1",
            transform: "translateY(0) rotate(.5deg) scale(.96)",
          },
          "72%": {
            transform: "rotate(-2.4deg) scale(1.015)",
          },
          "100%": {
            opacity: "1",
            transform: "rotate(-1.5deg) scale(1)",
          },
        },
        "tag-pop": {
          "0%": { transform: "rotate(-16deg) scale(0)" },
          "70%": { transform: "rotate(-3deg) scale(1.12)" },
          "100%": { transform: "rotate(-5deg) scale(1)" },
        },
        "chip-pop": {
          "0%": { transform: "scale(0.92)" },
          "60%": { transform: "scale(1.04)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        slap: "slap 0.46s cubic-bezier(0.2, 0.8, 0.3, 1) both",
        "tag-pop": "tag-pop 0.38s cubic-bezier(0.2, 0.8, 0.3, 1) both",
        "chip-pop": "chip-pop 0.22s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
