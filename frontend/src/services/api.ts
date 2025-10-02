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

export const dockerAPI = {
  getSystemInfo: async () => {
    const response = await api.get("/docker-status");
    return response.data;
  },

  getContainers: async () => {
    const response = await api.get("/docker/containers");
    return response.data;
  },

  getContainer: async (id: string) => {
    const response = await api.get(`/docker/containers/${id}`);
    return response.data;
  },

  startContainer: async (id: string) => {
    const response = await api.post(`/docker/containers/start/${id}`);
    return response.data;
  },

  stopContainer: async (id: string) => {
    const response = await api.post(`/docker/containers/stop/${id}`);
    return response.data;
  },

  restartContainer: async (id: string) => {
    const response = await api.post(`/docker/containers/restart/${id}`);
    return response.data;
  },

  removeContainer: async (id: string, force: boolean = false) => {
    const response = await api.delete(
      `/docker/containers/${id}${force ? "?force=true" : ""}`,
    );
    return response.data;
  },

  bulkStopContainers: async (
    containerIds: string[],
    force: boolean = false,
  ) => {
    const response = await api.post("/containers/bulk-stop", {
      entity_ids: containerIds,
      force: force,
    });
    return response.data;
  },

  bulkRestartContainers: async (containerIds: string[]) => {
    const response = await api.post("/containers/bulk-restart", {
      container_ids: containerIds,
    });
    return response.data;
  },

  bulkRemoveContainers: async (
    containerIds: string[],
    force: boolean = false,
  ) => {
    const response = await api.post("/containers/bulk-delete", {
      entity_ids: containerIds,
      force: force,
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
      `/containers/${containerId}/metrics/history?minutes=${minutes}`,
    );
    return response.data;
  },

  // Image management
  pullImage: async (imageName: string) => {
    const response = await api.post("/images/pull", { image: imageName });
    return response.data;
  },

  removeImage: async (imageId: string, force: boolean = false) => {
    const response = await api.delete(
      `/images/${imageId}${force ? "?force=true" : ""}`,
    );
    return response.data;
  },

  bulkRemoveImages: async (imageIds: string[], force: boolean = false) => {
    const response = await api.post("/images/bulk-delete", {
      entity_ids: imageIds,
      force: force,
    });
    return response.data;
  },

  inspectImage: async (imageId: string) => {
    const response = await api.get(`/images/${imageId}/inspect`);
    return response.data;
  },

  // Volume management
  createVolume: async (volumeData: {
    name: string;
    driver?: string;
    labels?: Record<string, string>;
  }) => {
    const response = await api.post("/volumes", volumeData);
    return response.data;
  },

  removeVolume: async (volumeName: string, force: boolean = false) => {
    const response = await api.delete(
      `/volumes/${volumeName}${force ? "?force=true" : ""}`,
    );
    return response.data;
  },

  inspectVolume: async (volumeName: string) => {
    const response = await api.get(`/volumes/${volumeName}/inspect`);
    return response.data;
  },

  // Network management
  createNetwork: async (networkData: {
    name: string;
    driver?: string;
    labels?: Record<string, string>;
  }) => {
    const response = await api.post("/networks", networkData);
    return response.data;
  },

  removeNetwork: async (networkId: string) => {
    const response = await api.delete(`/networks/${networkId}`);
    return response.data;
  },

  inspectNetwork: async (networkId: string) => {
    const response = await api.get(`/networks/${networkId}/inspect`);
    return response.data;
  },

  connectContainerToNetwork: async (networkId: string, containerId: string) => {
    const response = await api.post(`/networks/${networkId}/connect`, {
      container: containerId,
    });
    return response.data;
  },

  disconnectContainerFromNetwork: async (
    networkId: string,
    containerId: string,
  ) => {
    const response = await api.post(`/networks/${networkId}/disconnect`, {
      container: containerId,
    });
    return response.data;
  },
};

export default api;
