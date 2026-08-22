import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { STORAGE_KEY } from "./storage";

// Each test gets a fresh localStorage so app state never leaks between cases.
beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {});

describe("Home library app journeys", () => {
  beforeEach(() => localStorage.clear());

  it("adds a book and sees it in the list with the lent-out count at zero", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByTestId("lent-count").textContent).toBe("0");
    expect(screen.getByTestId("total-count").textContent).toBe("0");

    await user.type(screen.getByLabelText(/book title/i), "The Hobbit");
    await user.type(screen.getByLabelText(/book author/i), "J.R.R. Tolkien");
    await user.click(screen.getByRole("button", { name: /add book/i }));

    expect(await screen.findByText("The Hobbit")).toBeVisible();
    expect(screen.getByTestId("total-count").textContent).toBe("1");
    expect(screen.getByTestId("lent-count").textContent).toBe("0");
    expect(screen.getByText("J.R.R. Tolkien")).toBeVisible();
    expect(screen.getByText("At home")).toBeVisible();
  });

  it("prevents adding a book without a title", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/book author/i), "Some Author");
    await user.click(screen.getByRole("button", { name: /add book/i }));

    expect(
      await screen.findByText(/title is required/i),
    ).toBeVisible();
    expect(screen.getByTestId("total-count").textContent).toBe("0");
  });

  it("lends a book out and then marks it returned", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/book title/i), "Cookbook One");
    await user.type(screen.getByLabelText(/book author/i), "Chef A");
    await user.click(screen.getByRole("button", { name: /add book/i }));

    await user.click(await screen.findByRole("button", { name: /lend out/i }));
    await user.type(screen.getByLabelText(/borrower name/i), "Sam");
    await user.click(screen.getByRole("button", { name: /^lend$/i }));

    const row = await screen.findByText("Cookbook One");
    expect(row).toBeVisible();
    expect(screen.getByTestId("borrower-name").textContent).toBe("Sam");
    expect(screen.getByTestId("lent-count").textContent).toBe("1");

    await user.click(screen.getByRole("button", { name: /returned/i }));
    expect(screen.getByText("At home")).toBeVisible();
    expect(screen.getByTestId("lent-count").textContent).toBe("0");
  });

  it("prevents lending out without naming the borrower", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/book title/i), "Title");
    await user.type(screen.getByLabelText(/book author/i), "Author");
    await user.click(screen.getByRole("button", { name: /add book/i }));

    await user.click(await screen.findByRole("button", { name: /lend out/i }));
    await user.click(screen.getByRole("button", { name: /^lend$/i }));

    expect(
      await screen.findByText(/who is borrowing/i),
    ).toBeVisible();
  });

  it("edits a book's details and the change shows in the list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/book title/i), "Wrong Title");
    await user.type(screen.getByLabelText(/book author/i), "Wrong Author");
    await user.click(screen.getByRole("button", { name: /add book/i }));

    await user.click(await screen.findByRole("button", { name: /edit/i }));
    const editForm = screen.getByRole("form", { name: /edit/i });
    const titleInput = within(editForm).getByLabelText(/^title$/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Right Title");
    const authorInput = within(editForm).getByLabelText(/^author$/i);
    await user.clear(authorInput);
    await user.type(authorInput, "Right Author");
    await user.click(within(editForm).getByRole("button", { name: /save/i }));

    expect(await screen.findByText("Right Title")).toBeVisible();
    expect(screen.getByText("Right Author")).toBeVisible();
    expect(screen.queryByText("Wrong Title")).not.toBeInTheDocument();
  });

  it("cancels editing without losing the original book", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/book title/i), "Keep Me");
    await user.type(screen.getByLabelText(/book author/i), "Auth");
    await user.click(screen.getByRole("button", { name: /add book/i }));

    await user.click(await screen.findByRole("button", { name: /edit/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByText("Keep Me")).toBeVisible();
    expect(screen.getByTestId("total-count").textContent).toBe("1");
  });

  it("deletes a book added by mistake", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/book title/i), "Oops");
    await user.type(screen.getByLabelText(/book author/i), "No");
    await user.click(screen.getByRole("button", { name: /add book/i }));

    await user.click(await screen.findByRole("button", { name: /delete/i }));
    expect(screen.queryByText("Oops")).not.toBeInTheDocument();
    expect(screen.getByTestId("total-count").textContent).toBe("0");
  });

  it("filters to show only books currently lent out", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Book 1 - stays home
    await user.type(screen.getByLabelText(/book title/i), "Home Book");
    await user.type(screen.getByLabelText(/book author/i), "A");
    await user.click(screen.getByRole("button", { name: /add book/i }));

    // Book 2 - lent out
    await user.type(screen.getByLabelText(/book title/i), "Lent Book");
    await user.type(screen.getByLabelText(/book author/i), "B");
    await user.click(screen.getByRole("button", { name: /add book/i }));

    const lendButtons = await screen.findAllByRole("button", { name: /lend out/i });
    await user.click(lendButtons[1]);
    await user.type(screen.getByLabelText(/borrower name/i), "Jo");
    await user.click(screen.getByRole("button", { name: /^lend$/i }));

    // Filter to lent out only
    await user.click(screen.getByLabelText(/lent out/i));
    const list = screen.getByRole("list", { name: /books/i });
    expect(within(list).getByText("Lent Book")).toBeVisible();
    expect(within(list).queryByText("Home Book")).not.toBeInTheDocument();

    // Back to all
    await user.click(screen.getByLabelText(/all/i));
    expect(within(list).getByText("Home Book")).toBeVisible();
    expect(within(list).getByText("Lent Book")).toBeVisible();
  });

  it("persists books across a page refresh (re-mount)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await user.type(screen.getByLabelText(/book title/i), "Persisted");
    await user.type(screen.getByLabelText(/book author/i), "P");
    await user.click(screen.getByRole("button", { name: /add book/i }));
    await screen.findByText("Persisted");

    // Lend it so we verify the lender survives too.
    await user.click(screen.getByRole("button", { name: /lend out/i }));
    await user.type(screen.getByLabelText(/borrower name/i), "Sam");
    await user.click(screen.getByRole("button", { name: /^lend$/i }));
    await screen.findByText("Sam");

    // The persisted state is in localStorage; verify the key holds data.
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)[0].title).toBe("Persisted");

    // Simulate refresh: unmount and re-render a fresh App.
    unmount();
    render(<App />);

    expect(await screen.findByText("Persisted")).toBeVisible();
    expect(screen.getByText("Sam")).toBeVisible();
    expect(screen.getByTestId("total-count").textContent).toBe("1");
    expect(screen.getByTestId("lent-count").textContent).toBe("1");
  });

  it("shows an empty state and derived counts before any books exist", () => {
    render(<App />);
    expect(screen.getByTestId("total-count").textContent).toBe("0");
    expect(screen.getByTestId("lent-count").textContent).toBe("0");
    expect(
      screen.getByText(/no books yet. add your first book above./i),
    ).toBeVisible();
  });

  it("shows an empty state for the lent-out filter when nothing is out", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/book title/i), "Home Only");
    await user.type(screen.getByLabelText(/book author/i), "A");
    await user.click(screen.getByRole("button", { name: /add book/i }));

    await user.click(screen.getByLabelText(/lent out/i));
    expect(
      screen.getByText(/nothing is lent out/i),
    ).toBeVisible();
  });
});
