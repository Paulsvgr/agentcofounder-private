import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../App.js";
import { SUPPLY_STORAGE_KEY } from "../lib/supplyRepository.js";
import { corruptStorage, seedStorage } from "../test/helpers.js";

async function addSupply(
  user: UserEvent,
  details: { name: string; supplier: string; type?: string; quantity: string },
): Promise<void> {
  await user.type(screen.getByLabelText("Name"), details.name);
  await user.type(screen.getByLabelText("Supplier"), details.supplier);
  if (details.type) await user.selectOptions(screen.getByLabelText("Type"), details.type);
  await user.type(screen.getByLabelText("Quantity left"), details.quantity);
  await user.click(screen.getByRole("button", { name: "Add supply" }));
}

function validRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
    name: "Cobalt blue glaze",
    supplier: "Kiln & Co.",
    type: "glaze",
    quantity: 5,
    ...overrides,
  };
}

describe("adding supplies", () => {
  it("adds a complete supply and shows it in the list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await addSupply(user, {
      name: "Cobalt blue glaze",
      supplier: "Kiln & Co.",
      type: "glaze",
      quantity: "12",
    });

    const row = screen.getByRole("row", { name: /Cobalt blue glaze/ });
    expect(within(row).getByText("Kiln & Co.")).toBeInTheDocument();
    expect(within(row).getByText("Glaze")).toBeInTheDocument();
    expect(within(row).getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Added Cobalt blue glaze.")).toBeInTheDocument();
  });

  it("rejects an incomplete form with visible field errors", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Add supply" }));

    const alerts = screen.getAllByRole("alert").map((node) => node.textContent);
    expect(alerts).toContain("Give this supply a name");
    expect(alerts).toContain("Add the supplier");
    expect(alerts).toContain("Enter how many you have left");
    expect(screen.getByText("No supplies yet")).toBeInTheDocument();
  });

  it("rejects a quantity that is not a whole number", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Name"), "Cobalt blue glaze");
    await user.type(screen.getByLabelText("Supplier"), "Kiln & Co.");
    await user.type(screen.getByLabelText("Quantity left"), "2.5");
    await user.click(screen.getByRole("button", { name: "Add supply" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Quantity must be a whole number of 0 or more",
    );

    await user.clear(screen.getByLabelText("Quantity left"));
    await user.type(screen.getByLabelText("Quantity left"), "-3");
    await user.click(screen.getByRole("button", { name: "Add supply" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Quantity must be a whole number of 0 or more",
    );
    expect(screen.getByText("No supplies yet")).toBeInTheDocument();
  });
});

describe("managing supplies", () => {
  it("edits a supply through the dialog", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSupply(user, { name: "Cobalt blue glaze", supplier: "Kiln & Co.", quantity: "5" });

    await user.click(
      within(screen.getByRole("row", { name: /Cobalt blue glaze/ })).getByRole("button", {
        name: "Edit",
      }),
    );

    const dialog = screen.getByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Quantity left"));
    await user.type(within(dialog).getByLabelText("Quantity left"), "9");
    await user.clear(within(dialog).getByLabelText("Supplier"));
    await user.type(within(dialog).getByLabelText("Supplier"), "New Supplier");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Cobalt blue glaze/ });
    expect(within(row).getByText("New Supplier")).toBeInTheDocument();
    expect(within(row).getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Updated Cobalt blue glaze.")).toBeInTheDocument();
  });

  it("deletes a supply", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSupply(user, { name: "Cobalt blue glaze", supplier: "Kiln & Co.", quantity: "5" });

    await user.click(
      within(screen.getByRole("row", { name: /Cobalt blue glaze/ })).getByRole("button", {
        name: "Delete",
      }),
    );

    expect(screen.queryByRole("row", { name: /Cobalt blue glaze/ })).not.toBeInTheDocument();
    expect(screen.getByText("No supplies yet")).toBeInTheDocument();
    expect(screen.getByText("Deleted Cobalt blue glaze.")).toBeInTheDocument();
  });

  it("adjusts quantity with the stepper and stops at zero", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSupply(user, { name: "Cobalt blue glaze", supplier: "Kiln & Co.", quantity: "1" });

    await user.click(screen.getByRole("button", { name: "Increase quantity of Cobalt blue glaze" }));
    expect(within(screen.getByRole("row", { name: /Cobalt blue glaze/ })).getByText("2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Decrease quantity of Cobalt blue glaze" }));
    await user.click(screen.getByRole("button", { name: "Decrease quantity of Cobalt blue glaze" }));
    const row = screen.getByRole("row", { name: /Cobalt blue glaze/ });
    expect(within(row).getByText("0")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Decrease quantity of Cobalt blue glaze" }),
    ).toBeDisabled();
  });
});

describe("filtering and low stock", () => {
  it("filters the list by type", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSupply(user, { name: "Cobalt blue glaze", supplier: "Kiln & Co.", quantity: "12" });
    await addSupply(user, {
      name: "Stoneware clay",
      supplier: "Clay House",
      type: "clay",
      quantity: "30",
    });

    await user.click(screen.getByRole("button", { name: "Clay (1)" }));
    expect(screen.getByRole("row", { name: /Stoneware clay/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Cobalt blue glaze/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All (2)" }));
    expect(screen.getByRole("row", { name: /Cobalt blue glaze/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Stoneware clay/ })).toBeInTheDocument();
  });

  it("flags low-stock supplies so they jump out", () => {
    seedStorage(SUPPLY_STORAGE_KEY, [
      validRecord({ id: "s1", name: "Cobalt blue glaze", quantity: 1 }),
      validRecord({ id: "s2", name: "Speckle glaze", quantity: 2 }),
      validRecord({ id: "s3", name: "Stoneware clay", type: "clay", quantity: 12 }),
    ]);
    render(<App />);

    const panel = screen.getByRole("region", { name: "Running low" });
    const list = within(panel).getByRole("list", { name: "Supplies running low" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(panel).getByText("Cobalt blue glaze")).toBeInTheDocument();
    expect(within(panel).getByText("1 left")).toBeInTheDocument();
    expect(within(panel).queryByText("Stoneware clay")).not.toBeInTheDocument();

    expect(
      within(screen.getByRole("row", { name: /Cobalt blue glaze/ })).getByText("Running low"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Stoneware clay/ })).getByText("OK"),
    ).toBeInTheDocument();
  });

  it("shows a calm empty state when nothing is running low", () => {
    seedStorage(SUPPLY_STORAGE_KEY, [validRecord({ quantity: 10 })]);
    render(<App />);
    expect(
      within(screen.getByRole("region", { name: "Running low" })).getByText("Nothing is running low"),
    ).toBeInTheDocument();
  });
});

describe("persistence", () => {
  it("keeps supplies across a reload", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await addSupply(user, { name: "Cobalt blue glaze", supplier: "Kiln & Co.", quantity: "7" });
    expect(screen.getByRole("row", { name: /Cobalt blue glaze/ })).toBeInTheDocument();
    first.unmount();

    render(<App />);
    const row = screen.getByRole("row", { name: /Cobalt blue glaze/ });
    expect(within(row).getByText("Kiln & Co.")).toBeInTheDocument();
    expect(within(row).getByText("7")).toBeInTheDocument();
  });

  it("recovers from corrupted saved data without crashing", () => {
    corruptStorage(SUPPLY_STORAGE_KEY, "{not json");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Studio Supplies" })).toBeInTheDocument();
    expect(screen.getByText("No supplies yet")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Saved data was unreadable and has been reset.",
    );
  });

  it("skips damaged entries but keeps the valid ones", () => {
    seedStorage(SUPPLY_STORAGE_KEY, [
      validRecord({ id: "s1", name: "Speckle glaze", quantity: 4 }),
      { id: "s2", name: "Broken", quantity: "lots" },
    ]);
    render(<App />);

    expect(screen.getByRole("row", { name: /Speckle glaze/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Broken/ })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "1 damaged entry was skipped while loading saved data.",
    );
  });
});
