import { isLowStock, SUPPLY_TYPE_LABELS, type Supply } from "../domain/supply.js";
import { Button, DataTable, EmptyState } from "../ui/index.js";

export function SupplyTable({
  supplies,
  onAdjust,
  onEdit,
  onDelete,
}: {
  supplies: readonly Supply[];
  onAdjust: (id: string, delta: number) => void;
  onEdit: (supply: Supply) => void;
  onDelete: (supply: Supply) => void;
}) {
  return (
    <DataTable
      caption="Supplies in the studio"
      rows={supplies}
      empty={<EmptyState title="Nothing here yet" description="Add a supply to see it in this list." />}
      columns={[
        { key: "name", header: "Name", render: (supply) => <strong>{supply.name}</strong> },
        { key: "supplier", header: "Supplier", render: (supply) => supply.supplier },
        { key: "type", header: "Type", render: (supply) => SUPPLY_TYPE_LABELS[supply.type] },
        {
          key: "quantity",
          header: "Quantity left",
          render: (supply) => (
            <span className="quantity">
              <Button
                variant="secondary"
                aria-label={`Decrease quantity of ${supply.name}`}
                onClick={() => onAdjust(supply.id, -1)}
                disabled={supply.quantity === 0}
              >
                −
              </Button>
              <span className="quantity__value">{supply.quantity}</span>
              <Button
                variant="secondary"
                aria-label={`Increase quantity of ${supply.name}`}
                onClick={() => onAdjust(supply.id, 1)}
              >
                +
              </Button>
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
          render: (supply) =>
            isLowStock(supply) ? (
              <span className="badge badge--low">Running low</span>
            ) : (
              <span className="badge badge--ok">OK</span>
            ),
        },
        {
          key: "actions",
          header: "Actions",
          render: (supply) => (
            <span className="row-actions">
              <Button variant="secondary" onClick={() => onEdit(supply)}>
                Edit
              </Button>
              <Button variant="danger" onClick={() => onDelete(supply)}>
                Delete
              </Button>
            </span>
          ),
        },
      ]}
    />
  );
}
