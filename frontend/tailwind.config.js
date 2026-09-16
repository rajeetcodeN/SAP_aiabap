/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sap: {
          blue: "#0a6ed1",
          dark: "#1c2d42",
          light: "#f5f6f8",
          border: "#d9d9d9",
        }
      }
    },
  },
  plugins: [],
}
