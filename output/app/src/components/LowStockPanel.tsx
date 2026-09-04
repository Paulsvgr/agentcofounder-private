import {
  LOW_STOCK_THRESHOLD,
  lowStockSupplies,
  SUPPLY_TYPE_LABELS,
  type Supply,
} from "../domain/supply.js";
import { DataList, EmptyState, Section } from "../ui/index.js";

export function LowStockPanel({ supplies }: { supplies: readonly Supply[] }) {
  const low = lowStockSupplies(supplies);
  return (
    <Section
      title="Running low"
      actions={<span className="muted">at or below {LOW_STOCK_THRESHOLD} left</span>}
    >
      <DataList
        label="Supplies running low"
        items={low}
        empty={
          <EmptyState
            title="Nothing is running low"
            description={`Every supply has more than ${LOW_STOCK_THRESHOLD} left.`}
          />
        }
        renderItem={(supply) => (
          <div className="low-item">
            <span className="low-item__name">{supply.name}</span>
            <span className="muted">
              {SUPPLY_TYPE_LABELS[supply.type]} · {supply.supplier}
            </span>
            <span className="badge badge--low">{supply.quantity} left</span>
          </div>
        )}
      />
    </Section>
  );
}
