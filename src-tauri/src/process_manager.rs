use crate::models::{LogLine, Project, RuntimeService, RuntimeStatus};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::net::TcpStream;
use tokio::process::{Child, ChildStderr, ChildStdout, Command};
use tokio::sync::{oneshot, Mutex};
use tokio::time::{sleep, timeout};
use url::Url;
use uuid::Uuid;

const MAX_LOG_LINES: usize = 2_000;
const SERVICE_STATUS_EVENT: &str = "service://status-changed";
const SERVICE_LOG_EVENT: &str = "service://log";
const PROCESS_EXITED_EVENT: &str = "service://process-exited";

struct RuntimeEntry {
    service: RuntimeService,
    logs: VecDeque<LogLine>,
    stop_tx: Option<oneshot::Sender<()>>,
}

struct RuntimeData {
    entries: HashMap<String, RuntimeEntry>,
}

#[derive(Clone)]
pub struct ProcessManager {
    data: Arc<Mutex<RuntimeData>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            data: Arc::new(Mutex::new(RuntimeData {
                entries: HashMap::new(),
            })),
        }
    }

    pub async fn list(&self) -> Vec<RuntimeService> {
        self.data
            .lock()
            .await
            .entries
            .values()
            .map(|entry| entry.service.clone())
            .collect()
    }

    pub async fn get(&self, project_id: &str) -> RuntimeService {
        self.data
            .lock()
            .await
            .entries
            .get(project_id)
            .map(|entry| entry.service.clone())
            .unwrap_or_else(|| idle_service(project_id))
    }

    pub async fn logs(&self, project_id: &str) -> Vec<LogLine> {
        self.data
            .lock()
            .await
            .entries
            .get(project_id)
            .map(|entry| entry.logs.iter().cloned().collect())
            .unwrap_or_default()
    }

    pub async fn start(&self, app: AppHandle, project: Project) -> Result<RuntimeService, String> {
        {
            let data = self.data.lock().await;
            if let Some(entry) = data.entries.get(&project.id) {
                if matches!(
                    entry.service.status,
                    RuntimeStatus::Starting | RuntimeStatus::Running | RuntimeStatus::Stopping
                ) {
                    return Err("SERVICE_ALREADY_RUNNING".into());
                }
            }
        }

        let working_directory = project
            .working_directory
            .clone()
            .unwrap_or_else(|| project.root_path.clone());
        let mut command = build_command(&project.start_command, &working_directory)?;
        let mut child = command
            .spawn()
            .map_err(|_| "COMMAND_START_FAILED".to_string())?;
        let pid = child.id();
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let (stop_tx, stop_rx) = oneshot::channel();
        let service = RuntimeService {
            project_id: project.id.clone(),
            status: RuntimeStatus::Starting,
            pid,
            detected_url: None,
            started_at: Some(timestamp()),
            exit_code: None,
            error: None,
        };
        {
            let mut data = self.data.lock().await;
            data.entries.insert(
                project.id.clone(),
                RuntimeEntry {
                    service: service.clone(),
                    logs: VecDeque::new(),
                    stop_tx: Some(stop_tx),
                },
            );
        }
        emit_status(&app, &service);

        let manager = self.clone();
        let monitor_app = app.clone();
        let monitor_project_id = project.id.clone();
        tokio::spawn(async move {
            monitor_process(
                monitor_app,
                manager,
                monitor_project_id,
                child,
                stdout,
                stderr,
                stop_rx,
            )
            .await;
        });

        let manager = self.clone();
        let probe_app = app.clone();
        tokio::spawn(async move {
            if wait_until_ready(&project.url, Duration::from_secs(30)).await {
                manager
                    .set_running(&probe_app, &project.id, project.url)
                    .await;
            } else {
                manager
                    .fail_and_stop(&probe_app, &project.id, "PORT_PROBE_TIMEOUT")
                    .await;
            }
        });
        Ok(service)
    }

    pub async fn stop(&self, app: &AppHandle, project_id: &str) -> Result<(), String> {
        let stop_tx = {
            let mut data = self.data.lock().await;
            let entry = data
                .entries
                .get_mut(project_id)
                .ok_or_else(|| "SERVICE_NOT_RUNNING".to_string())?;
            if !matches!(
                entry.service.status,
                RuntimeStatus::Starting | RuntimeStatus::Running
            ) {
                return Err("SERVICE_NOT_RUNNING".into());
            }
            entry.service.status = RuntimeStatus::Stopping;
            let snapshot = entry.service.clone();
            emit_status(app, &snapshot);
            entry
                .stop_tx
                .take()
                .ok_or_else(|| "PROCESS_STOP_FAILED".to_string())?
        };
        stop_tx
            .send(())
            .map_err(|_| "PROCESS_STOP_FAILED".to_string())
    }

    pub async fn restart(
        &self,
        app: AppHandle,
        project: Project,
    ) -> Result<RuntimeService, String> {
        if self.get(&project.id).await.status != RuntimeStatus::Idle
            && self.get(&project.id).await.status != RuntimeStatus::Stopped
            && self.get(&project.id).await.status != RuntimeStatus::Failed
        {
            let _ = self.stop(&app, &project.id).await;
            sleep(Duration::from_millis(150)).await;
        }
        self.start(app, project).await
    }

    pub async fn shutdown(&self) {
        let mut data = self.data.lock().await;
        for entry in data.entries.values_mut() {
            if let Some(stop_tx) = entry.stop_tx.take() {
                let _ = stop_tx.send(());
            }
        }
    }

    async fn set_running(&self, app: &AppHandle, project_id: &str, url: String) {
        let mut data = self.data.lock().await;
        if let Some(entry) = data.entries.get_mut(project_id) {
            if entry.service.status == RuntimeStatus::Starting {
                entry.service.status = RuntimeStatus::Running;
                entry.service.detected_url = Some(url);
                emit_status(app, &entry.service);
            }
        }
    }

    async fn fail_and_stop(&self, app: &AppHandle, project_id: &str, error: &str) {
        let stop_tx = {
            let mut data = self.data.lock().await;
            let Some(entry) = data.entries.get_mut(project_id) else {
                return;
            };
            if entry.service.status != RuntimeStatus::Starting {
                return;
            }
            entry.service.status = RuntimeStatus::Failed;
            entry.service.error = Some(error.to_string());
            let snapshot = entry.service.clone();
            emit_status(app, &snapshot);
            entry.stop_tx.take()
        };
        if let Some(stop_tx) = stop_tx {
            let _ = stop_tx.send(());
        }
    }
}

async fn monitor_process(
    app: AppHandle,
    manager: ProcessManager,
    project_id: String,
    mut child: Child,
    stdout: Option<ChildStdout>,
    stderr: Option<ChildStderr>,
    mut stop_rx: oneshot::Receiver<()>,
) {
    if let Some(stdout) = stdout {
        spawn_log_reader(
            app.clone(),
            manager.clone(),
            project_id.clone(),
            "stdout",
            stdout,
        );
    }
    if let Some(stderr) = stderr {
        spawn_log_reader(
            app.clone(),
            manager.clone(),
            project_id.clone(),
            "stderr",
            stderr,
        );
    }
    let (exit_code, stopped) = tokio::select! {
        result = child.wait() => (result.ok().and_then(|status| status.code()), false),
        _ = &mut stop_rx => {
            terminate_process_tree(child.id(), &mut child).await;
            (child.wait().await.ok().and_then(|status| status.code()), true)
        }
    };
    let mut data = manager.data.lock().await;
    if let Some(entry) = data.entries.get_mut(&project_id) {
        entry.stop_tx = None;
        entry.service.pid = None;
        entry.service.exit_code = exit_code;
        entry.service.status = if stopped || exit_code == Some(0) {
            RuntimeStatus::Stopped
        } else {
            RuntimeStatus::Failed
        };
        if entry.service.status == RuntimeStatus::Failed && entry.service.error.is_none() {
            entry.service.error = Some("PROCESS_EXITED".to_string());
        }
        emit_status(&app, &entry.service);
        let _ = app.emit(PROCESS_EXITED_EVENT, &entry.service);
    }
}

fn spawn_log_reader<R: AsyncRead + Unpin + Send + 'static>(
    app: AppHandle,
    manager: ProcessManager,
    project_id: String,
    stream: &'static str,
    reader: R,
) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(reader).lines();
        while let Ok(Some(text)) = lines.next_line().await {
            let line = LogLine {
                id: format!("log_{}", Uuid::new_v4().simple()),
                project_id: project_id.clone(),
                stream: stream.to_string(),
                level: if stream == "stderr" {
                    "error".into()
                } else {
                    "info".into()
                },
                text: redact_log_text(&text),
                timestamp: timestamp(),
            };
            let mut data = manager.data.lock().await;
            if let Some(entry) = data.entries.get_mut(&project_id) {
                entry.logs.push_back(line.clone());
                while entry.logs.len() > MAX_LOG_LINES {
                    entry.logs.pop_front();
                }
            }
            let _ = app.emit(SERVICE_LOG_EVENT, &line);
        }
    });
}

fn build_command(command_text: &str, working_directory: &str) -> Result<Command, String> {
    if command_text.trim().is_empty() {
        return Err("COMMAND_EMPTY".into());
    }
    #[cfg(windows)]
    {
        let mut command = Command::new("cmd.exe");
        command
            .args(["/D", "/C", command_text])
            .current_dir(working_directory)
            .creation_flags(0x00000200)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        Ok(command)
    }
    #[cfg(not(windows))]
    {
        let mut command = Command::new("sh");
        command
            .args(["-lc", command_text])
            .current_dir(working_directory)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        Ok(command)
    }
}

async fn terminate_process_tree(pid: Option<u32>, child: &mut Child) {
    #[cfg(windows)]
    if let Some(pid) = pid {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .status()
            .await;
    }
    let _ = child.kill().await;
}

async fn wait_until_ready(url: &str, max_wait: Duration) -> bool {
    let Ok(parsed) = Url::parse(url) else {
        return false;
    };
    let Some(host) = parsed.host_str() else {
        return false;
    };
    let Some(port) = parsed.port_or_known_default() else {
        return false;
    };
    timeout(max_wait, async {
        loop {
            if TcpStream::connect((host, port)).await.is_ok() {
                return true;
            }
            sleep(Duration::from_millis(250)).await;
        }
    })
    .await
    .unwrap_or(false)
}

fn idle_service(project_id: &str) -> RuntimeService {
    RuntimeService {
        project_id: project_id.to_string(),
        status: RuntimeStatus::Idle,
        pid: None,
        detected_url: None,
        started_at: None,
        exit_code: None,
        error: None,
    }
}

fn emit_status(app: &AppHandle, service: &RuntimeService) {
    let _ = app.emit(SERVICE_STATUS_EVENT, service);
}

fn timestamp() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}.{:03}", duration.as_secs(), duration.subsec_millis())
}

fn redact_log_text(text: &str) -> String {
    let sensitive_keys = [
        "token",
        "access_token",
        "refresh_token",
        "password",
        "secret",
        "api_key",
        "apikey",
        "authorization",
        "cookie",
    ];
    let mut bearer_next = false;
    text.split_whitespace()
        .map(|word| {
            let lower = word.to_lowercase();
            if bearer_next {
                bearer_next = false;
                return "[REDACTED]".to_string();
            }
            if lower == "bearer" {
                bearer_next = true;
                return word.to_string();
            }
            for key in sensitive_keys {
                for separator in ["=", ":"] {
                    let prefix = format!("{key}{separator}");
                    if lower.starts_with(&prefix) {
                        return format!("{}[REDACTED]", &word[..prefix.len()]);
                    }
                }
            }
            word.to_string()
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::{redact_log_text, wait_until_ready};
    use std::time::Duration;
    use tokio::net::TcpListener;

    #[tokio::test]
    async fn readiness_probe_detects_listening_port() {
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind test port");
        let port = listener.local_addr().expect("local address").port();
        assert!(
            wait_until_ready(&format!("http://127.0.0.1:{port}"), Duration::from_secs(1)).await
        );
    }

    #[tokio::test]
    async fn readiness_probe_rejects_invalid_url() {
        assert!(!wait_until_ready("not-a-url", Duration::from_millis(10)).await);
    }

    #[test]
    fn redacts_sensitive_log_values() {
        let line = "token=abc123 Authorization: Bearer xyz cookie=session-id";
        let redacted = redact_log_text(line);
        assert!(!redacted.contains("abc123"));
        assert!(!redacted.contains("xyz"));
        assert!(!redacted.contains("session-id"));
        assert!(redacted.matches("[REDACTED]").count() >= 3);
    }
}
