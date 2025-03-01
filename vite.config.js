import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    port: 4000,
    allowedHosts: "02e5-59-88-100-158.ngrok-free.app",
    // allowedHosts: [
    //   "localhost",
    //   "*.ngrok-free.app", // Allows all ngrok hosts
    // ],
  },
});
