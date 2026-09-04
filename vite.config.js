import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The deployed host name is assigned by the platform at deploy time, so it
  // cannot be listed here; `npm start` serves the built site behind it.
  preview: { allowedHosts: true },
});
