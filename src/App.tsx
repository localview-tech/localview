import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { listen } from "@tauri-apps/api/event";
import {
  createProject,
  deleteProject,
  getAppInfo,
  getRecentLogs,
  getRuntimeStatus,
  detectProject,
  listProjects,
  markProjectOpened,
  pickDirectory,
  restartProject,
  startProject,
  stopProject,
  scanLocalPorts,
  updateProject,
} from "./lib/tauri";
import { TranslationKey, useI18n } from "./i18n";
import type {
  AppInfo,
  LogLine,
  PackageManager,
  Project,
  ProjectInput,
  ProjectDetection,
  PortCandidate,
  RuntimeService,
  RuntimeStatus,
} from "./types";
import "./styles.css";

const emptyForm: ProjectInput = {
  name: "",
  rootPath: "",
  workingDirectory: null,
  startCommand: "npm run dev",
  packageManager: "npm",
  url: "http://localhost:5173",
  port: 5173,
  autoStart: false,
  services: [],
};
const packageKeys: Record<
  PackageManager,
  "package.npm" | "package.pnpm" | "package.yarn" | "package.bun" | "package.custom"
> = {
  npm: "package.npm",
  pnpm: "package.pnpm",
  yarn: "package.yarn",
  bun: "package.bun",
  custom: "package.custom",
};

const runtimeStatusKeys: Record<RuntimeStatus, TranslationKey> = {
  idle: "service.idle",
  starting: "service.starting",
  running: "service.running",
  stopping: "service.stopping",
  stopped: "service.stopped",
  failed: "service.failed",
};

type PreviewPhase = "not-started" | "waiting" | "loading" | "loaded" | "stopped" | "failed";

function isLocalhostUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function projectToForm(project: Project): ProjectInput {
  return {
    name: project.name,
    rootPath: project.rootPath,
    workingDirectory: project.workingDirectory,
    startCommand: project.startCommand,
    packageManager: project.packageManager,
    url: project.url,
    port: project.port,
    autoStart: project.autoStart,
    services: project.services,
  };
}

function errorMessage(
  reason: unknown,
  translate: (key: TranslationKey, params?: Record<string, string | number>) => string,
): string {
  const raw = reason instanceof Error ? reason.message : String(reason);
  const key = (
    {
      STORE_LOCK: "errors.STORE_LOCK",
      NOT_FOUND: "errors.NOT_FOUND",
      EMPTY_NAME: "errors.EMPTY_NAME",
      INVALID_ROOT_PATH: "errors.INVALID_ROOT_PATH",
      INVALID_WORKING_DIRECTORY: "errors.INVALID_WORKING_DIRECTORY",
      EMPTY_COMMAND: "errors.EMPTY_COMMAND",
      INVALID_URL: "errors.INVALID_URL",
      PORT_MISMATCH: "errors.PORT_MISMATCH",
      CONFIG_READ: "errors.CONFIG_READ",
      CONFIG_PARSE: "errors.CONFIG_PARSE",
      SERVICE_ALREADY_RUNNING: "errors.SERVICE_ALREADY_RUNNING",
      SERVICE_NOT_RUNNING: "errors.SERVICE_NOT_RUNNING",
      COMMAND_START_FAILED: "errors.COMMAND_START_FAILED",
      PORT_PROBE_TIMEOUT: "errors.PORT_PROBE_TIMEOUT",
      PROCESS_EXITED: "errors.PROCESS_EXITED",
      PROCESS_STOP_FAILED: "errors.PROCESS_STOP_FAILED",
      SERVICE_RUNNING: "errors.SERVICE_RUNNING",
      INVALID_PREVIEW_URL: "errors.INVALID_PREVIEW_URL",
      PORT_SCAN_RANGE_INVALID: "errors.PORT_SCAN_RANGE_INVALID",
      DETECTION_FAILED: "errors.DETECTION_FAILED",
    } as Partial<Record<string, TranslationKey>>
  )[raw];
  return key ? translate(key) : translate("errors.generic", { message: raw });
}

function App() {
  const { language, setLanguage, t } = useI18n();
  const [projects, setProjects] = useState<Project[]>([]);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<ProjectInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtime, setRuntime] = useState<RuntimeService | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewInput, setPreviewInput] = useState("");
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>("not-started");
  const [previewHistory, setPreviewHistory] = useState<string[]>([]);
  const [previewHistoryIndex, setPreviewHistoryIndex] = useState(0);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [viewport, setViewport] = useState<"responsive" | "desktop" | "tablet" | "mobile">(
    "responsive",
  );
  const [portCandidates, setPortCandidates] = useState<PortCandidate[]>([]);
  const [scanningPorts, setScanningPorts] = useState(false);
  const [detection, setDetection] = useState<ProjectDetection | null>(null);
  const [detectingProject, setDetectingProject] = useState(false);

  const selectedProject = projects.find((project) => project.id === selectedId) ?? null;
  const selectedProjectUrl = selectedProject?.url;
  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...projects]
      .filter(
        (project) =>
          !normalized ||
          `${project.name} ${project.rootPath} ${project.url}`.toLowerCase().includes(normalized),
      )
      .sort((a, b) => (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt));
  }, [projects, query]);

  useEffect(() => {
    Promise.all([getAppInfo(), listProjects()])
      .then(([info, storedProjects]) => {
        setAppInfo(info);
        setProjects(storedProjects);
        setSelectedId(storedProjects[0]?.id ?? null);
      })
      .catch((reason: unknown) =>
        setError(t("errors.loadFailed", { message: errorMessage(reason, t) })),
      );
  }, [t]);

  useEffect(() => {
    if (!selectedId) {
      setRuntime(null);
      setLogs([]);
      return;
    }
    Promise.all([getRuntimeStatus(selectedId), getRecentLogs(selectedId)])
      .then(([status, recentLogs]) => {
        setRuntime(status);
        setLogs(recentLogs);
      })
      .catch(() => undefined);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedProjectUrl) return;
    setPreviewUrl(selectedProjectUrl);
    setPreviewInput(selectedProjectUrl);
    setPreviewHistory([selectedProjectUrl]);
    setPreviewHistoryIndex(0);
    setPreviewPhase("not-started");
  }, [selectedId, selectedProjectUrl]);

  useEffect(() => {
    if (runtime?.status === "starting") setPreviewPhase("waiting");
    if (runtime?.status === "running" && previewPhase !== "loaded" && previewPhase !== "loading") {
      setPreviewPhase("loading");
    }
    if (runtime?.status === "stopped") setPreviewPhase("stopped");
    if (runtime?.status === "failed") setPreviewPhase("failed");
  }, [runtime?.status, previewPhase]);

  useEffect(() => {
    let active = true;
    let unlisteners: Array<() => void> = [];
    void Promise.all([
      listen<RuntimeService>("service://status-changed", (event) => {
        if (active && event.payload.projectId === selectedId) setRuntime(event.payload);
      }),
      listen<LogLine>("service://log", (event) => {
        if (active && event.payload.projectId === selectedId)
          setLogs((current) => [...current.slice(-1999), event.payload]);
      }),
      listen<RuntimeService>("service://process-exited", (event) => {
        if (active && event.payload.projectId === selectedId) setRuntime(event.payload);
      }),
    ])
      .then((cleanup) => {
        if (active) unlisteners = cleanup;
        else cleanup.forEach((unlisten) => unlisten());
      })
      .catch(() => undefined);
    return () => {
      active = false;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [selectedId]);

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }
  function openEditForm(project: Project) {
    setEditingId(project.id);
    setForm(projectToForm(project));
    setError(null);
    setShowForm(true);
  }

  async function handlePickDirectory() {
    try {
      const path = await pickDirectory();
      if (path) {
        setForm((current) => ({ ...current, rootPath: path, workingDirectory: path }));
        void handleDetectProject(path);
      }
    } catch (reason: unknown) {
      setError(errorMessage(reason, t));
    }
  }

  async function handleDetectProject(rootPath = form.rootPath) {
    if (!rootPath) return;
    setDetectingProject(true);
    try {
      const result = await detectProject(rootPath);
      setDetection(result);
      setForm((current) => ({
        ...current,
        name: current.name || result.name || "",
        packageManager: (result.packageManager as PackageManager | null) ?? current.packageManager,
        port: current.port ?? result.suggestedPort,
        url:
          current.port || !result.suggestedPort
            ? current.url
            : `http://localhost:${result.suggestedPort}`,
        startCommand:
          current.startCommand === emptyForm.startCommand && result.scripts[0]
            ? `${result.packageManager ?? "npm"} run ${result.scripts[0].name}`
            : current.startCommand,
      }));
    } catch {
      setError(errorMessage("DETECTION_FAILED", t));
    } finally {
      setDetectingProject(false);
    }
  }

  async function handleScanPorts() {
    setScanningPorts(true);
    try {
      setPortCandidates(await scanLocalPorts());
    } catch (reason: unknown) {
      setError(errorMessage(reason, t));
    } finally {
      setScanningPorts(false);
    }
  }

  function applyPortCandidate(candidate: PortCandidate) {
    navigatePreview(candidate.url);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const project = editingId ? await updateProject(editingId, form) : await createProject(form);
      setProjects((current) =>
        editingId
          ? current.map((item) => (item.id === project.id ? project : item))
          : [...current, project],
      );
      setSelectedId(project.id);
      setShowForm(false);
    } catch (reason: unknown) {
      setError(errorMessage(reason, t));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(project: Project) {
    if (!window.confirm(t("project.deleteConfirm", { name: project.name }))) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProject(project.id);
      const remaining = projects.filter((item) => item.id !== project.id);
      setProjects(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setShowForm(false);
    } catch (reason: unknown) {
      setError(errorMessage(reason, t));
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen(project: Project) {
    try {
      const updated = await markProjectOpened(project.id);
      setProjects((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedId(updated.id);
    } catch (reason: unknown) {
      setError(errorMessage(reason, t));
    }
  }

  async function handleServiceAction(action: "start" | "stop" | "restart") {
    if (!selectedProject) return;
    if (
      action !== "stop" &&
      selectedProject.packageManager === "custom" &&
      !window.confirm(t("service.customCommandWarning"))
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    if (action !== "stop") setPreviewPhase("waiting");
    try {
      const next =
        action === "start"
          ? await startProject(selectedProject.id)
          : action === "stop"
            ? await stopProject(selectedProject.id)
            : await restartProject(selectedProject.id);
      setRuntime(next);
      if (action === "stop") setPreviewPhase("stopped");
    } catch (reason: unknown) {
      setError(errorMessage(reason, t));
    } finally {
      setBusy(false);
    }
  }

  function navigatePreview(nextUrl: string, replace = false) {
    const normalized = nextUrl.trim();
    if (!isLocalhostUrl(normalized)) {
      setError(t("errors.INVALID_PREVIEW_URL"));
      return;
    }
    setError(null);
    setPreviewUrl(normalized);
    setPreviewInput(normalized);
    setPreviewPhase("loading");
    if (replace) {
      setPreviewHistory((current) =>
        current.map((item, index) => (index === previewHistoryIndex ? normalized : item)),
      );
    } else {
      setPreviewHistory((current) => [...current.slice(0, previewHistoryIndex + 1), normalized]);
      setPreviewHistoryIndex((current) => current + 1);
    }
  }

  function handlePreviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigatePreview(previewInput);
  }

  function goPreviewHistory(direction: -1 | 1) {
    const nextIndex = previewHistoryIndex + direction;
    if (nextIndex < 0 || nextIndex >= previewHistory.length) return;
    setPreviewHistoryIndex(nextIndex);
    setPreviewUrl(previewHistory[nextIndex]);
    setPreviewInput(previewHistory[nextIndex]);
    setPreviewPhase("loading");
  }

  function refreshPreview() {
    if (!previewUrl) return;
    setPreviewPhase("loading");
    setPreviewNonce((current) => current + 1);
  }

  function openExternalPreview() {
    if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  const environmentLabel = appInfo
    ? appInfo.environment === "production"
      ? t("environment.production")
      : t("environment.development")
    : t("workspace.connecting");
  const projectCountKey =
    projects.length === 1 ? "workspace.projectCount.one" : "workspace.projectCount.other";
  const toggleLanguage = () => setLanguage(language === "zh-CN" ? "en-US" : "zh-CN");

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">LV</span>
          <span>LocalView</span>
        </div>
        <div className="sidebar-label">{t("workspace.label")}</div>
        <div className="search-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label={t("workspace.search")}
            placeholder={t("workspace.search")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="project-list">
          {filteredProjects.map((project) => (
            <button
              className={`project-item ${project.id === selectedId ? "active" : ""}`}
              key={project.id}
              type="button"
              onClick={() => void handleOpen(project)}
            >
              <span className="status-dot" />
              <span className="project-name">{project.name}</span>
              <span className="project-port">{project.port ?? "—"}</span>
            </button>
          ))}
        </div>
        <button className="add-project" type="button" onClick={openCreateForm}>
          + {t("workspace.add")} <span>{t("workspace.shortcut")}</span>
        </button>
        <div className="sidebar-footer">
          {projects.length} {t(projectCountKey)} · {t("workspace.localhost")}
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t("workspace.localDevelopment")}</p>
            <h1>{selectedProject?.name ?? t("workspace.yourWorkspace")}</h1>
          </div>
          <div className="topbar-tools">
            <button
              className="language-button"
              type="button"
              onClick={toggleLanguage}
              aria-label={
                language === "zh-CN" ? t("language.switchToEnglish") : t("language.switchToChinese")
              }
            >
              {language === "zh-CN" ? t("language.english") : t("language.chinese")}
            </button>
            <div className="runtime-badge">
              <span className="status-dot" />
              {environmentLabel}
            </div>
          </div>
        </header>
        {error ? <div className="notice error-notice">{error}</div> : null}
        {selectedProject ? (
          <>
            <section className="project-hero" key={selectedProject.id}>
              <div>
                <p className="eyebrow">{t("project.configuration")}</p>
                <h2>{selectedProject.url}</h2>
                <p className="path-line">{selectedProject.rootPath}</p>
              </div>
              <div className="hero-actions">
                <div className={`service-pill status-${runtime?.status ?? "idle"}`}>
                  <span className="status-dot" />
                  {t(runtimeStatusKeys[runtime?.status ?? "idle"])}
                </div>
                <button
                  className="button quiet"
                  type="button"
                  onClick={() => openEditForm(selectedProject)}
                >
                  {t("project.edit")}
                </button>
                {runtime?.status === "running" || runtime?.status === "starting" ? (
                  <button
                    className="button quiet"
                    type="button"
                    disabled={busy}
                    onClick={() => void handleServiceAction("stop")}
                  >
                    {t("service.stop")}
                  </button>
                ) : (
                  <button
                    className="button primary"
                    type="button"
                    disabled={busy}
                    onClick={() => void handleServiceAction("start")}
                  >
                    {t("service.start")}
                  </button>
                )}
                <button
                  className="button quiet"
                  type="button"
                  disabled={busy || runtime?.status === "stopping"}
                  onClick={() => void handleServiceAction("restart")}
                >
                  {t("service.restart")}
                </button>
              </div>
            </section>
            <section className="preview-card">
              <div className="preview-toolbar">
                <div className="preview-toolbar-title">
                  <span className="preview-live-dot" />
                  <p className="eyebrow">{t("preview.label")}</p>
                </div>
                <div className="preview-toolbar-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t("preview.back")}
                    title={t("preview.back")}
                    disabled={previewHistoryIndex === 0}
                    onClick={() => goPreviewHistory(-1)}
                  >
                    ←
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t("preview.forward")}
                    title={t("preview.forward")}
                    disabled={previewHistoryIndex >= previewHistory.length - 1}
                    onClick={() => goPreviewHistory(1)}
                  >
                    →
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={t("preview.refresh")}
                    title={t("preview.refresh")}
                    disabled={runtime?.status !== "running"}
                    onClick={refreshPreview}
                  >
                    ↻
                  </button>
                  <div className="viewport-switcher" aria-label={t("preview.viewport")}>
                    {(["responsive", "desktop", "tablet", "mobile"] as const).map((option) => (
                      <button
                        className={viewport === option ? "active" : ""}
                        key={option}
                        type="button"
                        onClick={() => setViewport(option)}
                        title={t(`preview.${option}` as TranslationKey)}
                      >
                        {option === "responsive"
                          ? "↔"
                          : option === "desktop"
                            ? "▣"
                            : option === "tablet"
                              ? "▤"
                              : "▥"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <form className="preview-address" onSubmit={handlePreviewSubmit}>
                <span className="address-lock" aria-hidden="true">
                  ⌁
                </span>
                <input
                  aria-label={t("preview.addressPlaceholder")}
                  value={previewInput}
                  placeholder={t("preview.addressPlaceholder")}
                  onChange={(event) => setPreviewInput(event.target.value)}
                />
                <button className="address-open" type="button" onClick={openExternalPreview}>
                  {t("preview.openExternal")}
                </button>
              </form>
              <div className="preview-stage">
                {previewPhase === "loading" || previewPhase === "loaded" ? (
                  <>
                    <iframe
                      key={`${previewUrl}-${previewNonce}`}
                      className={`preview-frame viewport-${viewport}`}
                      title={`${selectedProject.name} preview`}
                      src={previewUrl}
                      onLoad={() => setPreviewPhase("loaded")}
                      onError={() => setPreviewPhase("failed")}
                    />
                    {previewPhase === "loading" ? (
                      <div className="preview-loading">
                        <span />
                        {t("preview.loading")}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className={`preview-state ${previewPhase}`}>
                    <div className="preview-state-mark">
                      {previewPhase === "failed" ? "!" : previewPhase === "waiting" ? "…" : "◌"}
                    </div>
                    <h3>
                      {previewPhase === "waiting"
                        ? t("preview.waiting")
                        : previewPhase === "stopped"
                          ? t("preview.stopped")
                          : previewPhase === "failed"
                            ? t("preview.failed")
                            : t("preview.notStarted")}
                    </h3>
                    <p>
                      {previewPhase === "waiting"
                        ? t("preview.waitingDescription", { port: selectedProject.port ?? "—" })
                        : previewPhase === "stopped"
                          ? t("preview.stoppedDescription")
                          : previewPhase === "failed"
                            ? t("preview.failedDescription")
                            : t("preview.notStartedDescription")}
                    </p>
                    {previewPhase === "failed" ||
                    previewPhase === "stopped" ||
                    previewPhase === "not-started" ? (
                      <button
                        className="button primary"
                        type="button"
                        onClick={() => void handleServiceAction("start")}
                      >
                        {t("service.start")}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </section>
            <section className="details-grid">
              <div className="detail-card">
                <span className="eyebrow">{t("project.startCommand")}</span>
                <strong>{selectedProject.startCommand}</strong>
                <span className="detail-caption">
                  {selectedProject.packageManager
                    ? t(packageKeys[selectedProject.packageManager])
                    : t("project.custom")}
                </span>
              </div>
              <div className="detail-card">
                <span className="eyebrow">{t("project.port")}</span>
                <strong>{selectedProject.port ?? t("project.autoPort")}</strong>
                <span className="detail-caption">{t("project.autoReady")}</span>
              </div>
              <div className="detail-card">
                <span className="eyebrow">{t("service.logs")}</span>
                <strong>{logs.length}</strong>
                <span className="detail-caption">
                  {runtime?.pid ? `${t("service.pid")} ${runtime.pid}` : t("service.waitingPort")}
                </span>
              </div>
            </section>
            <section className="tools-grid">
              <div className="tool-card">
                <div className="tool-card-heading">
                  <div>
                    <p className="eyebrow">{t("discovery.label")}</p>
                    <h3>{t("discovery.scan")}</h3>
                  </div>
                  <button
                    className="button quiet"
                    type="button"
                    disabled={scanningPorts}
                    onClick={() => void handleScanPorts()}
                  >
                    {scanningPorts ? t("discovery.scanning") : t("discovery.scan")}
                  </button>
                </div>
                {portCandidates.length ? (
                  <div className="candidate-list">
                    {portCandidates.map((candidate) => (
                      <div className="candidate-row" key={candidate.port}>
                        <div>
                          <strong>{candidate.url}</strong>
                          <span>{candidate.server ?? (candidate.hmr ? "HMR" : "localhost")}</span>
                        </div>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => applyPortCandidate(candidate)}
                        >
                          {t("discovery.use")}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">{t("discovery.empty")}</p>
                )}
              </div>
              <div className="tool-card">
                <div className="tool-card-heading">
                  <div>
                    <p className="eyebrow">{t("detection.label")}</p>
                    <h3>{detection?.framework ?? t("detection.none")}</h3>
                  </div>
                  <button
                    className="button quiet"
                    type="button"
                    disabled={detectingProject || !selectedProject.rootPath}
                    onClick={() => void handleDetectProject(selectedProject.rootPath)}
                  >
                    {detectingProject ? t("detection.detecting") : t("detection.detect")}
                  </button>
                </div>
                {detection ? (
                  <div className="detection-meta">
                    <span>
                      {t("workspace.services")}: {selectedProject.services.length}
                    </span>
                    <span>
                      {t("detection.manager")}: {detection.packageManager ?? "—"}
                    </span>
                    <span>
                      {t("detection.framework")}: {detection.framework ?? "—"}
                    </span>
                    <span>
                      {t("detection.scripts")}:{" "}
                      {detection.scripts.map((script) => script.name).join(", ") || "—"}
                    </span>
                  </div>
                ) : (
                  <p className="muted">{t("detection.none")}</p>
                )}
              </div>
            </section>
            <section className={`logs-card ${logsOpen ? "open" : ""}`}>
              <div className="logs-heading">
                <div>
                  <p className="eyebrow">{t("service.logs")}</p>
                  <h3>
                    {runtime?.status === "starting"
                      ? t("service.waitingPort")
                      : runtime?.detectedUrl
                        ? t("service.readyAt")
                        : t("service.logs")}
                  </h3>
                </div>
                <button
                  className="button quiet"
                  type="button"
                  onClick={() => setLogsOpen((current) => !current)}
                >
                  {logsOpen ? "⌃" : "⌄"}
                </button>
              </div>
              {logsOpen ? (
                <div className="log-stream" role="log" aria-live="polite">
                  {logs.length ? (
                    logs.map((line) => (
                      <div className={`log-line ${line.level}`} key={line.id}>
                        <time>{line.timestamp.split(".")[1] ?? ""}</time>
                        <span className="log-stream-name">{line.stream}</span>
                        <code>{line.text}</code>
                      </div>
                    ))
                  ) : (
                    <p className="muted">{t("service.noLogs")}</p>
                  )}
                </div>
              ) : null}
            </section>
            <section className="next-card">
              <div>
                <p className="eyebrow">{t("project.nextStep")}</p>
                <h3>{t("project.ready")}</h3>
                <p className="muted">{t("project.m3Description")}</p>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={() => void handleDelete(selectedProject)}
              >
                {t("project.deleteConfiguration")}
              </button>
            </section>
          </>
        ) : (
          <section className="empty-state">
            <div className="empty-orbit">LV</div>
            <p className="eyebrow">{t("workspace.emptyTitle")}</p>
            <h2>{t("workspace.emptyHeading")}</h2>
            <p className="muted">{t("workspace.emptyDescription")}</p>
            <button className="button primary" type="button" onClick={openCreateForm}>
              {t("workspace.addFirst")}
            </button>
          </section>
        )}
        <footer className="app-footer">
          {appInfo
            ? `${appInfo.name} ${appInfo.version} · ${t("workspace.configStored")}`
            : t("workspace.loading")}
        </footer>
      </section>

      {showForm ? (
        <ProjectForm
          form={form}
          editing={Boolean(editingId)}
          busy={busy}
          onChange={setForm}
          onClose={() => setShowForm(false)}
          onPickDirectory={() => void handlePickDirectory()}
          onSubmit={handleSubmit}
          onDelete={
            editingId
              ? () => {
                  const project = projects.find((item) => item.id === editingId);
                  if (project) void handleDelete(project);
                }
              : undefined
          }
        />
      ) : null}
    </main>
  );
}

type ProjectFormProps = {
  form: ProjectInput;
  editing: boolean;
  busy: boolean;
  onChange: (form: ProjectInput) => void;
  onClose: () => void;
  onPickDirectory: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete?: () => void;
};

type CustomSelectProps = {
  value: PackageManager;
  onChange: (value: PackageManager) => void;
};

const packageManagerOptions: PackageManager[] = ["npm", "pnpm", "yarn", "bun", "custom"];

function CustomSelect({ value, onChange }: CustomSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(Math.max(0, packageManagerOptions.indexOf(value)));
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = `package-manager-options-${useId().replaceAll(":", "")}`;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  useEffect(() => {
    setHighlighted(Math.max(0, packageManagerOptions.indexOf(value)));
  }, [value]);

  const choose = (next: PackageManager) => {
    onChange(next);
    setOpen(false);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlighted((current) =>
        event.key === "ArrowDown"
          ? (current + 1) % packageManagerOptions.length
          : (current - 1 + packageManagerOptions.length) % packageManagerOptions.length,
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setOpen(true);
      setHighlighted(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setOpen(true);
      setHighlighted(packageManagerOptions.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(packageManagerOptions[highlighted]);
      else setOpen(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={`custom-select ${open ? "open" : ""}`} ref={containerRef}>
      <button
        className="custom-select-trigger"
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span>{t(packageKeys[value])}</span>
        <span className={`custom-select-chevron ${open ? "up" : ""}`} aria-hidden="true">
          ⌄
        </span>
      </button>
      {open ? (
        <div
          className="custom-select-menu"
          id={listId}
          role="listbox"
          aria-label={t("form.packageManager")}
        >
          {packageManagerOptions.map((option, index) => (
            <button
              className={`custom-select-option ${option === value ? "selected" : ""} ${index === highlighted ? "highlighted" : ""}`}
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => choose(option)}
            >
              {t(packageKeys[option])}
              <span className="custom-select-check" aria-hidden="true">
                {option === value ? "✓" : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProjectForm({
  form,
  editing,
  busy,
  onChange,
  onClose,
  onPickDirectory,
  onSubmit,
  onDelete,
}: ProjectFormProps) {
  const { t } = useI18n();
  const set = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) =>
    onChange({ ...form, [key]: value });
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-form-title"
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{t("form.setup")}</p>
            <h3 id="project-form-title">{editing ? t("form.editTitle") : t("form.addTitle")}</h3>
          </div>
          <button
            className="close-button"
            type="button"
            onClick={onClose}
            aria-label={t("form.close")}
          >
            ×
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <label>
            {t("form.projectName")}
            <input
              required
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder={t("form.projectNamePlaceholder")}
            />
          </label>
          <label>
            {t("form.projectDirectory")}
            <div className="input-action">
              <input
                required
                value={form.rootPath}
                onChange={(event) => set("rootPath", event.target.value)}
                placeholder={t("form.directoryPlaceholder")}
              />
              <button className="button quiet" type="button" onClick={onPickDirectory}>
                {t("form.browse")}
              </button>
            </div>
          </label>
          <div className="form-row">
            <label>
              {t("form.packageManager")}
              <CustomSelect
                value={form.packageManager ?? "custom"}
                onChange={(value) => set("packageManager", value)}
              />
            </label>
            <label>
              {t("form.port")}
              <input
                type="number"
                min="1"
                max="65535"
                value={form.port ?? ""}
                onChange={(event) =>
                  set("port", event.target.value ? Number(event.target.value) : null)
                }
              />
            </label>
          </div>
          <label>
            {t("form.startCommand")}
            <input
              required
              value={form.startCommand}
              onChange={(event) => set("startCommand", event.target.value)}
              placeholder={t("form.startCommandPlaceholder")}
            />
          </label>
          <label>
            {t("form.localUrl")}
            <input
              required
              type="url"
              value={form.url}
              onChange={(event) => set("url", event.target.value)}
              placeholder={t("form.localUrlPlaceholder")}
            />
            <span className="field-help">{t("form.localUrlHelp")}</span>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.autoStart}
              onChange={(event) => set("autoStart", event.target.checked)}
            />
            {t("form.autoStart")}
          </label>
          <div className="modal-actions">
            {onDelete ? (
              <button className="text-button danger" type="button" onClick={onDelete}>
                {t("project.delete")}
              </button>
            ) : (
              <span />
            )}
            <div>
              <button className="button quiet" type="button" onClick={onClose}>
                {t("form.cancel")}
              </button>
              <button className="button primary" type="submit" disabled={busy}>
                {busy ? t("form.saving") : editing ? t("form.save") : t("form.add")}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

export default App;
