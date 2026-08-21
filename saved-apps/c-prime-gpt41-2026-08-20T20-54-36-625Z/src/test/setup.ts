import { expect, vi } from 'vitest';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';

// Workaround: `expect` may not have `.extend` immediately for vitest config order. Use Object.assign if needed.
if (typeof expect.extend === 'function') {
  expect.extend(jestDomMatchers);
} else {
  Object.assign(expect, jestDomMatchers);
}

// Workaround for missing global fail type for expect.
(globalThis as any).expect = expect;
(globalThis as any).vi = vi;
