import axios from "axios";

const API_BASE_URL = "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  login: async (username: string, password: string) => {
    console.log(API_BASE_URL);
    console.log(process.env.REACT_APP_API_URL);
    const formData = new URLSearchParams();
    formData.append("user_name", username);
    formData.append("password", password);
    const response = await axios.post(`${API_BASE_URL}/auth/login`, formData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },
};

export const usersAPI = {
  listUsers: async () => {
    const response = await api.get("/users");
    return response.data;
  },
  getUser: async (id: number) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },
  createUser: async (userData: {
    username: string;
    email: string;
    password: string;
    permission: string;
  }) => {
    const response = await api.post("/users", userData);
    return response.data;
  },
  updateUser: async (
    id: number,
    userData: {
      username?: string;
      email?: string;
      password?: string;
      permission?: string;
      is_active?: boolean;
    },
  ) => {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  },
  deleteUser: async (id: number) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },
};

export const dockerAPI = {
  getSystemInfo: async () => {
    const response = await api.get("/docker-status");
    return response.data;
  },

  getContainers: async () => {
    const response = await api.get("/docker/containers");
    return response.data;
  },

  getContainer: async (name: string) => {
    const response = await api.get(`/docker/containers/${name}`);
    return response.data;
  },

  startContainer: async (name: string) => {
    const response = await api.post(`/docker/containers/start/${name}`);
    return response.data;
  },

  stopContainer: async (name: string) => {
    const response = await api.post(`/docker/containers/stop/${name}`);
    return response.data;
  },

  restartContainer: async (name: string) => {
    const response = await api.post(`/docker/containers/restart/${name}`);
    return response.data;
  },

  removeContainer: async (name: string, force: boolean = false) => {
    const response = await api.delete(`/docker/containers/${name}`, {
      params: {
        force: force,
      },
    });
    return response.data;
  },

  bulkStopContainers: async (
    containerIds: string[],
    force: boolean = false,
  ) => {
    const response = await api.post("/docker/containers/bulk-stop", {
      containers: containerIds,
      signal: "SIGTERM",
    });
    return response.data;
  },

  bulkRestartContainers: async (containerIds: string[]) => {
    const response = await api.post("/docker/containers/bulk-restart", {
      containers: containerIds,
    });
    return response.data;
  },

  bulkRemoveContainers: async (
    containerIds: string[],
    force: boolean = false,
  ) => {
    const response = await api.post("/docker/containers/bulk-delete", {
      containers: containerIds,
      force: force,
      volumes: false,
      links: false,
    });
    return response.data;
  },

  getVolumes: async () => {
    const response = await api.get("/docker/volumes");
    return response.data;
  },

  getImages: async () => {
    const response = await api.get("/docker/images");
    return response.data;
  },

  getNetworks: async () => {
    const response = await api.get("/docker/networks");
    return response.data;
  },

  getContainerMetricsHistory: async (
    containerId: string,
    minutes: number = 60,
  ) => {
    const response = await api.get(
      `/docker/containers/${containerId}/metrics/history?minutes=${minutes}`,
    );
    return response.data;
  },

  getAggregateMetricsHistory: async (
    minutes: number = 30,
    limit: number = 100,
  ) => {
    const response = await api.get(
      `/db/aggregate_metrics?minutes=${minutes}&limit=${limit}`,
    );
    return response.data;
  },

  // Image management
  pullImage: async (imageName: string) => {
    const response = await api.post(`/docker/images/pull/${imageName}`);
    return response.data;
  },

  removeImage: async (imageId: string, force: boolean = false) => {
    const response = await api.delete(`/docker/images/${imageId}`, {
      params: {
        force: force,
      },
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  },

  pruneImages: async () => {
    const response = await api.post("/docker/images/prune");
    return response.data;
  },

  bulkRemoveImages: async (imageIds: string[], force: boolean = false) => {
    const response = await api.post("/docker/images/bulk-delete", {
      images: imageIds,
      force: force,
      noprune: false,
    });
    return response.data;
  },

  inspectImage: async (imageId: string) => {
    const response = await api.get(`/docker/images/inspect/${imageId}`);
    return response.data;
  },

  // Volume management
  createVolume: async (volumeData: {
    name: string;
    driver?: string;
    labels?: Record<string, string>;
  }) => {
    const response = await api.post("/docker/volumes", volumeData);
    return response.data;
  },

  removeVolume: async (volumeName: string, force: boolean = false) => {
    const response = await api.delete(`/docker/volumes/${volumeName}`, {
      params: {
        force: force,
      },
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  },

  pruneVolumes: async () => {
    const response = await api.post("/docker/volumes/prune");
    return response.data;
  },

  inspectVolume: async (volumeName: string) => {
    const response = await api.get(`/docker/volumes/inspect/${volumeName}`);
    return response.data;
  },

  bulkRemoveVolumes: async (volumeNames: string[], force: boolean = false) => {
    const response = await api.post("/docker/volumes/bulk-delete", {
      volumes: volumeNames,
      force: force,
    });
    return response.data;
  },

  // Network management
  createNetwork: async (networkData: {
    name: string;
    driver?: string;
    labels?: Record<string, string>;
  }) => {
    const response = await api.post("/docker/networks", networkData);
    return response.data;
  },

  removeNetwork: async (networkId: string) => {
    const response = await api.delete(`/docker/networks/${networkId}`);
    return response.data;
  },

  pruneNetworks: async () => {
    const response = await api.post("/docker/networks/prune");
    return response.data;
  },

  inspectNetwork: async (networkId: string) => {
    const response = await api.get(`/docker/networks/${networkId}/inspect`);
    return response.data;
  },

  bulkRemoveNetworks: async (networkNames: string[]) => {
    const response = await api.post("/docker/networks/bulk-delete", {
      networks: networkNames,
    });
    return response.data;
  },

  connectContainerToNetwork: async (networkId: string, containerId: string) => {
    const response = await api.post(`/docker/networks/${networkId}/connect`, {
      container: containerId,
    });
    return response.data;
  },

  disconnectContainerFromNetwork: async (
    networkId: string,
    containerId: string,
  ) => {
    const response = await api.post(
      `/docker/networks/${networkId}/disconnect`,
      {
        container: containerId,
      },
    );
    return response.data;
  },
};

export default api;
