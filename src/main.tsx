import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { storage } from "@/lib/storage";

async function init() {
  try {
    await storage.init();
  } catch (e) {
    console.warn("storage init failed", e);
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

init();
