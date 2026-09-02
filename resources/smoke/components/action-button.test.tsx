import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionButton } from "@/components/agent/action-button";

test("ActionButton smoke: variants render and fire onAction", async () => {
  const user = userEvent.setup();
  const onAction = vi.fn();
  render(<ActionButton label="Lend" onAction={onAction} variant="secondary" />);
  await user.click(screen.getByRole("button", { name: /lend/i }));
  expect(onAction).toHaveBeenCalledOnce();
});
