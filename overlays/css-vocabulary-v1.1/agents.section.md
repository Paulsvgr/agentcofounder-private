## CSS vocabulary (preinstalled)

A complete design-system stylesheet is already installed. **Do not read or edit the theme stylesheet.** The vocabulary below is sufficient.

Use only these class names for layout, typography, forms, buttons, lists, and cards:

| Class | Use for |
|-------|---------|
| `ui-page` | Full-page shell (min-height viewport, page padding) |
| `ui-container` | Centered max-width content wrapper |
| `ui-section` | Vertical content section with spacing |
| `ui-card` | Bordered card panel with padding and shadow |
| `ui-header` | Header block inside a card or section |
| `ui-title` | Primary page or section heading |
| `ui-subtitle` | Secondary or muted descriptive text |
| `ui-form` | Form layout grid (responsive columns) |
| `ui-field` | Single form field wrapper (label + control) |
| `ui-label` | Field label text |
| `ui-input` | Text input or select styling (apply to `<input>` and `<select>`) |
| `ui-btn` | Base button (neutral outline) |
| `ui-btn-primary` | Primary action button (add with `ui-btn`) |
| `ui-btn-secondary` | Secondary/neutral button (add with `ui-btn`) |
| `ui-btn-danger` | Destructive action button (add with `ui-btn`) |
| `ui-list` | Vertical list container (use on `<ul>`) |
| `ui-list-item` | List row (use on `<li>`) |
| `ui-empty` | Empty-state message |
| `ui-badge` | Small status or count badge |
| `ui-row` | Horizontal flex row with gap |
| `ui-stack` | Vertical stack with gap |

**Rules:**

- Compose UI from these classes only. Combine modifiers as shown (`className="ui-btn ui-btn-primary"`).
- **Accept the default appearance. Do not customise merely to make it prettier.**
- Do not substitute inline `style={{...}}` for the vocabulary.
- Do not add class names outside this list.
