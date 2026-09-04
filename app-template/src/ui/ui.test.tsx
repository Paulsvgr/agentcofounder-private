import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DataTable, Dialog, EmptyState, Notice, SelectField, TextField } from "./index.js";

describe("ui primitives", () => {
  it("labels fields and links their error messages", () => {
    render(<TextField label="Title" error="This field is required" value="" onChange={() => {}} />);
    const input = screen.getByLabelText("Title");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("This field is required");
  });

  it("renders select options with accessible names", () => {
    render(
      <SelectField
        label="Status"
        options={[
          { value: "open", label: "Open" },
          { value: "done", label: "Done" },
        ]}
        defaultValue="open"
      />,
    );
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Done" })).toBeInTheDocument();
  });

  it("shows an empty state instead of an empty table", () => {
    render(
      <DataTable
        caption="Records"
        columns={[{ key: "name", header: "Name", render: (row: { id: string }) => row.id }]}
        rows={[]}
        empty={<EmptyState title="Nothing yet" description="Add the first record." />}
      />,
    );
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });

  it("announces notices and can dismiss them", async () => {
    function Host() {
      const [open, setOpen] = useState(true);
      return open ? (
        <Notice tone="error" onDismiss={() => setOpen(false)}>
          Storage failed
        </Notice>
      ) : null;
    }
    render(<Host />);
    expect(screen.getByRole("alert")).toHaveTextContent("Storage failed");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders a modal dialog with an accessible name", () => {
    render(
      <Dialog open title="Confirm" onClose={() => {}}>
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "Confirm" })).toBeInTheDocument();
  });
});
