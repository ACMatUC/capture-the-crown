import { useMemo, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const media = useMemo(() => window.matchMedia(query), [query]);
  return useSyncExternalStore(
    (listener) => {
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    () => media.matches,
    () => false,
  );
}
