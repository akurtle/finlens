import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#09111f",
        mist: "#f5f7fb",
        accent: "#0f766e",
        signal: "#f97316",
        skyglass: "#d9f4ff"
      },
      boxShadow: {
        panel: "0 20px 50px rgba(15, 23, 42, 0.12)"
      },
      backgroundImage: {
        mesh:
          "radial-gradient(circle at top left, rgba(15, 118, 110, 0.18), transparent 32%), radial-gradient(circle at top right, rgba(249, 115, 22, 0.18), transparent 24%), radial-gradient(circle at bottom, rgba(59, 130, 246, 0.14), transparent 30%)"
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        reveal: "reveal 0.6s ease-out both"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" }
        },
        reveal: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
