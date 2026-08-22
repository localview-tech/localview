import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AppInfo,
  LogLine,
  PortCandidate,
  Project,
  ProjectDetection,
  ProjectInput,
  RuntimeService,
} from "../types";

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("get_app_info");
}

export function listProjects(): Promise<Project[]> {
  return invoke<Project[]>("list_projects");
}

export function createProject(input: ProjectInput): Promise<Project> {
  return invoke<Project>("create_project", { input });
}

export function updateProject(projectId: string, input: ProjectInput): Promise<Project> {
  return invoke<Project>("update_project", { projectId, input });
}

export function deleteProject(projectId: string): Promise<void> {
  return invoke<void>("delete_project", { projectId });
}

export function markProjectOpened(projectId: string): Promise<Project> {
  return invoke<Project>("mark_project_opened", { projectId });
}

export function startProject(projectId: string): Promise<RuntimeService> {
  return invoke<RuntimeService>("start_project", { projectId });
}

export function stopProject(projectId: string): Promise<RuntimeService> {
  return invoke<RuntimeService>("stop_project", { projectId });
}

export function restartProject(projectId: string): Promise<RuntimeService> {
  return invoke<RuntimeService>("restart_project", { projectId });
}

export function getRuntimeStatus(projectId: string): Promise<RuntimeService> {
  return invoke<RuntimeService>("get_runtime_status", { projectId });
}

export function getRecentLogs(projectId: string): Promise<LogLine[]> {
  return invoke<LogLine[]>("get_recent_logs", { projectId });
}

export function scanLocalPorts(
  startPort = 3000,
  endPort = 3099,
  timeoutMs = 180,
): Promise<PortCandidate[]> {
  return invoke<PortCandidate[]>("scan_local_ports", { startPort, endPort, timeoutMs });
}

export function detectProject(rootPath: string): Promise<ProjectDetection> {
  return invoke<ProjectDetection>("detect_project", { rootPath });
}

export async function pickDirectory(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false, title: "选择项目目录" });
  return typeof selected === "string" ? selected : null;
}
