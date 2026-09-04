## Tailwind CSS (preinstalled)

Tailwind CSS v4 is already installed and wired into Vite (`@tailwindcss/vite`). `src/styles.css` already contains `@import "tailwindcss";`.

- Design freely with Tailwind utility classes in JSX/TSX.
- Do **not** run `npm install tailwindcss`, add PostCSS configs, or rewrite the Vite Tailwind plugin setup.
- Keep the `@import "tailwindcss";` entry (you may add small custom CSS beside it if needed).
- Prefer utilities over inventing a closed class vocabulary; this is scaffolding, not a design restriction.
