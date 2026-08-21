import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./components/App.js";
import { useLibrary } from "./hooks/useLibrary.js";
import { createBookRepository } from "./persistence/bookRepository.js";
import { getStorage } from "./persistence/storage.js";
import "./styles.css";

function Root() {
  const repository = createBookRepository(getStorage());
  const [books, api] = useLibrary(repository);
  return <App books={books} api={api} />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
