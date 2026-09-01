import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SelectField } from "@/components/agent/select-field";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <SelectField label="Genre" value={value} onChange={setValue} options={["Sci-fi", "Fantasy"]} />
  );
}

test("SelectField smoke: option selection", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.selectOptions(screen.getByLabelText(/genre/i), "Fantasy");
  expect(screen.getByLabelText(/genre/i)).toHaveValue("Fantasy");
});
