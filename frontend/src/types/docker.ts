// Docker resource type definitions

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: number;
  created: string;
  virtual_size: number;
  repo_tags: string[];
  repo_digests: string[];
  parent_id?: string;
  labels?: Record<string, string>;
}

export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  scope: string;
  created: string;
  labels?: Record<string, string>;
  options?: Record<string, string>;
  usage_data?: {
    size: number;
    ref_count: number;
  };
}

export interface DockerNetwork {
  id: string;
  name: string;
  driver: string;
  scope: string;
  created: string;
  ipam: {
    driver: string;
    config: Array<{
      subnet?: string;
      gateway?: string;
    }>;
  };
  containers: Record<
    string,
    {
      name: string;
      endpoint_id: string;
      ipv4_address?: string;
      ipv6_address?: string;
    }
  >;
  labels?: Record<string, string>;
  options?: Record<string, string>;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: string;
  ports: Array<{
    private_port: number;
    public_port?: number;
    type: string;
  }>;
  labels?: Record<string, string>;
  command?: string;
  size_rw?: number;
  size_root_fs?: number;
}

export interface DockerStatus {
  status: "connected" | "disconnected";
  docker_version?: string;
  error?: string;
}

// Component prop interfaces
export interface ImageCardProps {
  image: DockerImage;
  onDetailsClick: (imageId: string) => void;
  onRemoveClick: (imageId: string) => void;
  isSelected?: boolean;
  layout?: "grid" | "list";
}

export interface VolumeCardProps {
  volume: DockerVolume;
  onDetailsClick: (volumeName: string) => void;
  onRemoveClick: (volumeName: string) => void;
  isSelected?: boolean;
  layout?: "grid" | "list";
}

export interface NetworkCardProps {
  network: DockerNetwork;
  onDetailsClick: (networkId: string) => void;
  onRemoveClick: (networkId: string) => void;
  isSelected?: boolean;
  layout?: "grid" | "list";
}

export interface ContainerCardProps {
  container: DockerContainer;
  onDetailsClick: (containerId: string) => void;
  onActionClick: (containerId: string, action: string) => void;
  isSelected?: boolean;
  layout?: "grid" | "list";
}

// Grid component prop interfaces
export interface ImageGridProps {
  images: DockerImage[];
  onImageClick: (imageId: string) => void;
  onImageRemove: (imageId: string) => void;
  selectedImage?: string | null;
}

export interface VolumeGridProps {
  volumes: DockerVolume[];
  onVolumeClick: (volumeName: string) => void;
  onVolumeRemove: (volumeName: string) => void;
  selectedVolume?: string | null;
}

export interface NetworkGridProps {
  networks: DockerNetwork[];
  onNetworkClick: (networkId: string) => void;
  onNetworkRemove: (networkId: string) => void;
  selectedNetwork?: string | null;
}

export type ViewMode = "grid" | "list";

// Modal prop interfaces
export interface ResourceModalProps {
  open: boolean;
  onClose: () => void;
}

export interface ImageModalProps extends ResourceModalProps {
  image: DockerImage | null;
}

export interface VolumeModalProps extends ResourceModalProps {
  volume: DockerVolume | null;
}

export interface NetworkModalProps extends ResourceModalProps {
  network: DockerNetwork | null;
}

// Form data interfaces
export interface CreateVolumeData {
  name: string;
  driver?: string;
  labels?: Record<string, string>;
  options?: Record<string, string>;
}

export interface CreateNetworkData {
  name: string;
  driver?: string;
  subnet?: string;
  gateway?: string;
  labels?: Record<string, string>;
  options?: Record<string, string>;
}

export interface PullImageData {
  image: string;
  tag?: string;
}

export interface CreateContainerData {
  name: string;
  image: string;
  ports?: Array<{
    private_port: number;
    public_port?: number;
    type: string;
  }>;
  environment?: Record<string, string>;
  volumes?: Array<{
    source: string;
    target: string;
    type: "bind" | "volume";
  }>;
  network?: string;
  command?: string;
  labels?: Record<string, string>;
}
