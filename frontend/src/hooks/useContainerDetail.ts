import { useState, useCallback } from "react";
import type { Container } from "@/types";

export function useContainerDetail() {
  const [selected, setSelected] = useState<Container | null>(null);

  const open = useCallback((container: Container) => setSelected(container), []);
  const close = useCallback(() => setSelected(null), []);

  return { selected, open, close } as const;
}
