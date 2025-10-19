/**
 * Utility functions for formatting data across Docker resource pages
 */

import { ColorPaletteProp } from "@mui/joy";

/**
 * Format bytes to human readable format
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Format date/time to human readable format
 */
export const formatDateTime = (dateString: string): string => {
  if (!dateString) {
    return "Unknown";
  }

  const date = new Date(dateString);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 7) {
    return date.toLocaleDateString();
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
  } else {
    return "Just now";
  }
};

/**
 * Format timestamp (seconds from epoch) to human readable format
 */
export const formatTimestamp = (timestamp: number): string => {
  if (!timestamp || timestamp <= 0) {
    return "Unknown";
  }

  const date = new Date(timestamp * 1000);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return "Invalid Date";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 7) {
    return date.toLocaleDateString();
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
  } else {
    return "Just now";
  }
};

/**
 * Format image repository and tag
 */
export const formatImageTag = (repository: string, tag: string): string => {
  if (!repository || !tag) return repository || "unknown";

  // Handle special cases
  if (tag === "<none>") {
    return `${repository}:<none>`;
  }

  return `${repository}:${tag}`;
};

export const splitRepoTag = (repotag: string): [string, string] => {
  if (!repotag) return ["<none>", "<none>"];
  console.log("splitRepoTag", repotag);
  const [repository, tag] = repotag.split(":");
  return [repository, tag];
};

/**
 * Get status color for different resource types
 */
export const getStatusColor = (
  status: string,
  type: "container" | "image" | "volume" | "network",
): ColorPaletteProp => {
  const normalizedStatus = status.toLowerCase();

  switch (type) {
    case "container":
      switch (normalizedStatus) {
        case "running":
          return "success";
        case "stopped":
        case "exited":
          return "danger";
        case "paused":
          return "warning";
        case "restarting":
          return "primary";
        default:
          return "neutral";
      }

    case "image":
      // Images don't have traditional status, but we can use this for other indicators
      return "primary";

    case "volume":
      switch (normalizedStatus) {
        case "in-use":
          return "success";
        case "unused":
          return "warning";
        default:
          return "primary";
      }

    case "network":
      switch (normalizedStatus) {
        case "active":
          return "success";
        case "inactive":
          return "danger";
        default:
          return "primary";
      }

    default:
      return "neutral";
  }
};

/**
 * Format port mappings for display
 */
export const formatPorts = (
  ports: Array<{
    private_port: number;
    public_port?: number;
    type: string;
  }>,
): string => {
  if (!ports || ports.length === 0) {
    return "No ports exposed";
  }

  return ports
    .map((port) => {
      if (port.public_port) {
        return `${port.public_port}:${port.private_port}/${port.type}`;
      }
      return `${port.private_port}/${port.type}`;
    })
    .join(", ");
};

/**
 * Format network subnet information
 */
export const formatSubnet = (subnet?: string, gateway?: string): string => {
  if (!subnet && !gateway) return "No subnet configured";

  if (subnet && gateway) {
    return `${subnet} (Gateway: ${gateway})`;
  }

  return subnet || gateway || "Unknown";
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

/**
 * Format container command for display
 */
export const formatCommand = (command?: string): string => {
  if (!command) return "No command specified";

  // Truncate very long commands
  return truncateText(command, 50);
};

/**
 * Get network driver display name
 */
export const getNetworkDriverDisplay = (driver: string): string => {
  const driverMap: Record<string, string> = {
    bridge: "Bridge",
    host: "Host",
    overlay: "Overlay",
    macvlan: "MACVLAN",
    none: "None",
    null: "Null",
  };

  return driverMap[driver] || driver;
};

/**
 * Get volume driver display name
 */
export const getVolumeDriverDisplay = (driver: string): string => {
  const driverMap: Record<string, string> = {
    local: "Local",
    nfs: "NFS",
    cifs: "CIFS",
    overlay2: "Overlay2",
  };

  return driverMap[driver] || driver;
};

/**
 * Format labels as readable text
 */
export const formatLabels = (labels?: Record<string, string>): string => {
  if (!labels || Object.keys(labels).length === 0) {
    return "No labels";
  }

  const labelCount = Object.keys(labels).length;
  return `${labelCount} label${labelCount > 1 ? "s" : ""}`;
};

/**
 * Check if an image is dangling (untagged)
 */
export const isDanglingImage = (repotags: string[]): boolean => {
  for (const repotag of repotags) {
    const [repository, tag] = repotag.split(":");
    if (repository !== "<none>" || tag !== "<none>") {
      return false;
    }
  }
  return true;
};

/**
 * Format container uptime
 */
export const formatUptime = (createdAt: string, status: string): string => {
  if (status.toLowerCase() !== "running") {
    return "Not running";
  }

  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h`;
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes % 60}m`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m ${diffSeconds % 60}s`;
  } else {
    return `${diffSeconds}s`;
  }
};

export const stripSHA = (id_with_sha: string): string => {
  let shaString = "sha256:";
  if (id_with_sha.startsWith(shaString)) {
    return id_with_sha.slice(shaString.length);
  }
  return id_with_sha;
};
