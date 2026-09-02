import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActionButton } from "@/components/agent/action-button";
import { DataList } from "@/components/agent/data-list";
import { DataRow } from "@/components/agent/data-row";

test("row-v1 contract: list with labeled rows and actions", async () => {
  render(
    <DataList label="Books">
      <DataRow
        id="1"
        title="Dune"
        description="Sci-fi"
        actions={<ActionButton label="Edit" onAction={() => {}} variant="ghost" />}
      />
    </DataList>,
  );

  expect(screen.getByRole("list", { name: /books/i })).toBeInTheDocument();
  expect(screen.getByText("Dune")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
});
