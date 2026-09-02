import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataRow } from "@/components/agent/data-row";

test("DataRow smoke: title and description", () => {
  render(<DataRow id="b1" title="1984" description="Dystopia" />);
  expect(screen.getByText("1984")).toBeInTheDocument();
  expect(screen.getByText("Dystopia")).toBeInTheDocument();
});
