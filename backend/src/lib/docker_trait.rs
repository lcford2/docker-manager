//! Docker client trait abstraction for testing
//!
//! Provides a trait-based abstraction over the bollard Docker client to enable
//! mocking in tests. This follows the Rust best practice of programming to
//! traits rather than concrete types.

use async_trait::async_trait;
use bollard::{
    Docker,
    container::{
        Config, CreateContainerOptions, InspectContainerOptions, ListContainersOptions,
        RemoveContainerOptions, StartContainerOptions, StopContainerOptions,
    },
    errors::Error as BollardError,
    image::{ListImagesOptions, RemoveImageOptions},
    models::{
        ContainerInspectResponse, ContainerSummary, ImageInspect, ImageSummary, Network,
        SystemVersion,
    },
    network::{CreateNetworkOptions, InspectNetworkOptions, ListNetworksOptions},
    secret::Secret,
    volume::{CreateVolumeOptions, ListVolumesOptions, RemoveVolumeOptions},
};
use std::sync::Mutex;

/// Trait abstracting Docker client operations
///
/// This trait defines all Docker operations used by the application,
/// allowing us to swap in a mock implementation for testing.
#[async_trait]
pub trait DockerClient: Send + Sync {
    /// List containers with optional filters
    async fn list_containers(
        &self,
        options: Option<ListContainersOptions<String>>,
    ) -> Result<Vec<ContainerSummary>, BollardError>;

    /// Inspect a container
    async fn inspect_container(
        &self,
        name: &str,
        options: Option<InspectContainerOptions>,
    ) -> Result<ContainerInspectResponse, BollardError>;

    /// Start a container
    async fn start_container(
        &self,
        name: &str,
        options: Option<StartContainerOptions<String>>,
    ) -> Result<(), BollardError>;

    /// Stop a container
    async fn stop_container(
        &self,
        name: &str,
        options: Option<StopContainerOptions>,
    ) -> Result<(), BollardError>;

    /// Remove a container
    async fn remove_container(
        &self,
        name: &str,
        options: Option<RemoveContainerOptions>,
    ) -> Result<(), BollardError>;

    /// Create a container
    async fn create_container(
        &self,
        options: Option<CreateContainerOptions<String>>,
        config: Config<String>,
    ) -> Result<bollard::models::ContainerCreateResponse, BollardError>;

    /// List images
    async fn list_images(
        &self,
        options: Option<ListImagesOptions<String>>,
    ) -> Result<Vec<ImageSummary>, BollardError>;

    /// Inspect an image
    async fn inspect_image(&self, name: &str) -> Result<ImageInspect, BollardError>;

    /// Remove an image
    async fn remove_image(
        &self,
        name: &str,
        options: Option<RemoveImageOptions>,
    ) -> Result<Vec<bollard::models::ImageDeleteResponseItem>, BollardError>;

    /// List volumes
    async fn list_volumes(
        &self,
        options: Option<ListVolumesOptions<String>>,
    ) -> Result<bollard::models::VolumeListResponse, BollardError>;

    /// Create a volume
    async fn create_volume(
        &self,
        config: CreateVolumeOptions<String>,
    ) -> Result<bollard::models::Volume, BollardError>;

    /// Remove a volume
    async fn remove_volume(
        &self,
        name: &str,
        options: Option<RemoveVolumeOptions>,
    ) -> Result<(), BollardError>;

    /// List networks
    async fn list_networks(
        &self,
        options: Option<ListNetworksOptions<String>>,
    ) -> Result<Vec<Network>, BollardError>;

    /// Create a network
    async fn create_network(
        &self,
        config: CreateNetworkOptions<String>,
    ) -> Result<bollard::models::NetworkCreateResponse, BollardError>;

    /// Inspect a network
    async fn inspect_network(
        &self,
        name: &str,
        options: Option<InspectNetworkOptions<String>>,
    ) -> Result<Network, BollardError>;

    /// Get Docker version
    async fn version(&self) -> Result<SystemVersion, BollardError>;
}

/// Implementation of DockerClient trait for bollard::Docker
///
/// This is a zero-cost abstraction - it simply delegates to the underlying
/// Docker client without any overhead.
#[async_trait]
impl DockerClient for Docker {
    async fn list_containers(
        &self,
        options: Option<ListContainersOptions<String>>,
    ) -> Result<Vec<ContainerSummary>, BollardError> {
        self.list_containers(options).await
    }

    async fn inspect_container(
        &self,
        name: &str,
        options: Option<InspectContainerOptions>,
    ) -> Result<ContainerInspectResponse, BollardError> {
        self.inspect_container(name, options).await
    }

    async fn start_container(
        &self,
        name: &str,
        options: Option<StartContainerOptions<String>>,
    ) -> Result<(), BollardError> {
        self.start_container(name, options).await
    }

    async fn stop_container(
        &self,
        name: &str,
        options: Option<StopContainerOptions>,
    ) -> Result<(), BollardError> {
        self.stop_container(name, options).await
    }

    async fn remove_container(
        &self,
        name: &str,
        options: Option<RemoveContainerOptions>,
    ) -> Result<(), BollardError> {
        self.remove_container(name, options).await
    }

    async fn create_container(
        &self,
        options: Option<CreateContainerOptions<String>>,
        config: Config<String>,
    ) -> Result<bollard::models::ContainerCreateResponse, BollardError> {
        self.create_container(options, config).await
    }

    async fn list_images(
        &self,
        options: Option<ListImagesOptions<String>>,
    ) -> Result<Vec<ImageSummary>, BollardError> {
        self.list_images(options).await
    }

    async fn inspect_image(&self, name: &str) -> Result<ImageInspect, BollardError> {
        self.inspect_image(name).await
    }

    async fn remove_image(
        &self,
        name: &str,
        options: Option<RemoveImageOptions>,
    ) -> Result<Vec<bollard::models::ImageDeleteResponseItem>, BollardError> {
        self.remove_image(name, options, None).await
    }

    async fn list_volumes(
        &self,
        options: Option<ListVolumesOptions<String>>,
    ) -> Result<bollard::models::VolumeListResponse, BollardError> {
        self.list_volumes(options).await
    }

    async fn create_volume(
        &self,
        config: CreateVolumeOptions<String>,
    ) -> Result<bollard::models::Volume, BollardError> {
        self.create_volume(config).await
    }

    async fn remove_volume(
        &self,
        name: &str,
        options: Option<RemoveVolumeOptions>,
    ) -> Result<(), BollardError> {
        self.remove_volume(name, options).await
    }

    async fn list_networks(
        &self,
        options: Option<ListNetworksOptions<String>>,
    ) -> Result<Vec<Network>, BollardError> {
        self.list_networks(options).await
    }

    async fn create_network(
        &self,
        config: CreateNetworkOptions<String>,
    ) -> Result<bollard::models::NetworkCreateResponse, BollardError> {
        self.create_network(config).await
    }

    async fn inspect_network(
        &self,
        name: &str,
        options: Option<InspectNetworkOptions<String>>,
    ) -> Result<Network, BollardError> {
        self.inspect_network(name, options).await
    }

    async fn version(&self) -> Result<SystemVersion, BollardError> {
        self.version().await
    }
}

/// Mock Docker client for testing
///
/// Provides configurable responses and tracks operations for verification.
#[derive(Debug, Clone)]
pub struct MockDockerClient {
    containers: Vec<ContainerSummary>,
    images: Vec<ImageSummary>,
    volumes: Vec<bollard::models::Volume>,
    networks: Vec<Network>,
    operations: std::sync::Arc<Mutex<Vec<String>>>,
}

impl MockDockerClient {
    /// Create a new mock Docker client with empty data
    pub fn new() -> Self {
        Self {
            containers: Vec::new(),
            images: Vec::new(),
            volumes: Vec::new(),
            networks: Vec::new(),
            operations: std::sync::Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Configure mock with containers
    pub fn with_containers(mut self, containers: Vec<ContainerSummary>) -> Self {
        self.containers = containers;
        self
    }

    /// Configure mock with images
    pub fn with_images(mut self, images: Vec<ImageSummary>) -> Self {
        self.images = images;
        self
    }

    /// Configure mock with volumes
    pub fn with_volumes(mut self, volumes: Vec<bollard::models::Volume>) -> Self {
        self.volumes = volumes;
        self
    }

    /// Configure mock with networks
    pub fn with_networks(mut self, networks: Vec<Network>) -> Self {
        self.networks = networks;
        self
    }

    /// Get list of operations performed on this mock
    pub fn get_operations(&self) -> Vec<String> {
        self.operations.lock().unwrap().clone()
    }

    /// Record an operation
    fn record_operation(&self, operation: &str) {
        self.operations.lock().unwrap().push(operation.to_string());
    }
}

impl Default for MockDockerClient {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl DockerClient for MockDockerClient {
    async fn list_containers(
        &self,
        _options: Option<ListContainersOptions<String>>,
    ) -> Result<Vec<ContainerSummary>, BollardError> {
        self.record_operation("list_containers");
        Ok(self.containers.clone())
    }

    async fn inspect_container(
        &self,
        name: &str,
        _options: Option<InspectContainerOptions>,
    ) -> Result<ContainerInspectResponse, BollardError> {
        self.record_operation(&format!("inspect_container:{}", name));
        // Return a minimal mock response
        Ok(ContainerInspectResponse {
            id: Some(name.to_string()),
            ..Default::default()
        })
    }

    async fn start_container(
        &self,
        name: &str,
        _options: Option<StartContainerOptions<String>>,
    ) -> Result<(), BollardError> {
        self.record_operation(&format!("start_container:{}", name));
        Ok(())
    }

    async fn stop_container(
        &self,
        name: &str,
        _options: Option<StopContainerOptions>,
    ) -> Result<(), BollardError> {
        self.record_operation(&format!("stop_container:{}", name));
        Ok(())
    }

    async fn remove_container(
        &self,
        name: &str,
        _options: Option<RemoveContainerOptions>,
    ) -> Result<(), BollardError> {
        self.record_operation(&format!("remove_container:{}", name));
        Ok(())
    }

    async fn create_container(
        &self,
        _options: Option<CreateContainerOptions<String>>,
        _config: Config<String>,
    ) -> Result<bollard::models::ContainerCreateResponse, BollardError> {
        self.record_operation("create_container");
        Ok(bollard::models::ContainerCreateResponse {
            id: "mock_container_id".to_string(),
            warnings: Vec::new(),
        })
    }

    async fn list_images(
        &self,
        _options: Option<ListImagesOptions<String>>,
    ) -> Result<Vec<ImageSummary>, BollardError> {
        self.record_operation("list_images");
        Ok(self.images.clone())
    }

    async fn inspect_image(&self, name: &str) -> Result<ImageInspect, BollardError> {
        self.record_operation(&format!("inspect_image:{}", name));
        Ok(ImageInspect {
            id: Some(name.to_string()),
            ..Default::default()
        })
    }

    async fn remove_image(
        &self,
        name: &str,
        _options: Option<RemoveImageOptions>,
    ) -> Result<Vec<bollard::models::ImageDeleteResponseItem>, BollardError> {
        self.record_operation(&format!("remove_image:{}", name));
        Ok(Vec::new())
    }

    async fn list_volumes(
        &self,
        _options: Option<ListVolumesOptions<String>>,
    ) -> Result<bollard::models::VolumeListResponse, BollardError> {
        self.record_operation("list_volumes");
        Ok(bollard::models::VolumeListResponse {
            volumes: Some(self.volumes.clone()),
            warnings: None,
        })
    }

    async fn create_volume(
        &self,
        _config: CreateVolumeOptions<String>,
    ) -> Result<bollard::models::Volume, BollardError> {
        self.record_operation("create_volume");
        Ok(bollard::models::Volume {
            name: "mock_volume".to_string(),
            ..Default::default()
        })
    }

    async fn remove_volume(
        &self,
        name: &str,
        _options: Option<RemoveVolumeOptions>,
    ) -> Result<(), BollardError> {
        self.record_operation(&format!("remove_volume:{}", name));
        Ok(())
    }

    async fn list_networks(
        &self,
        _options: Option<ListNetworksOptions<String>>,
    ) -> Result<Vec<Network>, BollardError> {
        self.record_operation("list_networks");
        Ok(self.networks.clone())
    }

    async fn create_network(
        &self,
        _config: CreateNetworkOptions<String>,
    ) -> Result<bollard::models::NetworkCreateResponse, BollardError> {
        self.record_operation("create_network");
        Ok(bollard::models::NetworkCreateResponse {
            id: "mock_network_id".to_string(),
            warning: String::new(),
        })
    }

    async fn inspect_network(
        &self,
        name: &str,
        _options: Option<InspectNetworkOptions<String>>,
    ) -> Result<Network, BollardError> {
        self.record_operation(&format!("inspect_network:{}", name));
        Ok(Network {
            name: Some(name.to_string()),
            id: Some(name.to_string()),
            ..Default::default()
        })
    }

    async fn version(&self) -> Result<SystemVersion, BollardError> {
        self.record_operation("version");
        Ok(SystemVersion {
            api_version: Some("1.43".to_string()),
            version: Some("24.0.0".to_string()),
            ..Default::default()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_list_containers() {
        let mock = MockDockerClient::new().with_containers(vec![ContainerSummary {
            id: Some("container1".to_string()),
            names: Some(vec!["/test".to_string()]),
            ..Default::default()
        }]);

        let containers = mock.list_containers(None).await.unwrap();
        assert_eq!(containers.len(), 1);
        assert_eq!(containers[0].id.as_ref().unwrap(), "container1");

        let ops = mock.get_operations();
        assert!(ops.contains(&"list_containers".to_string()));
    }

    #[tokio::test]
    async fn test_mock_operations_tracking() {
        let mock = MockDockerClient::new();

        let _ = mock.list_containers(None).await;
        let _ = mock.list_images(None).await;
        let _ = mock.version().await;

        let ops = mock.get_operations();
        assert_eq!(ops.len(), 3);
        assert!(ops.contains(&"list_containers".to_string()));
        assert!(ops.contains(&"list_images".to_string()));
        assert!(ops.contains(&"version".to_string()));
    }
}
