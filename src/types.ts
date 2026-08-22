export type AppInfo = {
  name: string;
  version: string;
  environment: "development" | "production";
  configPath: string;
};

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun" | "custom";

export type ServiceDefinition = {
  id: string;
  name: string;
  startCommand: string;
  workingDirectory: string | null;
  url: string;
  port: number | null;
  packageManager: string | null;
};

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
  services: ServiceDefinition[];
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

export type PortCandidate = {
  port: number;
  url: string;
  title: string | null;
  server: string | null;
  hmr: boolean;
};

export type ScriptSuggestion = {
  name: string;
  command: string;
  recommended: boolean;
};

export type ProjectDetection = {
  rootPath: string;
  name: string | null;
  packageManager: string | null;
  framework: string | null;
  suggestedPort: number | null;
  scripts: ScriptSuggestion[];
};
