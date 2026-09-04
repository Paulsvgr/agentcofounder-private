import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  OVERLAY_CHOOSER_SCHEMA,
  chooseOverlaysFromIdea,
  formatOverlayChoice,
  overlayChooserV1EnabledFromEnvironment,
  type ChoosableOverlay,
} from "../../src/v2/overlay-chooser.js";
import {
  DEFAULT_TEMPLATE_OVERLAY_CONFIG,
  templateOverlayEnvOverrides,
} from "../../src/v2/template-overlays.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

afterEach(() => {
  delete process.env.HARNESS_OVERLAY_CHOOSER_V1;
  delete process.env.TEMPLATE_API_CLIENT;
  delete process.env.TEMPLATE_STRIPE;
  delete process.env.TEMPLATE_PERSISTENCE;
});

function decisionFor(idea: string, overlay: ChoosableOverlay) {
  const choice = chooseOverlaysFromIdea(idea);
  const decision = choice.decisions.find((entry) => entry.overlay === overlay);
  if (!decision) throw new Error(`missing decision for ${overlay}`);
  return decision;
}

describe("overlay chooser v1 flag", () => {
  it("is on when unset and honours explicit values", () => {
    expect(overlayChooserV1EnabledFromEnvironment()).toBe(true);
    process.env.HARNESS_OVERLAY_CHOOSER_V1 = "0";
    expect(overlayChooserV1EnabledFromEnvironment()).toBe(false);
    process.env.HARNESS_OVERLAY_CHOOSER_V1 = "true";
    expect(overlayChooserV1EnabledFromEnvironment()).toBe(true);
  });

  it("rejects unparseable values", () => {
    process.env.HARNESS_OVERLAY_CHOOSER_V1 = "maybe";
    expect(() => overlayChooserV1EnabledFromEnvironment()).toThrow(/must be 0\/1/);
  });
});

describe("chooseOverlaysFromIdea", () => {
  it("leaves the shipped idea on the ship defaults", async () => {
    const idea = await readFile(
      path.join(REPOSITORY_ROOT, "contract-public", "development-idea.txt"),
      "utf8",
    );
    const choice = chooseOverlaysFromIdea(idea);
    expect(choice.schema).toBe(OVERLAY_CHOOSER_SCHEMA);
    expect(choice.config).toEqual(DEFAULT_TEMPLATE_OVERLAY_CONFIG);
  });

  it("keeps persistence and tailwind for a local-only collection app", () => {
    const choice = chooseOverlaysFromIdea("A bookshelf that saves my reading list in the browser.");
    expect(choice.config.persistence_primitive).toBe(true);
    expect(choice.config.tailwind).toBe(true);
    expect(choice.config.api_client).toBe(false);
    expect(choice.config.stripe).toBe(false);
  });

  it("enables the api client when the idea talks to a service", () => {
    const decision = decisionFor(
      "A dashboard that fetches live weather from a public API and shows a 5-day forecast.",
      "api_client",
    );
    expect(decision.enabled).toBe(true);
    expect(decision.source).toBe("signal");
    expect(decision.signals).toContain("api");
  });

  it("enables stripe and implies the api client for a paid product", () => {
    const choice = chooseOverlaysFromIdea(
      "A course platform where students buy a subscription at checkout before watching lessons.",
    );
    expect(choice.config.stripe).toBe(true);
    expect(choice.config.api_client).toBe(true);

    const api = choice.decisions.find((entry) => entry.overlay === "api_client");
    expect(api?.source).toBe("implied");
    expect(api?.signals).toEqual(["stripe-checkout"]);
  });

  it("turns persistence off only when the idea is explicitly ephemeral", () => {
    const ephemeral = decisionFor(
      "A stateless unit converter; do not save anything between sessions.",
      "persistence_primitive",
    );
    expect(ephemeral.enabled).toBe(false);
    expect(ephemeral.source).toBe("signal");

    const mixed = decisionFor(
      "An in-memory scratchpad that still remembers my last note after a refresh.",
      "persistence_primitive",
    );
    expect(mixed.enabled).toBe(true);
  });

  it("never turns on styling overlays it does not own", () => {
    const choice = chooseOverlaysFromIdea("A CSS-heavy landing page with a custom design system.");
    expect(choice.config.css_vocabulary).toBe(DEFAULT_TEMPLATE_OVERLAY_CONFIG.css_vocabulary);
    expect(choice.config.test_isolation).toBe(DEFAULT_TEMPLATE_OVERLAY_CONFIG.test_isolation);
  });

  it("is deterministic for the same idea", () => {
    const idea = "Invoice tracker that saves clients locally and syncs via a REST endpoint.";
    expect(chooseOverlaysFromIdea(idea)).toEqual(chooseOverlaysFromIdea(idea));
  });

  it("formats a human-readable summary", () => {
    const summary = formatOverlayChoice(
      chooseOverlaysFromIdea("Sell prints through Stripe checkout."),
    );
    expect(summary).toContain("ON  stripe");
    expect(summary).toContain("ON  api_client");
  });
});

describe("templateOverlayEnvOverrides", () => {
  it("reports nothing when no TEMPLATE_* variable is set", () => {
    expect(templateOverlayEnvOverrides()).toEqual({});
  });

  it("lets an explicit env value win over a chooser decision", () => {
    process.env.TEMPLATE_STRIPE = "0";
    const choice = chooseOverlaysFromIdea("Paid membership with Stripe checkout.");
    expect(choice.config.stripe).toBe(true);

    const applied = { ...choice.config, ...templateOverlayEnvOverrides() };
    expect(applied.stripe).toBe(false);
    expect(applied.api_client).toBe(true);
  });
});
