import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Container, FilterState } from "@/types";

interface DashboardState {
  // Theme
  theme: "dark" | "light";
  toggleTheme: () => void;

  // Filters
  filters: FilterState;
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  resetFilters: () => void;

  // Selected container (for modal)
  selectedContainer: Container | null;
  openModal: (container: Container) => void;
  closeModal: () => void;

  // Realtime
  realtimeEnabled: boolean;
  toggleRealtime: () => void;
  realtimeContainers: Container[];
  addRealtimeContainer: (c: Container) => void;

  // Sidebar collapsed
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Notification count
  notificationCount: number;
  clearNotifications: () => void;

  // Active page
  activePage: string;
  setActivePage: (p: string) => void;
}

const DEFAULT_FILTERS: FilterState = {
  riskLevel: [],
  originCountries: [],
  minRiskScore: 0,
  maxRiskScore: 100,
  searchQuery: "",
  anomalyOnly: false,
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      theme: "dark",
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      filters: DEFAULT_FILTERS,
      setFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),

      selectedContainer: null,
      openModal: (container) => set({ selectedContainer: container }),
      closeModal: () => set({ selectedContainer: null }),

      realtimeEnabled: false,
      toggleRealtime: () => set((s) => ({ realtimeEnabled: !s.realtimeEnabled })),
      realtimeContainers: [],
      addRealtimeContainer: (c) =>
        set((s) => ({
          realtimeContainers: [c, ...s.realtimeContainers].slice(0, 20),
          notificationCount: s.notificationCount + (c.riskLevel === "Critical" ? 1 : 0),
        })),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      notificationCount: 3,
      clearNotifications: () => set({ notificationCount: 0 }),

      activePage: "overview",
      setActivePage: (p) => set({ activePage: p }),
    }),
    { name: "smartcontainer-dashboard" }
  )
);
