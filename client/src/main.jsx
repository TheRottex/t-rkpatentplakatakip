import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  let wasOffline = navigator.onLine === false;
  let recovering = false;

  window.addEventListener("offline", () => {
    wasOffline = true;
  });

  window.addEventListener("online", async () => {
    if (!wasOffline || recovering) return;
    recovering = true;
    try {
      let response;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          response = await fetch("/api/health", { cache: "no-store" });
          if (response.ok) break;
        } catch {}
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
      }
      if (!response?.ok) return;
      const registration = await navigator.serviceWorker.getRegistration("/");
      await registration?.update();
      wasOffline = false;
      window.location.reload();
    } finally {
      recovering = false;
    }
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      await registration.update();
    } catch (error) {
      console.error("Service worker update failed:", error);
    }
  }, { once: true });
}
