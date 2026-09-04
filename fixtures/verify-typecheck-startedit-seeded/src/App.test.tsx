import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

beforeEach(() => {
  cleanup();
});

afterEach(() => {
  cleanup();
});

describe("257k startEdit seed", () => {
  it("adds a book and edits its title via display value", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/^Title$/i), "Dune");
    await user.type(screen.getByLabelText(/^Author$/i), "Frank Herbert");
    await user.click(screen.getByRole("button", { name: /add to shelf/i }));

    expect(screen.getByText("Dune")).toBeInTheDocument();

    const duneItem = screen.getByText("Dune").closest("li")!;
    await user.click(within(duneItem).getByRole("button", { name: /^edit$/i }));

    // Edit form should expose the current title as a display value.
    const titleInput = within(duneItem).getByDisplayValue("Dune");
    await user.clear(titleInput);
    await user.type(titleInput, "Dune: Revised Edition");
    await user.click(within(duneItem).getByRole("button", { name: /^save$/i }));

    expect(screen.getByText("Dune: Revised Edition")).toBeInTheDocument();
  });
});
