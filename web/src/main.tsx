import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

if (import.meta.env.PROD) {
  console.log(
    '%cChatLog Viewer',
    'font-size: 24px; font-weight: bold; color: #d4a853;'
  );
  console.log(
    "%cllm.log — monitor your LLM costs.",
    'font-size: 12px; color: #a09e96;'
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
