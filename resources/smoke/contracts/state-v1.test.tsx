import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/agent/empty-state";
import { Stat } from "@/components/agent/stat";

test("state-v1 contract: empty status and stat display", () => {
  render(
    <>
      <EmptyState title="No books yet" description="Add your first book." />
      <Stat title="Total books" value={3} />
    </>,
  );

  expect(screen.getByRole("status")).toHaveTextContent("No books yet");
  expect(screen.getByText("3")).toBeInTheDocument();
});
