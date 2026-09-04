import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("library status copy", () => {
  beforeEach(() => {
    render(<App />);
  });

  it("shows lent-out summary", () => {
    // Deliberate grammar mismatch vs product (singular uses "is").
    expect(screen.getByText("1 are currently lent out.")).toBeInTheDocument();
  });

  it("shows shelf summary", () => {
    expect(screen.getByText("1 books on the shelf.")).toBeInTheDocument();
  });
});
