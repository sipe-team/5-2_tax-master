import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// React 18 + TDS Mobile. react-compiler(React 19 의존)는 제거.
export default defineConfig({
  plugins: [tailwindcss(), react()],
});
