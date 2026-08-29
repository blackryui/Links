import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CheckpointService,
  CodexService,
  FileService,
  GitService,
  GoalContinuationService,
  ScheduledContinuationService,
  ProcessService,
  ProjectService,
  ProjectSnapshotService,
  SearchService,
  WorkspaceInfoService,
  JsonWorkspaceIndexStore,
  WorkspaceIndexService,
  WorkspaceQueryService,
  type FileActor,
} from '@lnwjud/application';
import { AuditService } from '@lnwjud/audit';
import {
  BrowserCdpBackend,
  HealthCapabilityBackend,
  LocalCapabilityService,
  NodeBrowserCdpProtocol,
  PowerShellWindowsCapabilityBridge,
  SchedulerCapabilityBackend,
  ShellCapabilityBackend,
  VisionCapabilityBackend,
  WebFetchCapabilityBackend,
  WindowsNativeCapabilityBackend,
  WindowsOcrCapabilityBackend,
  WindowsOcrProcessBridge,
  createOcrPackageIdentityProbe,
  WINDOWS_CAPABILITY_BRIDGE_SHA256,
  WslCapabilityBackend,
  WslFilesystemCapabilityBackend,
} from '@lnwjud/capabilities';
import type { Result } from '@lnwjud/domain';
import { ALLOW_AI_DELETE_SETTING_KEY, DESTRUCTIVE_AUTO_APPROVAL_SETTING_KEY, DEFAULT_CODEX_TOOLS_ENABLED, DEFAULT_MCP_CALL_TIMEOUT_MS, DEFAULT_MCP_IDLE_TIMEOUT_MS, DEFAULT_PROCESS_TIMEOUT_MS, DEFAULT_MCP_POLL_WAIT_SECONDS, DEFAULT_SHELL_SYNCHRONOUS_WAIT_SECONDS, MAX_CONFIGURABLE_WAIT_SECONDS, MIN_CONFIGURABLE_WAIT_SECONDS, USER_SETTING_KEYS, loadCheckpointEncryptionKey, parseBooleanSetting, parseCustomPermissionSettings, parseDestructiveAutoApprovalPolicy, parseIntegerSetting, parsePathList, parseStringRecordSetting, type DestructiveAutoApprovalPolicy } from '@lnwjud/shared';
import {
  EXTENSIONS_SETTINGS_KEY,
  createLocalExtensionsService,
  type ExtensionsService,
} from '@lnwjud/extensions';
import { ActivityTracker, SharedActivitySnapshotLease, composeActivitySinks, createFileActivitySink, currentSharedActivityOwner, mcpActivityLogPath, type ActivitySink, type ActivitySinkEvent, type McpApplicationServices, type WorkspaceScope } from '@lnwjud/mcp-server';
import { permissionProfiles, type PermissionProfile, type PermissionProfileName } from '@lnwjud/permissions';
import {
  AesGcmCheckpointCipher,
  SqliteAuditRepository,
  SqliteCheckpointRepository,
  SqliteDatabase,
  SqliteGoalRepository,
  SqliteSettingsRepository,
  SqliteWorkspaceRepository,
} from '@lnwjud/storage';
import { allFixedDriveRoots, machineRootPath, normalizeWorkspaceRoot, SecretPolicy, WorkspacePathGuard, WorkspaceService, type Workspace } from '@lnwjud/workspace';
import { StrictWorkspaceRepository } from './strict-workspace-repository.js';

export interface StdioMcpRuntime {
  readonly services: McpApplicationServices;
  readonly actor: FileActor;
  readonly extensions: ExtensionsService;
  readonly activityTracker: ActivityTracker;
  readonly activityReady: Promise<void>;
  readonly profileProvider: () => PermissionProfile;
  readonly allowAiDeleteProvider: () => boolean;
  readonly destructivePolicyProvider: () => DestructiveAutoApprovalPolicy;
  readonly activeWorkspaceScopeProvider: () => Promise<WorkspaceScope>;
  readonly activeWorkspaceScopesProvider: () => Promise<readonly WorkspaceScope[]>;
  readonly codexToolsEnabled: boolean;
  close(): Promise<void>;
}

/** Builds stdio/CLI MCP services. Defaults stay full/unrestricted unless an explicit stdio policy constrains them. */
export interface StdioMcpRuntimeOptions {
  readonly permissionProfile?: PermissionProfileName;
  readonly strictAllowedRoots?: readonly string[];
}

export function createStdioMcpRuntime(
  dataPath: string,
  workspace: Workspace,
  unrestricted: boolean = false,
  options: StdioMcpRuntimeOptions = {},
): StdioMcpRuntime {
  const databaseFilename = path.join(dataPath, 'lnwjud.sqlite');
  const database = new SqliteDatabase(databaseFilename, { backupDirectory: path.join(dataPath, 'backups') });
  const rawWorkspaceRepository = new SqliteWorkspaceRepository(database);
  const workspaceRepository = options.strictAllowedRoots === undefined
    ? rawWorkspaceRepository
    : new StrictWorkspaceRepository(rawWorkspaceRepository, options.strictAllowedRoots);
  const goalRepository = new SqliteGoalRepository(database);
  const scheduledContinuationService = new ScheduledContinuationService(goalRepository);
  const goalService = new GoalContinuationService(workspaceRepository, goalRepository, { scheduledContinuations: goalRepository });
  const workspaceIndex = new WorkspaceIndexService(workspaceRepository, new JsonWorkspaceIndexStore(path.join(dataPath, 'workspace-index')));
  const settingsRepository = new SqliteSettingsRepository(database);
  const auditRepository = new SqliteAuditRepository(database);
  const auditService = new AuditService(auditRepository);
  const checkpointRepository = new SqliteCheckpointRepository(database, new AesGcmCheckpointCipher(loadCheckpointEncryptionKey(dataPath)));
  const workspaceService = new WorkspaceService(workspaceRepository);
  const profileName = options.permissionProfile ?? 'full';
  const activeProfile = profileName === 'custom' ? customPermissionProfile(settingsRepository) : permissionProfiles[profileName];
  const strictRoots = options.strictAllowedRoots !== undefined;
  const effectiveUnrestricted = strictRoots ? false : unrestricted;
  const profileProvider = (): PermissionProfile => activeProfile;
  const destructivePolicyProvider = (): DestructiveAutoApprovalPolicy => parseDestructiveAutoApprovalPolicy(
    settingsRepository.get(DESTRUCTIVE_AUTO_APPROVAL_SETTING_KEY),
    parseBooleanSetting(settingsRepository.get(ALLOW_AI_DELETE_SETTING_KEY), false),
  );
  const allowAiDeleteProvider = (): boolean => destructivePolicyProvider().approvals.delete_file;

  const projectService = new ProjectService(workspaceRepository);
  const processService = new ProcessService(workspaceRepository, {
    projectService,
    profileProvider,
    defaultTimeoutMsProvider: (): number => parseIntegerSetting(settingsRepository.get(USER_SETTING_KEYS.processTimeoutMs), DEFAULT_PROCESS_TIMEOUT_MS, 1_000, 4 * 60 * 60_000),
    unrestricted: effectiveUnrestricted,
  });
  const checkpointService = new CheckpointService(workspaceRepository, checkpointRepository, {
    profile: activeProfile,
  });
  const pathGuard = new WorkspacePathGuard(new SecretPolicy(), { unrestricted: effectiveUnrestricted, trustedWorkspaceAccess: !strictRoots });
  const fileService = new FileService(workspaceRepository, pathGuard, undefined, {
    checkpointService,
    profileProvider,
    unrestricted: effectiveUnrestricted,
    trustedWorkspaceAccess: !strictRoots,
    allowDeleteWithoutConfirmation: allowAiDeleteProvider,
    protectCriticalFiles: (): boolean => destructivePolicyProvider().protectCriticalFiles,
    recoverableDelete: (): boolean => destructivePolicyProvider().recoverableDelete,
    recoveryTrashRoot: path.join(dataPath, 'recovery-trash'),
  });
  const gitService = new GitService(workspaceRepository);
  const workspaceQuery = new WorkspaceQueryService(workspaceRepository, pathGuard);
  const extensions = createLocalExtensionsService({
    settingsJson: settingsRepository.get(EXTENSIONS_SETTINGS_KEY),
    workspaceRootProvider: async (): Promise<string> => workspace.realRootPath,
    callTimeoutMs: parseIntegerSetting(settingsRepository.get(USER_SETTING_KEYS.mcpCallTimeoutMs), DEFAULT_MCP_CALL_TIMEOUT_MS, 1_000, 60 * 60_000),
    idleTimeoutMs: parseIntegerSetting(settingsRepository.get(USER_SETTING_KEYS.mcpIdleTimeoutMs), DEFAULT_MCP_IDLE_TIMEOUT_MS, 30_000, 24 * 60 * 60_000),
  });
  const codexService = new CodexService(workspaceRepository, {
    auditService,
    profileProvider,
  });
  const capabilityService = createStdioCapabilityService(dataPath, machineRootPath(workspace.realRootPath), async () => {
    const listed = await workspaceRepository.list();
    const roots = listed.map((entry) => entry.realRootPath);
    if (roots.length === 0) return effectiveUnrestricted ? [...allFixedDriveRoots()] : [workspace.realRootPath];
    return roots;
  }, effectiveUnrestricted, options.strictAllowedRoots, () => parsePathList(settingsRepository.get(USER_SETTING_KEYS.capabilityRoots)),
  () => parseIntegerSetting(settingsRepository.get(USER_SETTING_KEYS.shellSynchronousWaitSeconds), DEFAULT_SHELL_SYNCHRONOUS_WAIT_SECONDS, MIN_CONFIGURABLE_WAIT_SECONDS, MAX_CONFIGURABLE_WAIT_SECONDS));
  const actor: FileActor = { clientId: 'cli-mcp-stdio', clientName: 'lnwjud cli MCP' };
  const sharedActivityLease = createSharedActivityLease(process.env.TUNNEL_CLIENT_PROFILE_DIR);
  const activityReady = sharedActivityLease.then(async (lease) => lease?.initialize());
  const sharedActivitySink: ActivitySink = {
    async record(event: ActivitySinkEvent): Promise<void> {
      await (await sharedActivityLease)?.record(event);
    },
  };
  const durableActivitySink = composeActivitySinks([
    createFileActivitySink(mcpActivityLogPath(dataPath)),
    {
      async record(event: ActivitySinkEvent): Promise<void> {
        await auditService.recordMcpTool({
          actorId: actor.clientId,
          actorName: actor.clientName,
          ...(event.workspaceId === undefined ? {} : { workspaceId: event.workspaceId }),
          ...(event.sessionId === undefined ? {} : { sessionId: event.sessionId }),
          toolName: event.toolName,
          callId: event.callId,
          phase: event.phase,
          ...(event.targetSummary === undefined ? {} : { targetSummary: event.targetSummary }),
          resultCode: event.resultCode,
          ...(event.resultMessage === undefined ? {} : { resultMessage: event.resultMessage }),
          ...(event.traceId === undefined ? {} : { traceId: event.traceId }),
          ...(event.traceParent === undefined ? {} : { traceParent: event.traceParent }),
          durationMs: event.durationMs,
          timestamp: event.timestamp,
        });
      },
    },
  ]);
  const activityTracker = new ActivityTracker({
    async record(event: ActivitySinkEvent): Promise<void> {
      await composeActivitySinks(event.phase === 'started'
        ? [sharedActivitySink, durableActivitySink]
        : [durableActivitySink, sharedActivitySink]).record(event);
    },
  });
  const services: McpApplicationServices = {
    runtimeStatePath: path.join(dataPath, 'upgrade-runtime.json'),
    runtimeTiming: () => ({
      mcpPollWaitSeconds: parseIntegerSetting(settingsRepository.get(USER_SETTING_KEYS.mcpPollWaitSeconds), DEFAULT_MCP_POLL_WAIT_SECONDS, MIN_CONFIGURABLE_WAIT_SECONDS, MAX_CONFIGURABLE_WAIT_SECONDS),
    }),
    localProviders: () => ({
      ...(settingsRepository.get(USER_SETTING_KEYS.pdfProviderPath)?.trim() ? { pdfProvider: settingsRepository.get(USER_SETTING_KEYS.pdfProviderPath)!.trim() } : {}),
      lspCommands: parseStringRecordSetting(settingsRepository.get(USER_SETTING_KEYS.lspCommands)),
    }),
    capabilities: capabilityService,
    extensions,
    workspaceInfo: new WorkspaceInfoService(workspaceRepository, workspaceService, effectiveUnrestricted),
    workspaceQuery,
    projectSnapshot: new ProjectSnapshotService(workspaceRepository, {
      projectService,
      gitService,
      workspaceQuery,
      processService,
    }),
    project: projectService,
    file: fileService,
    checkpoint: checkpointService,
    goals: goalService,
    scheduledContinuations: scheduledContinuationService,
    search: new SearchService(workspaceRepository),
    workspaceIndex,
    git: gitService,
    process: processService,
    codex: codexService,
  };

  const activeWorkspaceScopeProvider = async (): Promise<WorkspaceScope> => ({
    workspaceId: workspace.id,
    rootPath: workspace.realRootPath,
  });
  const activeWorkspaceScopesProvider = async (): Promise<readonly WorkspaceScope[]> => {
    if (options.strictAllowedRoots === undefined) return [await activeWorkspaceScopeProvider()];
    const listed = await workspaceRepository.list();
    const byRoot = new Map(
      listed.map((entry) => [normalizeWorkspaceRoot(entry.realRootPath).toLowerCase(), entry] as const),
    );
    const scopes: WorkspaceScope[] = [];
    for (const root of options.strictAllowedRoots) {
      const entry = byRoot.get(normalizeWorkspaceRoot(root).toLowerCase());
      if (entry !== undefined) scopes.push({ workspaceId: entry.id, rootPath: entry.realRootPath });
    }
    if (scopes.length === 0) scopes.push(await activeWorkspaceScopeProvider());
    return scopes;
  };

  return {
    services,
    actor,
    extensions,
    activityTracker,
    activityReady,
    profileProvider,
    allowAiDeleteProvider,
    destructivePolicyProvider,
    activeWorkspaceScopeProvider,
    activeWorkspaceScopesProvider,
    codexToolsEnabled: parseBooleanSetting(settingsRepository.get(USER_SETTING_KEYS.codexToolsEnabled), DEFAULT_CODEX_TOOLS_ENABLED),
    close: async (): Promise<void> => {
      await (await sharedActivityLease)?.close();
      await extensions.close().catch(() => undefined);
      await workspaceIndex.close().catch(() => undefined);
      database.close();
    },
  };
}

function customPermissionProfile(settingsRepository: SqliteSettingsRepository): PermissionProfile {
  const custom = parseCustomPermissionSettings(settingsRepository.get(USER_SETTING_KEYS.customPermissionProfile));
  return {
    name: 'custom',
    defaults: { READ: custom.read, WRITE: custom.write, EXECUTE: custom.execute, DANGEROUS: custom.dangerous },
    allowedProjectExecutables: [...new Set([...permissionProfiles.custom.allowedProjectExecutables, ...custom.allowedExecutables])],
  };
}

async function createSharedActivityLease(profileDirectory: string | undefined): Promise<SharedActivitySnapshotLease | null> {
  if (profileDirectory === undefined || profileDirectory.trim().length === 0) return null;
  return new SharedActivitySnapshotLease({ profileDirectory: path.resolve(profileDirectory), owner: await currentSharedActivityOwner() });
}

function createStdioCapabilityService(
  dataPath: string,
  restrictedRoot: string,
  workspaceRootsProvider: () => Promise<readonly string[]>,
  unrestricted: boolean,
  strictAllowedRoots?: readonly string[],
  configuredRootsProvider: () => readonly string[] = () => [],
  synchronousWaitSecondsProvider: () => number = () => DEFAULT_SHELL_SYNCHRONOUS_WAIT_SECONDS,
): LocalCapabilityService {
  const capabilityRootsProvider = async (): Promise<readonly string[]> => {
    const workspaceRoots = await workspaceRootsProvider();
    if (strictAllowedRoots !== undefined) return workspaceRoots.length > 0 ? workspaceRoots : strictAllowedRoots;
    const configuredRoots = [...readCapabilityRoots(process.env.LNWJUD_CAPABILITY_ROOTS), ...configuredRootsProvider()];
    const roots = [...workspaceRoots, ...configuredRoots, ...(unrestricted ? [...allFixedDriveRoots()] : [restrictedRoot])];
    return roots.length === 0 ? [dataPath] : roots;
  };
  const initialCapabilityRoots = strictAllowedRoots ?? [dataPath, ...(unrestricted ? [...allFixedDriveRoots()] : [restrictedRoot])];
  const shellBackend = new ShellCapabilityBackend({
    allowedRoots: initialCapabilityRoots,
    allowedRootsProvider: capabilityRootsProvider,
    unrestricted,
    taskStateDirectory: path.join(dataPath, 'background-tasks'),
    maxSynchronousWaitSecondsProvider: synchronousWaitSecondsProvider,
  });
  const browserProtocol = new NodeBrowserCdpProtocol({ profileDir: path.join(dataPath, 'browser-profile') });
  const browserBackend = new BrowserCdpBackend({
    protocol: browserProtocol,
    launcher: (url: string | undefined, signal?: AbortSignal): Promise<Result<unknown>> => browserProtocol.launch(url, signal),
  });
  const windowsBridgeScript = capabilityBridgeScriptPath();
  const expectedScriptSha256 = capabilityBridgeExpectedSha256();
  const windowsBridge = new PowerShellWindowsCapabilityBridge({ scriptPath: windowsBridgeScript, expectedScriptSha256 });
  const nativeOptions = { allowedRootsProvider: capabilityRootsProvider, unrestricted };
  const accessibilityBackend = new WindowsNativeCapabilityBackend('accessibility', windowsBridge);
  const nativeVisionBackend = new WindowsNativeCapabilityBackend('vision', windowsBridge);
  const ocrHelperPath = windowsOcrHelperPath();
  const ocrHelper = ocrHelperPath === undefined ? undefined : new WindowsOcrProcessBridge({ helperPath: ocrHelperPath });
  const visionBackend = new VisionCapabilityBackend(nativeVisionBackend, new WindowsOcrCapabilityBackend({
    platform: process.platform,
    ...(ocrHelper === undefined ? {} : { helper: ocrHelper, packageIdentity: createOcrPackageIdentityProbe(ocrHelper) }),
  }));
  const wslAvailabilityProbe = async (): Promise<Result<unknown>> => {
    const probeRoots = await capabilityRootsProvider();
    const result = await shellBackend.execute({ operation: 'run', executable: 'wsl.exe', arguments: ['--status'], cwd: probeRoots[0] ?? dataPath, execution: 'foreground', timeout_seconds: 5, max_output_bytes: 32 * 1024, userConfirmed: false });
    if (!result.ok) return { ok: true, value: { available: false, ready: false, local: true, reason: 'wsl_executable_unavailable' } };
    const value = typeof result.value === 'object' && result.value !== null && !Array.isArray(result.value) ? result.value as Record<string, unknown> : {};
    const ready = value.state === 'completed' && value.exit_code === 0;
    return { ok: true, value: { available: ready, ready, local: true, ...(ready ? {} : { reason: 'wsl_status_failed' }) } };
  };
  const wslBackend = new WslCapabilityBackend({
    platform: process.platform,
    runner: shellBackend,
    allowedRoots: initialCapabilityRoots,
    allowedRootsProvider: capabilityRootsProvider,
    availabilityProbe: wslAvailabilityProbe,
  });
  const wslFsBackend = new WslFilesystemCapabilityBackend({
    platform: process.platform,
    allowedRoots: initialCapabilityRoots,
    allowedRootsProvider: capabilityRootsProvider,
    availabilityProbe: wslAvailabilityProbe,
  });
  const health = new HealthCapabilityBackend({
    domCdp: browserBackend,
    accessibility: accessibilityBackend,
    wslExec: wslBackend,
    wslFs: wslFsBackend,
  });
  return new LocalCapabilityService({
    shell: shellBackend,
    domCdp: browserBackend,
    accessibility: accessibilityBackend,
    inputEvent: new WindowsNativeCapabilityBackend('input_event', windowsBridge),
    vision: visionBackend,
    window: new WindowsNativeCapabilityBackend('window', windowsBridge),
    systemInfo: new WindowsNativeCapabilityBackend('system_info', windowsBridge),
    notification: new WindowsNativeCapabilityBackend('notification', windowsBridge),
    fileDialog: new WindowsNativeCapabilityBackend('file_dialog', windowsBridge),
    clipboard: new WindowsNativeCapabilityBackend('clipboard', windowsBridge),
    audio: new WindowsNativeCapabilityBackend('audio', windowsBridge),
    screenRecord: new WindowsNativeCapabilityBackend('screen_record', windowsBridge),
    office: new WindowsNativeCapabilityBackend('office', windowsBridge, nativeOptions),
    health,
    webFetch: new WebFetchCapabilityBackend(),
    scheduler: new SchedulerCapabilityBackend({ allowedRootsProvider: capabilityRootsProvider, unrestricted }),
    wslExec: wslBackend,
    wslFs: wslFsBackend,
  });
}

function readCapabilityRoots(raw: string | undefined): readonly string[] {
  if (raw === undefined || raw.trim().length === 0) return [];
  return raw.split(';').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

function capabilityBridgeScriptPath(): string {
  const override = process.env.LNWJUD_CAPABILITY_BRIDGE_SCRIPT;
  if (override !== undefined && override.trim().length > 0) return path.resolve(override);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const packaged = path.resolve(process.execPath, '..', 'resources', 'windows-capability-bridge.ps1');
  const candidates = [
    path.resolve(here, '..', '..', '..', 'packages', 'capabilities', 'src', 'windows-capability-bridge.ps1'),
    path.resolve(here, '..', '..', '..', '..', 'packages', 'capabilities', 'src', 'windows-capability-bridge.ps1'),
    packaged,
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return candidates[0]!;
}

function capabilityBridgeExpectedSha256(): string | undefined {
  const overridePath = process.env.LNWJUD_CAPABILITY_BRIDGE_SCRIPT;
  if (overridePath !== undefined && overridePath.trim().length > 0) return undefined;
  return WINDOWS_CAPABILITY_BRIDGE_SHA256 || undefined;
}

function windowsOcrHelperPath(): string | undefined {
  const override = process.env.LNWJUD_WINDOWS_OCR_HELPER;
  if (override !== undefined && override.trim().length > 0) return path.resolve(override);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, '..', '..', '..', '..', 'native', 'windows-ocr', 'bin', 'Release', 'net10.0-windows10.0.22621.0', 'win-x64', 'publish', 'lnwjud-windows-ocr.exe'),
    path.resolve(process.execPath, '..', 'resources', 'windows-ocr', 'lnwjud-windows-ocr.exe'),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}
