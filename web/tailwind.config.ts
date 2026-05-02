import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          0: "#050a0d",
          1: "#0a1216",
          2: "#121e24",
          3: "#1a2a32",
          4: "#233640",
        },
        ink: {
          DEFAULT: "#eaf6f4",
          2: "#b6cdca",
          3: "#7d9591",
          4: "#506663",
        },
        brand: {
          DEFAULT: "#00b894",
          bright: "#2af0c4",
        },
        accent: {
          coral: "#ff6b5b",
          cyan: "#5cc8ff",
          green: "#46e8a4",
          red: "#ff5d72",
          amber: "#ffc857",
        },
        line: {
          DEFAULT: "#1f323b",
          soft: "#162428",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        glow: "0 4px 16px rgba(42, 240, 196, 0.32)",
        cardLeft: "inset 3px 0 0 #2af0c4",
      },
      borderRadius: {
        card: "16px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
