/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        rp: {
          bg: "#080808",
          panel: "#111111",
          panel2: "#151515",
          line: "#2A2A2A",
          text: "#F2F2F2",
          muted: "#A3A3A3",
          subtle: "#6F6F6F",
          purple: "#A855F7",
          green: "#B7FF5A",
          cyan: "#6EE7F9",
          yellow: "#FDE047",
        },
      },
      boxShadow: {
        "glow-purple": "0 0 32px rgba(168, 85, 247, 0.18)",
        "glow-green": "0 0 32px rgba(183, 255, 90, 0.18)",
        "glow-cyan": "0 0 32px rgba(110, 231, 249, 0.18)",
        "glow-yellow": "0 0 32px rgba(253, 224, 71, 0.18)",
      },
    },
  },
  plugins: [],
};
