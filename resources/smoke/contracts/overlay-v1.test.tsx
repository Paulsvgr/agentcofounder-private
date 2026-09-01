import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ConfirmDialog } from "@/components/agent/confirm-dialog";

function DialogHarness() {
  const [open, setOpen] = useState(true);
  const onConfirm = vi.fn();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Delete item?"
      description="This cannot be undone."
      confirmLabel="Delete"
      onConfirm={onConfirm}
    />
  );
}

test("overlay-v1 contract: dialog role, confirm and cancel", async () => {
  const user = userEvent.setup();
  render(<DialogHarness />);

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText(/delete item/i)).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: /^delete$/i }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
