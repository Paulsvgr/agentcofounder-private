import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  SUPPLY_TYPES,
  SUPPLY_TYPE_LABELS,
  toSupplyInput,
  validateSupplyForm,
  type Supply,
  type SupplyFormValues,
  type SupplyInput,
} from "../domain/supply.js";
import { Button, Form, SelectField, TextField } from "../ui/index.js";

const TYPE_OPTIONS = SUPPLY_TYPES.map((type) => ({ value: type, label: SUPPLY_TYPE_LABELS[type] }));

const EMPTY_VALUES: SupplyFormValues = { name: "", supplier: "", type: "glaze", quantity: "" };

export function SupplyForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Supply;
  submitLabel: string;
  onSubmit: (input: SupplyInput) => void;
}) {
  const [values, setValues] = useState<SupplyFormValues>(
    initial
      ? {
          name: initial.name,
          supplier: initial.supplier,
          type: initial.type,
          quantity: String(initial.quantity),
        }
      : EMPTY_VALUES,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof SupplyFormValues, string>>>({});

  function setField(field: keyof SupplyFormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setValues((current) => ({ ...current, [field]: event.target.value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateSupplyForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(toSupplyInput(values));
    if (!initial) setValues(EMPTY_VALUES);
  }

  return (
    <Form onSubmit={handleSubmit}>
      <TextField
        label="Name"
        value={values.name}
        onChange={setField("name")}
        error={errors.name}
        placeholder="Cobalt blue glaze"
        autoComplete="off"
      />
      <TextField
        label="Supplier"
        value={values.supplier}
        onChange={setField("supplier")}
        error={errors.supplier}
        placeholder="Kiln & Co."
        autoComplete="off"
      />
      <SelectField
        label="Type"
        value={values.type}
        onChange={setField("type")}
        options={TYPE_OPTIONS}
        error={errors.type}
      />
      <TextField
        label="Quantity left"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        value={values.quantity}
        onChange={setField("quantity")}
        error={errors.quantity}
        placeholder="12"
      />
      <div className="form__actions">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </Form>
  );
}
