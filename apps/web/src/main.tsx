import React from "react";
import { createRoot } from "react-dom/client";
import { FederatedApp } from "./FederatedApp";
import "@office/ui/styles.css";
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
createRoot(document.getElementById("root")!).render(<FederatedApp />);
