import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataList } from "@/components/agent/data-list";
import { DataRow } from "@/components/agent/data-row";
import { EmptyState } from "@/components/agent/empty-state";

test("DataList smoke: empty fallback", () => {
  render(
    <DataList
      label="Library"
      isEmpty
      empty={<EmptyState title="Shelf is empty" />}
    />,
  );
  expect(screen.getByRole("region", { name: /library/i })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Shelf is empty");
});

test("DataList smoke: renders children", () => {
  render(
    <DataList label="Library">
      <DataRow id="1" title="Book A" />
    </DataList>,
  );
  expect(screen.getByRole("list", { name: /library/i })).toBeInTheDocument();
});
