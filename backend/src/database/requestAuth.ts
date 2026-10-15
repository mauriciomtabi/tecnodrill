import { AsyncLocalStorage } from 'node:async_hooks';

// Each legacy request uses its verified caller JWT, never a shared admin key.
export const requestAuth = new AsyncLocalStorage<string>();
