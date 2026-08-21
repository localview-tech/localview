mod models;
mod process_manager;
mod project_store;

use models::{AppInfo, LogLine, Project, ProjectInput, RuntimeService};
use process_manager::ProcessManager;
use project_store::ProjectStore;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

struct AppState {
    project_store: Mutex<ProjectStore>,
    process_manager: ProcessManager,
}

#[tauri::command]
fn get_app_info(state: State<'_, AppState>) -> Result<AppInfo, String> {
    let store = state
        .project_store
        .lock()
        .map_err(|_| "STORE_LOCK".to_string())?;
    Ok(AppInfo {
        name: "LocalView".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        environment: if cfg!(debug_assertions) {
            "development"
        } else {
            "production"
        }
        .to_string(),
        config_path: store.config_path().to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    state
        .project_store
        .lock()
        .map_err(|_| "STORE_LOCK".to_string())?
        .list()
        .map_err(|error| error.code().to_string())
}

#[tauri::command]
fn create_project(state: State<'_, AppState>, input: ProjectInput) -> Result<Project, String> {
    state
        .project_store
        .lock()
        .map_err(|_| "STORE_LOCK".to_string())?
        .create(input)
        .map_err(|error| error.code().to_string())
}

#[tauri::command]
fn update_project(
    state: State<'_, AppState>,
    project_id: String,
    input: ProjectInput,
) -> Result<Project, String> {
    state
        .project_store
        .lock()
        .map_err(|_| "STORE_LOCK".to_string())?
        .update(&project_id, input)
        .map_err(|error| error.code().to_string())
}

#[tauri::command]
async fn delete_project(state: State<'_, AppState>, project_id: String) -> Result<(), String> {
    let runtime = state.process_manager.get(&project_id).await;
    if matches!(
        runtime.status,
        models::RuntimeStatus::Starting
            | models::RuntimeStatus::Running
            | models::RuntimeStatus::Stopping
    ) {
        return Err("SERVICE_RUNNING".into());
    }
    state
        .project_store
        .lock()
        .map_err(|_| "STORE_LOCK".to_string())?
        .delete(&project_id)
        .map_err(|error| error.code().to_string())
}

#[tauri::command]
fn mark_project_opened(state: State<'_, AppState>, project_id: String) -> Result<Project, String> {
    state
        .project_store
        .lock()
        .map_err(|_| "STORE_LOCK".to_string())?
        .mark_opened(&project_id)
        .map_err(|error| error.code().to_string())
}

fn find_project(state: &State<'_, AppState>, project_id: &str) -> Result<Project, String> {
    state
        .project_store
        .lock()
        .map_err(|_| "STORE_LOCK".to_string())?
        .list()
        .map_err(|error| error.code().to_string())?
        .into_iter()
        .find(|project| project.id == project_id)
        .ok_or_else(|| "NOT_FOUND".to_string())
}

#[tauri::command]
async fn start_project(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
) -> Result<RuntimeService, String> {
    let project = find_project(&state, &project_id)?;
    state.process_manager.start(app, project).await
}

#[tauri::command]
async fn stop_project(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
) -> Result<RuntimeService, String> {
    state.process_manager.stop(&app, &project_id).await?;
    Ok(state.process_manager.get(&project_id).await)
}

#[tauri::command]
async fn restart_project(
    app: AppHandle,
    state: State<'_, AppState>,
    project_id: String,
) -> Result<RuntimeService, String> {
    let project = find_project(&state, &project_id)?;
    state.process_manager.restart(app, project).await
}

#[tauri::command]
async fn get_runtime_status(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<RuntimeService, String> {
    Ok(state.process_manager.get(&project_id).await)
}

#[tauri::command]
async fn list_runtime_statuses(state: State<'_, AppState>) -> Result<Vec<RuntimeService>, String> {
    Ok(state.process_manager.list().await)
}

#[tauri::command]
async fn get_recent_logs(
    state: State<'_, AppState>,
    project_id: String,
) -> Result<Vec<LogLine>, String> {
    Ok(state.process_manager.logs(&project_id).await)
}

fn build_state(app: &AppHandle) -> Result<AppState, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let project_store =
        ProjectStore::new(app_data_dir).map_err(|error| error.code().to_string())?;
    Ok(AppState {
        project_store: Mutex::new(project_store),
        process_manager: ProcessManager::new(),
    })
}

pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = build_state(app.handle())?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_info,
            list_projects,
            create_project,
            update_project,
            delete_project,
            mark_project_opened,
            start_project,
            stop_project,
            restart_project,
            get_runtime_status,
            list_runtime_statuses,
            get_recent_logs
        ])
        .build(tauri::generate_context!())
        .expect("error while building LocalView");
    app.run(|app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            tauri::async_runtime::block_on(
                app_handle.state::<AppState>().process_manager.shutdown(),
            );
        }
    });
}

#[cfg(test)]
mod tests {
    use super::project_store::ProjectStore;
    use tempfile::tempdir;

    #[test]
    fn project_store_can_be_initialized() {
        let directory = tempdir().expect("temp dir");
        let store = ProjectStore::new(directory.path().join("data")).expect("store");
        assert!(store.config_path().ends_with("projects.json"));
    }
}
