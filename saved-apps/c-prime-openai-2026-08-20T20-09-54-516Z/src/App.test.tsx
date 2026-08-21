import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

function mockConfirm(accept: boolean) {
  vi.spyOn(window, "confirm").mockImplementation(() => accept);
}

describe("Family Library Loans", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("adds a book, lends it, filters to lent out, marks returned, edits and deletes", async () => {
    const user = userEvent.setup();
    mockConfirm(true);

    const { unmount } = render(<App />);

    const addSection = screen.getAllByRole("region", { name: /add a book/i })[0]!;

    await user.type(within(addSection).getByLabelText(/^title$/i), "Dune");
    await user.type(within(addSection).getByLabelText(/^author$/i), "Frank Herbert");
    await user.selectOptions(within(addSection).getByLabelText(/^kind$/i), "Novel");
    await user.click(within(addSection).getByRole("button", { name: /add book/i }));

    const list = screen.getByRole("list", { name: /book list/i });
    expect(within(list).getByText("Dune")).toBeInTheDocument();
    expect(screen.getByLabelText(/lent out count/i)).toHaveTextContent("0");

    await user.click(screen.getByRole("button", { name: /lend out/i }));
    await user.type(screen.getByLabelText(/borrower name/i), "Alice");
    await user.click(screen.getByRole("button", { name: /confirm lend/i }));

    expect(screen.getByLabelText(/lent out count/i)).toHaveTextContent("1");
    expect(screen.getByLabelText(/borrowed by alice/i)).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /^lent out$/i }));
    expect(within(screen.getByRole("list", { name: /book list/i })).getByText("Dune")).toBeInTheDocument();

    // Persisted across refresh (remount)
    unmount();
    render(<App />);
    expect(screen.getByLabelText(/lent out count/i)).toHaveTextContent("1");
    expect(screen.getByText("Dune")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mark returned/i }));
    expect(screen.getByLabelText(/lent out count/i)).toHaveTextContent("0");

    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const dialog = screen.getByRole("dialog", { name: /edit book/i });
    const editTitle = within(dialog).getByLabelText(/^title$/i);
    await user.clear(editTitle);
    await user.type(editTitle, "Dune (Updated)");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(screen.getByText("Dune (Updated)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(screen.getByText(/no books yet/i)).toBeInTheDocument();
  });

  it("prevents lending without a borrower name", async () => {
    const user = userEvent.setup();

    render(<App />);

    const addSection = screen.getAllByRole("region", { name: /add a book/i })[0]!;

    await user.type(within(addSection).getByLabelText(/^title$/i), "Joy of Cooking");
    await user.type(within(addSection).getByLabelText(/^author$/i), "Irma Rombauer");
    await user.selectOptions(within(addSection).getByLabelText(/^kind$/i), "Cookbook");
    await user.click(within(addSection).getByRole("button", { name: /add book/i }));

    await user.click(screen.getByRole("button", { name: /lend out/i }));
    await user.click(screen.getByRole("button", { name: /confirm lend/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/borrower name is required/i);
  });
});
