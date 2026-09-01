import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FormField } from "@/components/agent/form-field";

function Harness() {
  const [value, setValue] = useState("");
  return <FormField label="Book title" value={value} onChange={setValue} placeholder="Enter title" />;
}

test("FormField smoke: controlled input via label", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const input = screen.getByLabelText(/book title/i);
  await user.type(input, "Neuromancer");
  expect(input).toHaveValue("Neuromancer");
});
