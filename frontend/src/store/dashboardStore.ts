import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Container, FilterState, BatchSummary } from "@/types";
import type { ContainerNote, FlaggedContainer, Notification } from "@/services/api";

export interface RiskAlert {
  id: string;
  containerId: string;
  riskScore: number;
  riskLevel: Container["riskLevel"];
  explanation: string;
  origin: string;
  timestamp: number;
}

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

  // Notifications list
  notifications: Notification[];
  setNotifications: (list: Notification[]) => void;
  setNotificationCount: (n: number) => void;

  // Active page
  activePage: string;
  setActivePage: (p: string) => void;

  // ── API data ───────────────────────────────────────────────────────────
  containers: Container[];
  batchSummary: BatchSummary | null;
  dataStatus: "idle" | "uploading" | "ready" | "error";
  uploadError: string | null;
  setApiData: (containers: Container[], summary: BatchSummary) => void;
  setUploading: () => void;
  setUploadError: (error: string) => void;
  clearApiData: () => void;

  // ── Live simulation ────────────────────────────────────────────────────
  simulationRunning: boolean;
  setSimulationRunning: (v: boolean) => void;
  simulatedCount: number;
  appendContainer: (c: Container) => void;
  riskAlerts: RiskAlert[];
  addRiskAlert: (a: RiskAlert) => void;
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;

  // ── Flagging & notes ───────────────────────────────────────────────────
  flaggedIds: string[];
  flaggedContainers: FlaggedContainer[];
  containerNotes: Record<string, ContainerNote[]>;
  setFlaggedContainers: (list: FlaggedContainer[]) => void;
  addFlaggedId: (id: string) => void;
  addFlaggedContainer: (entry: FlaggedContainer) => void;
  setNotesForContainer: (id: string, notes: ContainerNote[]) => void;
  appendNote: (id: string, note: ContainerNote) => void;

  // ── Initial data loading ───────────────────────────────────────────────
  initialLoadDone: boolean;
  setInitialLoadDone: () => void;
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

      notifications: [],
      setNotifications: (list) => set({ notifications: list }),
      setNotificationCount: (n) => set({ notificationCount: n }),

      activePage: "overview",
      setActivePage: (p) => set({ activePage: p }),

      // ── API data ─────────────────────────────────────────────────────────
      containers: [],
      batchSummary: null,
      dataStatus: "idle",
      uploadError: null,

      setApiData: (containers, summary) =>
        set({
          containers,
          batchSummary: summary,
          dataStatus: "ready",
          uploadError: null,
        }),

      setUploading: () =>
        set({ dataStatus: "uploading", uploadError: null }),

      setUploadError: (error) =>
        set({ dataStatus: "error", uploadError: error }),

      clearApiData: () =>
        set({
          containers: [],
          batchSummary: null,
          dataStatus: "idle",
          uploadError: null,
        }),

      // ── Live simulation ──────────────────────────────────────────────────
      simulationRunning: false,
      setSimulationRunning: (v) => set({ simulationRunning: v }),
      simulatedCount: 0,

      appendContainer: (c) =>
        set((s) => ({
          containers: [c, ...s.containers],
          simulatedCount: s.simulatedCount + 1,
          dataStatus: "ready",
          notificationCount:
            s.notificationCount + (c.riskLevel === "Critical" ? 1 : 0),
        })),

      riskAlerts: [],
      addRiskAlert: (a) =>
        set((s) => ({
          riskAlerts: [a, ...s.riskAlerts].slice(0, 50),
        })),
      dismissAlert: (id) =>
        set((s) => ({
          riskAlerts: s.riskAlerts.filter((a) => a.id !== id),
        })),
      clearAlerts: () => set({ riskAlerts: [] }),

      // ── Flagging & notes ────────────────────────────────────────────────
      flaggedIds: [],
      flaggedContainers: [],
      containerNotes: {},

      setFlaggedContainers: (list) =>
        set({
          flaggedContainers: list,
          flaggedIds: list.map((f) => String(f.container_id)),
        }),

      addFlaggedId: (id) =>
        set((s) =>
          s.flaggedIds.includes(id)
            ? {}
            : { flaggedIds: [...s.flaggedIds, id] },
        ),

      addFlaggedContainer: (entry) =>
        set((s) => {
          const cid = String(entry.container_id);
          if (s.flaggedIds.includes(cid)) return {};
          return {
            flaggedIds: [...s.flaggedIds, cid],
            flaggedContainers: [entry, ...s.flaggedContainers],
          };
        }),

      setNotesForContainer: (id, notes) =>
        set((s) => ({
          containerNotes: { ...s.containerNotes, [id]: notes },
        })),

      appendNote: (id, note) =>
        set((s) => ({
          containerNotes: {
            ...s.containerNotes,
            [id]: [...(s.containerNotes[id] ?? []), note],
          },
        })),

      // ── Initial data loading ────────────────────────────────────────────
      initialLoadDone: false,
      setInitialLoadDone: () => set({ initialLoadDone: true }),
    }),
    {
      name: "smartcontainer-dashboard",
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        activePage: state.activePage,
        filters: state.filters,
        realtimeEnabled: state.realtimeEnabled,
      }),
    }
  )
);
