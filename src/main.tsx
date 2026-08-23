import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Converter from "../app/Converter";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Converter />
  </StrictMode>,
);
