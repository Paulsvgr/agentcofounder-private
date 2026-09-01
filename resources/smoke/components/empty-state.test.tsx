import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/agent/empty-state";

test("EmptyState smoke: status region", () => {
  render(<EmptyState title="Nothing borrowed" description="Browse the catalog." />);
  const status = screen.getByRole("status");
  expect(status).toHaveTextContent("Nothing borrowed");
  expect(status).toHaveTextContent("Browse the catalog.");
});
