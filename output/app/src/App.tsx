import { useMemo, useState } from "react";
import { LowStockPanel } from "./components/LowStockPanel.js";
import { SupplyForm } from "./components/SupplyForm.js";
import { SupplyTable } from "./components/SupplyTable.js";
import {
  countByType,
  lowStockSupplies,
  SUPPLY_TYPES,
  SUPPLY_TYPE_LABELS,
  type Supply,
  type SupplyInput,
  type SupplyType,
} from "./domain/supply.js";
import { useCollection } from "./hooks/useCollection.js";
import { supplyRepository } from "./lib/supplyRepository.js";
import { AppShell, Button, Dialog, EmptyState, Notice, Section, StatCard } from "./ui/index.js";

type TypeFilter = "all" | SupplyType;

const FILTER_LABELS: Record<TypeFilter, string> = {
  all: "All",
  glaze: "Glazes",
  clay: "Clay",
  tools: "Tools",
};

const EMPTY_FILTER_NOUN: Record<SupplyType, string> = { glaze: "glaze", clay: "clay", tools: "tool" };

export function App() {
  const collection = useCollection(supplyRepository);
  const [filter, setFilter] = useState<TypeFilter>("all");
  const [editing, setEditing] = useState<Supply | null>(null);
  const [flash, setFlash] = useState<string | undefined>(undefined);

  const { records } = collection;
  const counts = useMemo(() => countByType(records), [records]);
  const lowCount = useMemo(() => lowStockSupplies(records).length, [records]);
  const visible = useMemo(
    () => (filter === "all" ? records : records.filter((supply) => supply.type === filter)),
    [records, filter],
  );

  function handleCreate(input: SupplyInput) {
    const created = collection.create(input);
    setFlash(`Added ${created.name}.`);
  }

  function handleEditSubmit(input: SupplyInput) {
    if (!editing) return;
    collection.update(editing.id, input);
    setFlash(`Updated ${input.name}.`);
    setEditing(null);
  }

  function handleDelete(supply: Supply) {
    collection.remove(supply.id);
    setFlash(`Deleted ${supply.name}.`);
  }

  function handleAdjust(id: string, delta: number) {
    const target = records.find((supply) => supply.id === id);
    if (!target) return;
    collection.update(id, { quantity: Math.max(0, target.quantity + delta) });
  }

  const filterOptions: { value: TypeFilter; count: number }[] = [
    { value: "all", count: records.length },
    ...SUPPLY_TYPES.map((type) => ({ value: type as TypeFilter, count: counts[type] })),
  ];

  return (
    <AppShell
      title="Studio Supplies"
      description="Track your glazes, clay and tools, and spot what is running low before it runs out."
    >
      {collection.notice ? (
        <Notice tone="warning" onDismiss={collection.dismissNotice}>
          {collection.notice}
        </Notice>
      ) : null}
      {flash ? <Notice tone="success">{flash}</Notice> : null}

      <div className="grid grid--stats" role="group" aria-label="Supply totals">
        <StatCard label="Supplies tracked" value={records.length} />
        <StatCard label="Running low" value={lowCount} />
        <StatCard label="Glazes" value={counts.glaze} />
        <StatCard label="Clay" value={counts.clay} />
        <StatCard label="Tools" value={counts.tools} />
      </div>

      <LowStockPanel supplies={records} />

      <Section title="Add a supply">
        <SupplyForm submitLabel="Add supply" onSubmit={handleCreate} />
      </Section>

      <Section
        title="Supplies"
        actions={
          <div className="filter" role="group" aria-label="Filter supplies by type">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={filter === option.value ? "primary" : "secondary"}
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
              >
                {FILTER_LABELS[option.value]} ({option.count})
              </Button>
            ))}
          </div>
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            title={
              records.length === 0
                ? "No supplies yet"
                : `No ${EMPTY_FILTER_NOUN[filter as SupplyType]} supplies`
            }
            description={
              records.length === 0
                ? "Add your first supply above to start tracking."
                : "Try a different type filter."
            }
          />
        ) : (
          <SupplyTable
            supplies={visible}
            onAdjust={handleAdjust}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        )}
      </Section>

      <Dialog
        open={editing !== null}
        title={editing ? `Edit ${editing.name}` : "Edit supply"}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <SupplyForm
            key={editing.id}
            initial={editing}
            submitLabel="Save changes"
            onSubmit={handleEditSubmit}
          />
        ) : null}
      </Dialog>
    </AppShell>
  );
}
