import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionButton } from "@/components/agent/action-button";

test("action-v1 contract: button role, label, click handler", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();

  render(<ActionButton label="Save item" onAction={onAction} variant="primary" />);

  await user.click(screen.getByRole("button", { name: /save item/i }));
  expect(onAction).toHaveBeenCalledOnce();
});
