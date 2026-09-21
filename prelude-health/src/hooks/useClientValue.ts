'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

// Browser-only state — localStorage, the URL, feature detection — read through
// useSyncExternalStore. The server snapshot keeps hydration deterministic while
// the client reads the real value during render, so no effect has to call
// setState just to load it. `changeEvent` is a window event that invalidates the
// cached snapshot; the returned refresh() does the same after a local write.
export function useClientValue<T>(
  read: () => T,
  serverValue: T,
  changeEvent?: string,
): [T, () => void] {
  const store = useMemo(() => createStore(read, changeEvent), [read, changeEvent]);
  const getServerSnapshot = useCallback(() => serverValue, [serverValue]);
  const value = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);
  return [value, store.refresh];
}

function createStore<T>(read: () => T, changeEvent?: string) {
  const listeners = new Set<() => void>();
  let cached: { value: T } | null = null;

  const invalidate = () => {
    cached = null;
    listeners.forEach((listener) => listener());
  };

  const subscribe = (onStoreChange: () => void) => {
    listeners.add(onStoreChange);
    if (changeEvent && listeners.size === 1) window.addEventListener(changeEvent, invalidate);
    return () => {
      listeners.delete(onStoreChange);
      if (changeEvent && listeners.size === 0) window.removeEventListener(changeEvent, invalidate);
    };
  };

  const getSnapshot = (): T => {
    cached ??= { value: read() };
    return cached.value;
  };

  return { subscribe, getSnapshot, refresh: invalidate };
}
