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
        background: "#FDF6EC",
        primary: "#22C55E",
        secondary: "#7DD3E8",
        accent: "#F4A5A5",
        dark: "#1E2A38",
      },
      boxShadow: {
        brutal: "4px 4px 0px #1E2A38",
      }
    },
  },
  plugins: [],
};
export default config;
