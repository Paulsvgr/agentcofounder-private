## Stripe Checkout (preinstalled)

When the product must collect **card payments via Stripe Checkout**, use helpers from `@/lib/stripeCheckout`.

- Use only when the idea actually requires payments. Skip for local single-user tools with no checkout.
- Browser flow: obtain a Checkout `sessionId` from **your** HTTPS backend (secret key never belongs in the client), then call `redirectToCheckout`.
- Publishable key may live in the client; do **not** embed secret keys or invent unpaid Stripe SDK packages.
- Do not add npm packages; these helpers use platform `fetch` + Stripe.js from js.stripe.com.
