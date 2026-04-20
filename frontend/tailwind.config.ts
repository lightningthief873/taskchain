import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        avax: "#E84142",
        "avax-dark": "#b52f30",
      },
      fontFamily: {
        mono: ["'Geist Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
