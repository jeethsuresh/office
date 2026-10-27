import React from "react";
import { createRoot } from "react-dom/client";
import { FederatedApp } from "./FederatedApp";
import "@office/ui/styles.css";
import { registerPWA } from "./pwa";
registerPWA();
createRoot(document.getElementById("root")!).render(<FederatedApp />);
