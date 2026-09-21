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
        background: {
          DEFAULT: "#F4F5F6", // Off-white background
          card: "#FFFFFF",     // White card background
          hover: "#EAECEF",    // Hover background
        },
        primary: {
          DEFAULT: "#1F57E7", // Royal Blue
          hover: "#1542B8",
          glow: "rgba(31, 87, 231, 0.12)",
        },
        secondary: {
          DEFAULT: "#8B5CF6", // Purple (for AI)
          hover: "#7C3AED",
          glow: "rgba(139, 92, 246, 0.12)",
        },
        severity: {
          critical: "#EF4444", // Red
          high: "#F97316",     // Orange
          medium: "#F59E0B",   // Yellow
          low: "#3B82F6",      // Blue
          info: "#71717A",     // Gray
        },
        border: {
          DEFAULT: "rgba(0, 0, 0, 0.08)",
          hover: "rgba(0, 0, 0, 0.15)",
          active: "rgba(31, 87, 231, 0.3)",
        },
        text: {
          primary: "#171717",   // Dark charcoal primary text
          secondary: "#5C5E62", // Muted secondary text
          muted: "#71717A",     // Subdued text
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px 0 rgba(31, 87, 231, 0.08)",
        "glow-purple": "0 0 20px 0 rgba(139, 92, 246, 0.08)",
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "4px",
      }
    },
  },
  plugins: [],
};

export default config;
