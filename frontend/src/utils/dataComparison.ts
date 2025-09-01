/**
 * Utility functions for deep object comparison and data change detection
 */

/**
 * Performs deep comparison of two objects to check if they are equal
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) {
    return true;
  }

  if (obj1 == null || obj2 == null) {
    return obj1 === obj2;
  }

  if (typeof obj1 !== typeof obj2) {
    return false;
  }

  if (typeof obj1 !== "object") {
    return obj1 === obj2;
  }

  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) {
      return false;
    }
    for (let i = 0; i < obj1.length; i++) {
      if (!deepEqual(obj1[i], obj2[i])) {
        return false;
      }
    }
    return true;
  }

  // Handle objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (keys2.indexOf(key) === -1 || !deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Checks if container data has meaningful changes that warrant a UI update
 */
export function hasContainerDataChanged(
  oldContainers: any[],
  newContainers: any[],
): boolean {
  if (!oldContainers || !newContainers) {
    return true;
  }

  if (oldContainers.length !== newContainers.length) {
    return true;
  }

  // Sort by ID to ensure consistent comparison
  const sortedOld = [...oldContainers].sort((a, b) => a.id.localeCompare(b.id));
  const sortedNew = [...newContainers].sort((a, b) => a.id.localeCompare(b.id));

  for (let i = 0; i < sortedOld.length; i++) {
    const oldContainer = sortedOld[i];
    const newContainer = sortedNew[i];

    // Check critical fields that affect UI
    if (
      oldContainer.id !== newContainer.id ||
      oldContainer.name !== newContainer.name ||
      oldContainer.status !== newContainer.status ||
      oldContainer.uptime !== newContainer.uptime ||
      Math.abs(
        (oldContainer.cpu_percent ?? 0.0) - (newContainer.cpu_percent ?? 0.0),
      ) > 0.1 ||
      Math.abs(
        (oldContainer.memory_percent ?? 0.0) -
          (newContainer.memory_percent ?? 0.0),
      ) > 0.1 ||
      !deepEqual(oldContainer.sparkline_data, newContainer.sparkline_data)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if system stats have meaningful changes
 */
export function hasSystemStatsChanged(oldStats: any, newStats: any): boolean {
  if (!oldStats || !newStats) {
    return true;
  }

  const significantFields = [
    "containers_running",
    "containers_stopped",
    "containers_total",
    "images",
    "volumes",
    "networks",
  ];

  return significantFields.some((field) => oldStats[field] !== newStats[field]);
}

/**
 * Merges system stats intelligently, preferring more recent or complete data
 */
export function mergeSystemStats(restApiStats: any, wsStats: any): any {
  if (!restApiStats && !wsStats) {
    return {
      containers_running: 0,
      containers_stopped: 0,
      containers_total: 0,
      images: 0,
      volumes: 0,
      networks: 0,
    };
  }

  if (!restApiStats) return wsStats;
  if (!wsStats) return restApiStats;

  // Prefer REST API data for complete counts, but use WS data for real-time running containers
  return {
    ...restApiStats,
    // Use WebSocket data for real-time running container count if available
    containers_running:
      wsStats.containers_running ?? restApiStats.containers_running,
    // Recalculate stopped containers if we have better running count
    containers_stopped:
      restApiStats.containers_total -
      (wsStats.containers_running ?? restApiStats.containers_running),
  };
}
