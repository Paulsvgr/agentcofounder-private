import type { ComponentType } from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as AppModule from "./App.js";
import "./styles.css";

/**
 * Accept either `export function App()` or `export default function App()`.
 *
 * The generated component is written without reading this file, so insisting on
 * one export style turns a stylistic choice into a build failure. Taking
 * whichever the author used removes that failure mode entirely.
 */
const exports = AppModule as { App?: ComponentType; default?: ComponentType };
const App = exports.App ?? exports.default;

if (!App) {
  throw new Error("src/App.tsx must export an App component, either named or default");
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
