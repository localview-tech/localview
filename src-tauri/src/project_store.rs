use crate::models::{Project, ProjectConfig, ProjectInput};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const CONFIG_VERSION: u32 = 1;

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("项目配置读取失败: {0}")]
    Read(#[from] std::io::Error),
    #[error("项目配置解析失败: {0}")]
    Parse(#[from] serde_json::Error),
    #[error("项目不存在")]
    NotFound,
    #[error("项目名称不能为空")]
    EmptyName,
    #[error("项目目录不存在或不是目录")]
    InvalidRootPath,
    #[error("工作目录不存在或不是目录")]
    InvalidWorkingDirectory,
    #[error("启动命令不能为空")]
    EmptyCommand,
    #[error("URL 必须是 localhost 或 127.0.0.1 地址")]
    InvalidUrl,
    #[error("URL 中的端口与端口字段不一致")]
    PortMismatch,
}

impl StoreError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Read(_) => "CONFIG_READ",
            Self::Parse(_) => "CONFIG_PARSE",
            Self::NotFound => "NOT_FOUND",
            Self::EmptyName => "EMPTY_NAME",
            Self::InvalidRootPath => "INVALID_ROOT_PATH",
            Self::InvalidWorkingDirectory => "INVALID_WORKING_DIRECTORY",
            Self::EmptyCommand => "EMPTY_COMMAND",
            Self::InvalidUrl => "INVALID_URL",
            Self::PortMismatch => "PORT_MISMATCH",
        }
    }
}

pub struct ProjectStore {
    config_path: PathBuf,
}

impl ProjectStore {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, StoreError> {
        fs::create_dir_all(&app_data_dir)?;
        Ok(Self {
            config_path: app_data_dir.join("projects.json"),
        })
    }

    pub fn config_path(&self) -> &Path {
        &self.config_path
    }

    pub fn list(&self) -> Result<Vec<Project>, StoreError> {
        Ok(self.load()?.projects)
    }

    pub fn create(&self, input: ProjectInput) -> Result<Project, StoreError> {
        validate_input(&input)?;
        let now = timestamp();
        let project = Project {
            id: format!("project_{}", Uuid::new_v4().simple()),
            name: input.name.trim().to_string(),
            root_path: normalize_path(&input.root_path),
            working_directory: input.working_directory.map(|value| normalize_path(&value)),
            start_command: input.start_command.trim().to_string(),
            package_manager: input.package_manager,
            url: input.url.trim().to_string(),
            port: input.port,
            auto_start: input.auto_start,
            created_at: now.clone(),
            updated_at: now,
            last_opened_at: None,
        };
        let mut config = self.load()?;
        config.projects.push(project.clone());
        self.save(&config)?;
        Ok(project)
    }

    pub fn update(&self, id: &str, input: ProjectInput) -> Result<Project, StoreError> {
        validate_input(&input)?;
        let mut config = self.load()?;
        let project = config
            .projects
            .iter_mut()
            .find(|project| project.id == id)
            .ok_or(StoreError::NotFound)?;
        project.name = input.name.trim().to_string();
        project.root_path = normalize_path(&input.root_path);
        project.working_directory = input.working_directory.map(|value| normalize_path(&value));
        project.start_command = input.start_command.trim().to_string();
        project.package_manager = input.package_manager;
        project.url = input.url.trim().to_string();
        project.port = input.port;
        project.auto_start = input.auto_start;
        project.updated_at = timestamp();
        let result = project.clone();
        self.save(&config)?;
        Ok(result)
    }

    pub fn delete(&self, id: &str) -> Result<(), StoreError> {
        let mut config = self.load()?;
        let original_len = config.projects.len();
        config.projects.retain(|project| project.id != id);
        if config.projects.len() == original_len {
            return Err(StoreError::NotFound);
        }
        self.save(&config)
    }

    pub fn mark_opened(&self, id: &str) -> Result<Project, StoreError> {
        let mut config = self.load()?;
        let project = config
            .projects
            .iter_mut()
            .find(|project| project.id == id)
            .ok_or(StoreError::NotFound)?;
        project.last_opened_at = Some(timestamp());
        let result = project.clone();
        self.save(&config)?;
        Ok(result)
    }

    fn load(&self) -> Result<ProjectConfig, StoreError> {
        if !self.config_path.exists() {
            return Ok(ProjectConfig {
                version: CONFIG_VERSION,
                projects: Vec::new(),
            });
        }
        let raw = fs::read_to_string(&self.config_path)?;
        let mut config: ProjectConfig = match serde_json::from_str(&raw) {
            Ok(config) => config,
            Err(parse_error) => {
                let backup_path = self.config_path.with_extension("json.bak");
                let backup_raw = backup_path
                    .exists()
                    .then(|| fs::read_to_string(&backup_path))
                    .transpose()?;
                if let Some(backup_raw) = backup_raw {
                    match serde_json::from_str(&backup_raw) {
                        Ok(config) => {
                            let _ = fs::copy(&backup_path, &self.config_path);
                            config
                        }
                        Err(_) => return Err(StoreError::Parse(parse_error)),
                    }
                } else {
                    return Err(StoreError::Parse(parse_error));
                }
            }
        };
        if config.version == 0 {
            config.version = CONFIG_VERSION;
        }
        Ok(config)
    }

    fn save(&self, config: &ProjectConfig) -> Result<(), StoreError> {
        let temp_path = self.config_path.with_extension("json.tmp");
        let serialized = serde_json::to_string_pretty(config)?;
        fs::write(&temp_path, format!("{serialized}\n"))?;
        if self.config_path.exists() {
            let backup_path = self.config_path.with_extension("json.bak");
            let _ = fs::copy(&self.config_path, backup_path);
        }
        fs::rename(temp_path, &self.config_path)?;
        Ok(())
    }
}

fn validate_input(input: &ProjectInput) -> Result<(), StoreError> {
    if input.name.trim().is_empty() {
        return Err(StoreError::EmptyName);
    }
    if input.start_command.trim().is_empty() {
        return Err(StoreError::EmptyCommand);
    }
    let root = Path::new(&input.root_path);
    if !root.is_dir() {
        return Err(StoreError::InvalidRootPath);
    }
    if let Some(working_directory) = &input.working_directory {
        if !Path::new(working_directory).is_dir() {
            return Err(StoreError::InvalidWorkingDirectory);
        }
    }
    let url = input
        .url
        .trim()
        .parse::<url::Url>()
        .map_err(|_| StoreError::InvalidUrl)?;
    let host = url.host_str().unwrap_or_default();
    if url.scheme() != "http" && url.scheme() != "https"
        || !matches!(host, "localhost" | "127.0.0.1" | "::1")
    {
        return Err(StoreError::InvalidUrl);
    }
    if let (Some(port), Some(url_port)) = (input.port, url.port_or_known_default()) {
        if port != url_port {
            return Err(StoreError::PortMismatch);
        }
    }
    Ok(())
}

fn normalize_path(path: &str) -> String {
    Path::new(path).to_string_lossy().to_string()
}

fn timestamp() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}.{:03}", duration.as_secs(), duration.subsec_millis())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn input(root: &Path) -> ProjectInput {
        ProjectInput {
            name: "Demo".into(),
            root_path: root.to_string_lossy().into(),
            working_directory: None,
            start_command: "npm run dev".into(),
            package_manager: Some("npm".into()),
            url: "http://localhost:5173".into(),
            port: Some(5173),
            auto_start: false,
        }
    }

    #[test]
    fn creates_updates_and_deletes_project() {
        let directory = tempdir().expect("temp dir");
        let store = ProjectStore::new(directory.path().join("data")).expect("store");
        let project = store.create(input(directory.path())).expect("create");
        assert_eq!(store.list().expect("list").len(), 1);
        let mut updated = input(directory.path());
        updated.name = "Updated".into();
        assert_eq!(
            store.update(&project.id, updated).expect("update").name,
            "Updated"
        );
        store.delete(&project.id).expect("delete");
        assert!(store.list().expect("list").is_empty());
    }

    #[test]
    fn recovers_from_a_corrupt_primary_config() {
        let directory = tempdir().expect("temp dir");
        let store = ProjectStore::new(directory.path().join("data")).expect("store");
        store.create(input(directory.path())).expect("create");
        let mut updated = input(directory.path());
        updated.name = "Recovered project".into();
        store
            .update("missing", updated.clone())
            .expect_err("missing id");
        let project = store.list().expect("list").remove(0);
        store.update(&project.id, updated).expect("update");
        fs::write(store.config_path(), "{broken").expect("corrupt config");
        assert_eq!(store.list().expect("recover")[0].name, "Demo");
    }
}
