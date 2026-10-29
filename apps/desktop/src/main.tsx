import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyPrefs, loadPrefs } from "./lib/prefs";
import "./index.css";

// aplica tema/fonte antes do primeiro render (evita “piscar”)
applyPrefs(loadPrefs());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
