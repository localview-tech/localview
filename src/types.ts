export type AppInfo = {
  name: string;
  version: string;
  environment: "development" | "production";
  configPath: string;
};

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "custom";

export type Project = {
  id: string;
  name: string;
  rootPath: string;
  workingDirectory: string | null;
  startCommand: string;
  packageManager: PackageManager | null;
  url: string;
  port: number | null;
  autoStart: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
};

export type ProjectInput = Omit<Project, "id" | "createdAt" | "updatedAt" | "lastOpenedAt">;

export type RuntimeStatus = "idle" | "starting" | "running" | "stopping" | "stopped" | "failed";

export type RuntimeService = {
  projectId: string;
  status: RuntimeStatus;
  pid: number | null;
  detectedUrl: string | null;
  startedAt: string | null;
  exitCode: number | null;
  error: string | null;
};

export type LogLine = {
  id: string;
  projectId: string;
  stream: "stdout" | "stderr" | "system";
  level: "info" | "warn" | "error";
  text: string;
  timestamp: string;
};
