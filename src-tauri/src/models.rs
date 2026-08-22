use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub working_directory: Option<String>,
    pub start_command: String,
    pub package_manager: Option<String>,
    pub url: String,
    pub port: Option<u16>,
    pub auto_start: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_opened_at: Option<String>,
    #[serde(default)]
    pub services: Vec<ServiceDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    pub name: String,
    pub root_path: String,
    pub working_directory: Option<String>,
    pub start_command: String,
    pub package_manager: Option<String>,
    pub url: String,
    pub port: Option<u16>,
    pub auto_start: bool,
    #[serde(default)]
    pub services: Vec<ServiceDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ServiceDefinition {
    pub id: String,
    pub name: String,
    pub start_command: String,
    pub working_directory: Option<String>,
    pub url: String,
    pub port: Option<u16>,
    pub package_manager: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortCandidate {
    pub port: u16,
    pub url: String,
    pub title: Option<String>,
    pub server: Option<String>,
    pub hmr: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptSuggestion {
    pub name: String,
    pub command: String,
    pub recommended: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetection {
    pub root_path: String,
    pub name: Option<String>,
    pub package_manager: Option<String>,
    pub framework: Option<String>,
    pub suggested_port: Option<u16>,
    pub scripts: Vec<ScriptSuggestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectConfig {
    pub version: u32,
    pub projects: Vec<Project>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub environment: String,
    pub config_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeStatus {
    Idle,
    Starting,
    Running,
    Stopping,
    Stopped,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeService {
    pub project_id: String,
    pub status: RuntimeStatus,
    pub pid: Option<u32>,
    pub detected_url: Option<String>,
    pub started_at: Option<String>,
    pub exit_code: Option<i32>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
    pub id: String,
    pub project_id: String,
    pub stream: String,
    pub level: String,
    pub text: String,
    pub timestamp: String,
}
