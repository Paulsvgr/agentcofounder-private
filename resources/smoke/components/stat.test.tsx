import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stat } from "@/components/agent/stat";

test("Stat smoke: title and value", () => {
  render(<Stat title="Available" value={12} description="On shelf" />);
  expect(screen.getByText("Available")).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(screen.getByText("On shelf")).toBeInTheDocument();
});
