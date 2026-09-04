export class StripeClientError extends Error {
  readonly causeDetail: unknown;

  constructor(message: string, causeDetail?: unknown) {
    super(message);
    this.name = "StripeClientError";
    this.causeDetail = causeDetail;
  }
}

type StripeCheckoutInstance = {
  redirectToCheckout: (options: { sessionId: string }) => Promise<{ error?: { message?: string } }>;
};

type StripeFactory = (publishableKey: string) => StripeCheckoutInstance | null;

declare global {
  interface Window {
    Stripe?: StripeFactory;
  }
}

let stripeScriptPromise: Promise<void> | null = null;

function loadStripeJsScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new StripeClientError("Stripe.js requires a browser environment"));
  }
  if (window.Stripe) return Promise.resolve();
  if (stripeScriptPromise) return stripeScriptPromise;

  stripeScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-stripe-js="v3"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new StripeClientError("Failed to load Stripe.js")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.dataset.stripeJs = "v3";
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new StripeClientError("Failed to load Stripe.js")),
      { once: true },
    );
    document.head.appendChild(script);
  });

  return stripeScriptPromise;
}

/**
 * Load Stripe.js (CDN) and construct a client with the publishable key.
 * Secret keys must never be passed here.
 */
export async function loadStripe(publishableKey: string): Promise<StripeCheckoutInstance> {
  const key = publishableKey.trim();
  if (!key.startsWith("pk_")) {
    throw new StripeClientError("Expected a Stripe publishable key (pk_...)");
  }
  await loadStripeJsScript();
  const factory = window.Stripe;
  if (!factory) {
    throw new StripeClientError("Stripe.js loaded but window.Stripe is missing");
  }
  const stripe = factory(key);
  if (!stripe) {
    throw new StripeClientError("Stripe.js rejected the publishable key");
  }
  return stripe;
}

/**
 * Redirect the browser into a Stripe-hosted Checkout Session.
 * `sessionId` must come from your server (Checkout Session create).
 */
export async function redirectToCheckout(options: {
  publishableKey: string;
  sessionId: string;
}): Promise<void> {
  const sessionId = options.sessionId.trim();
  if (!sessionId) {
    throw new StripeClientError("Checkout sessionId is required");
  }
  const stripe = await loadStripe(options.publishableKey);
  const result = await stripe.redirectToCheckout({ sessionId });
  if (result.error?.message) {
    throw new StripeClientError(result.error.message, result.error);
  }
}

/**
 * POST JSON to your backend to create a Checkout Session, then redirect.
 * The backend owns the Stripe secret key and returns `{ sessionId: string }`.
 */
export async function startCheckoutFromBackend(options: {
  publishableKey: string;
  createSessionUrl: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<void> {
  const response = await fetch(options.createSessionUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: JSON.stringify(options.body ?? {}),
    signal: options.signal,
  });
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    throw new StripeClientError(`Checkout session create failed (HTTP ${response.status})`, parsed);
  }
  const sessionId =
    parsed && typeof parsed === "object" && "sessionId" in parsed
      ? String((parsed as { sessionId: unknown }).sessionId ?? "")
      : "";
  if (!sessionId) {
    throw new StripeClientError("Backend response missing sessionId", parsed);
  }
  await redirectToCheckout({
    publishableKey: options.publishableKey,
    sessionId,
  });
}
