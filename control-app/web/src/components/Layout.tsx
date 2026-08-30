import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "../lib/theme";

export function Layout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="control-shell">
      <header className="control-header">
        <div>
          <p className="control-eyebrow">AgentCofounder</p>
          <h1>V2 Control</h1>
        </div>
        <div className="control-header-actions">
          <nav className="control-nav" aria-label="Primary">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : undefined)}>
              Runs
            </NavLink>
            <NavLink to="/launch" className={({ isActive }) => (isActive ? "active" : undefined)}>
              New run
            </NavLink>
          </nav>
          <button
            type="button"
            className="control-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            title={theme === "light" ? "Dark mode" : "Light mode"}
          >
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>
      </header>
      <main className="control-main">
        <Outlet />
      </main>
    </div>
  );
}
