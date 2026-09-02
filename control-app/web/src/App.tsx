import { Link, Navigate, Route, Routes } from "react-router-dom";
import { ExperimentsPage } from "./pages/ExperimentsPage.js";
import { NewRunPage } from "./pages/NewRunPage.js";
import { RunDetailPage } from "./pages/RunDetailPage.js";
import { RunsPage } from "./pages/RunsPage.js";

export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">AgentCofounder</p>
          <h1>V2 Control</h1>
        </div>
        <nav className="app-nav">
          <Link to="/">Runs</Link>
          <Link to="/experiments">Experiments</Link>
          <Link to="/new">New run</Link>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<RunsPage />} />
          <Route path="/experiments" element={<ExperimentsPage />} />
          <Route path="/runs/:runId" element={<RunDetailPage />} />
          <Route path="/runs/:runId/station" element={<Navigate to=".." replace />} />
          <Route path="/new" element={<NewRunPage />} />
        </Routes>
      </main>
    </div>
  );
}
