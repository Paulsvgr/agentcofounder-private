# Available resources

Generated view for **resource-slice-full-v1** (manual simulation).  
Selected IDs: `button`, `input`, `dialog`, `theme-default`, `local-storage-collection`

---

## Button

Import:
`import { Button } from "@/components/ui/button"`

Example:
`<Button type="submit">Save</Button>`

Use for: primary actions, form submit, navigation triggers.

- Use semantic button types (button/submit).
- Do not rebuild a custom button component.

Test: prefer `getByRole('button', { name: /save/i })`.

---

## Input

Import:
`import { Input } from "@/components/ui/input"`

Example:
`<Input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />`

Use for: single-line text fields, search boxes, form fields with labels.

- Pair with Label or aria-label.
- Do not use unlabeled inputs for required fields.

Test: prefer `getByRole('textbox', { name: /title/i })` or `getByLabelText`.

---

## Dialog

Import:
`import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"`

Example:
`<Dialog><DialogTrigger asChild><Button>Edit</Button></DialogTrigger><DialogContent>...</DialogContent></Dialog>`

Use for: modal forms, confirmations, detail views.

- Prefer this over custom modal divs.
- Use `asChild` on DialogTrigger when wrapping Button.

Test: open with `getByRole('button', { name: /edit/i })`; assert `getByRole('dialog')`.

---

## Default semantic theme

Setup: Use CSS variables — `background`, `foreground`, `primary`, `muted`, `border`. Tokens are in template `globals.css`.

Example:
`className="bg-background text-foreground border-border"`

Use for: any UI using preinstalled components.

- Do not hardcode hex colours unless necessary.
- Prefer semantic token class names over raw CSS.

---

## Local collection persistence

Import:
`import { createCollectionStore } from "@/lib/collectionStore"`
`import { useCollection } from "@/lib/useCollection"`
`import { createMemoryStorage } from "@/test/memoryStorage"`

Example:
`const store = createCollectionStore<Book>({ key: "books", parse: parseBook });`
`const { items, add, update, remove } = useCollection(store);`

Use for: single-user browser app, data survives refresh, simple CRUD list.

- Use this as the persistence boundary.
- Do not add repository/service wrapper layers unless needed.
- In tests pass `storage: createMemoryStorage()`.

Test: do not hand-roll localStorage mocks.
