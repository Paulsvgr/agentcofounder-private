import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

/**
 * Intentionally unscoped queries — these MUST fail with Found multiple elements…
 * Case 1: Science in <option> + <span class="badge">
 * Case 2: two "Lend out" buttons (one per book)
 */
describe("seeded rtl_multiple failures", () => {
  beforeEach(() => {
    render(<App />);
  });

  it("shows Science category (unscoped — activates text multiple)", () => {
    expect(screen.getByText("Science")).toBeInTheDocument();
  });

  it("lends the second book via Lend out (unscoped — activates role multiple)", async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Lend out" }));
    expect(screen.getByText("Sapiens")).toBeInTheDocument();
  });
});
