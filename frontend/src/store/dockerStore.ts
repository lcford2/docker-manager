import { create } from "zustand";
import { ContainerStatsWithHistory } from "../types/metrics";
import { DockerContainer, DockerStatus } from "../types/docker";
import { mergeSystemStats } from "../utils/dataComparison";

// Define the structure for SystemStats
export interface SystemStats {
  containers_running: number;
  containers_stopped: number;
  containers_total: number;
  images: number;
  volumes: number;
  networks: number;
}

// Define the structure of the state
interface DockerState {
  containers: (ContainerStatsWithHistory | DockerContainer)[];
  systemStats: SystemStats;
  loading: boolean;
  error: string | null;
  dockerStatus: DockerStatus | null;
}

// Define the actions for the store
interface DockerActions {
  setContainers: (containers: DockerState["containers"]) => void;
  setSystemStats: (systemStats: DockerState["systemStats"]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setDockerStatus: (dockerStatus: DockerState["dockerStatus"]) => void;
  mergeData: (newData: Partial<DockerState>) => void; // For combining WS/REST data
}

// Initial state
const initialState: DockerState = {
  containers: [],
  systemStats: {
    containers_running: 0,
    containers_stopped: 0,
    containers_total: 0,
    images: 0,
    volumes: 0,
    networks: 0,
  },
  loading: true,
  error: null,
  dockerStatus: null,
};

// Create the Zustand store
export const useDockerStore = create<DockerState & DockerActions>(
  (set, get) => ({
    // State
    ...initialState,

    // Actions
    setContainers: (containers) => set({ containers }),
    setSystemStats: (systemStats) => set({ systemStats }),
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setDockerStatus: (dockerStatus) => set({ dockerStatus }),

    mergeData: (newData) =>
      set((state) => {
        const newState = { ...state, ...newData };

        // Smart merging for systemStats (prefer REST for totals, WS for real-time running)
        if (newData.containers) {
          newState.systemStats = mergeSystemStats(
            newData.systemStats ?? state.systemStats, // Use provided systemStats if any, else current
            {
              containers_running: newData.containers.filter(
                (c) =>
                  c.state === "running" ||
                  (c as ContainerStatsWithHistory).cpu_percent !== undefined, // Assume running if it has stats
              ).length,
              containers_total: newData.containers.length,
              // Other stats might need separate handling if not provided by WS
            },
          );
        }

        // Handle other merges as needed
        // e.g., if newData.dockerStatus is more recent
        return newState;
      }),
  }),
);
