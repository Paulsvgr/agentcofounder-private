import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ConfirmDialog } from "@/components/agent/confirm-dialog";

test("ConfirmDialog smoke: opens and confirms", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();

  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Remove book?"
          onConfirm={onConfirm}
        />
      </>
    );
  }

  render(<Harness />);
  await user.click(screen.getByRole("button", { name: /open/i }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /confirm/i }));
  expect(onConfirm).toHaveBeenCalledOnce();
});
