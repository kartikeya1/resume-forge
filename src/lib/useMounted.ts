'use client';

import { useSyncExternalStore } from 'react';

// Never changes, so React never re-subscribes and the store never re-notifies.
const noopSubscribe = () => () => {};

/**
 * True once the client has hydrated, false during SSR and the first render.
 *
 * Preferred over the `useState(false)` + `useEffect(() => setMounted(true))`
 * pattern: that schedules a second render pass from inside an effect (which
 * react-hooks/set-state-in-effect flags), whereas useSyncExternalStore is the
 * intended API for reading a value that legitimately differs between server and
 * client.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true, // client
    () => false // server snapshot
  );
}
