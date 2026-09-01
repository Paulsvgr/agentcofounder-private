import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FormField } from "@/components/agent/form-field";
import { SelectField } from "@/components/agent/select-field";

function FieldHarness() {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");

  return (
    <>
      <FormField label="Title" value={text} onChange={setText} error="Required" required />
      <SelectField
        label="Category"
        value={category}
        onChange={setCategory}
        options={["Fiction", "Non-fiction"]}
      />
    </>
  );
}

test("field-v1 contract: label association, change handlers, error alert", async () => {
  const user = userEvent.setup();
  render(<FieldHarness />);

  const titleInput = screen.getByLabelText(/title/i);
  await user.type(titleInput, "Dune");
  expect(titleInput).toHaveValue("Dune");
  expect(screen.getByRole("alert")).toHaveTextContent("Required");

  await user.selectOptions(screen.getByLabelText(/category/i), "Fiction");
  expect(screen.getByLabelText(/category/i)).toHaveValue("Fiction");
});
