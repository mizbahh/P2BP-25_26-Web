import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./App.tsx";
import { initTheme } from "./theme/themeService";
import { PrimeServicesProvider } from "./components/prime/services";

initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <PrimeServicesProvider>
        <App />
      </PrimeServicesProvider>
    </BrowserRouter>
  </StrictMode>,
);
