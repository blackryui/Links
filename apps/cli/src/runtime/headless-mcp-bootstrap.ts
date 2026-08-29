import fs from 'node:fs';
import path from 'node:path';
import { syncMachineRoots } from '@lnwjud/application';
import { startMcpStdio } from '@lnwjud/mcp-server';
import {
  STDIO_ALLOWED_ROOTS_SETTING_KEY,
  STDIO_PERMISSION_PROFILE_SETTING_KEY,
  STDIO_STRICT_ROOTS_SETTING_KEY,
  UNRESTRICTED_SETTING_KEY,
  isUnrestricted,
  parseAllowedRoots,
  parseBooleanSetting,
  parseStdioPermissionProfile,
  resolveLnwjudDataPath,
} from '@lnwjud/shared';
import {
  applyPendingSqliteRestoreSync,
  SqliteBackupService,
  SqliteDatabase,
  SqliteSettingsRepository,
  SqliteWorkspaceRepository,
} from '@lnwjud/storage';
import { machineRootPath, normalizeWorkspaceRoot, WorkspaceService, type Workspace } from '@lnwjud/workspace';
import { createStdioMcpRuntime } from './stdio-mcp-runtime.js';
import { StrictWorkspaceRepository, canonicalizeAllowedRoots, requestedPathInsideAllowedRoot } from './strict-workspace-repository.js';
import { resetWorkspaceRegistrations } from './workspace-reset.js';

export interface HeadlessMcpHandle {
  readonly dataPath: string;
  readonly workspace: Workspace;
  readonly strictAllowedRoots?: readonly string[];
  close(): Promise<void>;
}

function readArg(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readArgs(argv: readonly string[], flag: string): readonly string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== flag) continue;
    const value = argv[index + 1];
    if (typeof value === 'string' && value.trim().length > 0) values.push(value.trim());
  }
  return values;
}

function hasFlag(argv: readonly string[], flag: string): boolean {
  return argv.includes(flag);
}

export async function runHeadlessMcp(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HeadlessMcpHandle> {
  const dataPath = resolveLnwjudDataPath(env);
  fs.mkdirSync(dataPath, { recursive: true });
  const restore = applyPendingSqliteRestoreSync(path.join(dataPath, 'lnwjud.sqlite'), path.join(dataPath, 'backups'));
  if (restore.error !== undefined) process.stderr.write(`lnwjud MCP stdio: scheduled restore failed: ${restore.error}\n`);
  if (restore.applied) process.stderr.write(`lnwjud MCP stdio: restored database from ${restore.backupId ?? 'scheduled backup'}\n`);

  const database = new SqliteDatabase(path.join(dataPath, 'lnwjud.sqlite'), { backupDirectory: path.join(dataPath, 'backups') });
  const rawWorkspaceRepository = new SqliteWorkspaceRepository(database);
  const settingsRepository = new SqliteSettingsRepository(database);

  const profileName = parseStdioPermissionProfile(
    readArg(argv, '--profile')
      ?? env.LNWJUD_STDIO_PROFILE
      ?? settingsRepository.get(STDIO_PERMISSION_PROFILE_SETTING_KEY),
    'full',
  );
  const strictRootsEnabled = hasFlag(argv, '--strict-roots')
    || (env.LNWJUD_STRICT_ROOTS !== undefined
      ? parseBooleanSetting(env.LNWJUD_STRICT_ROOTS, false)
      : parseBooleanSetting(settingsRepository.get(STDIO_STRICT_ROOTS_SETTING_KEY), false));
  const cliAllowedRoots = readArgs(argv, '--allowed-root');
  const envAllowedRoots = parseAllowedRoots(env.LNWJUD_ALLOWED_ROOTS);
  const storedAllowedRoots = parseAllowedRoots(settingsRepository.get(STDIO_ALLOWED_ROOTS_SETTING_KEY));
  const configuredAllowedRoots = cliAllowedRoots.length > 0
    ? cliAllowedRoots
    : envAllowedRoots.length > 0
      ? envAllowedRoots
      : storedAllowedRoots;
  const strictAllowedRoots = strictRootsEnabled ? await canonicalizeAllowedRoots(configuredAllowedRoots) : undefined;

  const rawWorkspaceService = new WorkspaceService(rawWorkspaceRepository);
  const reset = hasFlag(argv, '--reset-workspaces')
    || env.LNWJUD_RESET_WORKSPACES === '1'
    || env.LNWJUD_RESET_WORKSPACES === 'true';
  if (reset) {
    const backupService = new SqliteBackupService(database, {
      databaseFilename: path.join(dataPath, 'lnwjud.sqlite'),
      backupDirectory: path.join(dataPath, 'backups'),
    });
    const result = await resetWorkspaceRegistrations(
      rawWorkspaceService,
      backupService,
      readArg(argv, '--confirm-reset-workspaces') ?? env.LNWJUD_CONFIRM_RESET_WORKSPACES,
    );
    process.stderr.write(
      `lnwjud MCP stdio: cleared ${result.deleted} previous workspace registration(s)`
      + `${result.backupId === null ? '' : ` after backup ${result.backupId}`}\n`,
    );
  }

  const workspaceRepository = strictAllowedRoots === undefined
    ? rawWorkspaceRepository
    : new StrictWorkspaceRepository(rawWorkspaceRepository, strictAllowedRoots);
  const workspaceService = new WorkspaceService(workspaceRepository);
  const unrestricted = strictAllowedRoots === undefined
    ? isUnrestricted(env, settingsRepository.get(UNRESTRICTED_SETTING_KEY))
    : false;

  const requestedRaw = readArg(argv, '--workspace') ?? env.LNWJUD_WORKSPACE;
  const requestedPath = path.resolve(
    requestedRaw && requestedRaw.trim().length > 0
      ? requestedRaw
      : strictAllowedRoots?.[0] ?? machineRootPath(),
  );
  if (!fs.existsSync(requestedPath)) {
    process.stderr.write(`lnwjud MCP stdio: workspace path does not exist: ${requestedPath}\n`);
    database.close();
    process.exit(2);
  }

  let workspace: Workspace;
  if (strictAllowedRoots !== undefined) {
    env.LNWJUD_CAPABILITY_ROOTS = strictAllowedRoots.join(';');
    for (const root of strictAllowedRoots) {
      const normalized = normalizeWorkspaceRoot(root).toLowerCase();
      const existing = (await workspaceService.list()).find((entry) => normalizeWorkspaceRoot(entry.realRootPath).toLowerCase() === normalized);
      if (existing !== undefined) continue;
      const added = await workspaceService.add(path.basename(root) || root, root);
      if (!added.ok) throw new Error(`Could not register strict allowed root ${root}: ${added.error.message}`);
    }
    const selectedAllowedRoot = await requestedPathInsideAllowedRoot(requestedPath, strictAllowedRoots);
    const selectedNorm = normalizeWorkspaceRoot(selectedAllowedRoot).toLowerCase();
    const selected = (await workspaceService.list()).find((entry) => normalizeWorkspaceRoot(entry.realRootPath).toLowerCase() === selectedNorm);
    if (selected === undefined) throw new Error(`Strict allowed root was not registered: ${selectedAllowedRoot}`);
    workspace = selected;
  } else {
    const restrictedRoot = machineRootPath(requestedPath);
    env.LNWJUD_CAPABILITY_ROOTS = env.LNWJUD_CAPABILITY_ROOTS?.trim() || restrictedRoot.replace(/\\/g, '/');
    const machineRoot = await syncMachineRoots(workspaceService, unrestricted, requestedPath);
    if (machineRoot === null) throw new Error('Could not register machine root');

    const requestedNorm = normalizeWorkspaceRoot(requestedPath).toLowerCase();
    const workspaces = await workspaceService.list();
    let selected = workspaces.find((entry) => normalizeWorkspaceRoot(entry.realRootPath).toLowerCase() === requestedNorm);
    if (selected === undefined && requestedNorm !== normalizeWorkspaceRoot(restrictedRoot).toLowerCase()) {
      const added = await workspaceService.add(path.basename(requestedPath) || 'Workspace', requestedPath);
      if (!added.ok) throw new Error(`Could not register ${requestedPath}: ${added.error.message}`);
      selected = added.value;
    }
    workspace = selected ?? machineRoot;
  }

  for (const entry of await workspaceService.list()) {
    process.stderr.write(`lnwjud workspace id=${entry.id} root=${entry.realRootPath}\n`);
  }
  database.close();

  const runtime = createStdioMcpRuntime(dataPath, workspace, unrestricted, {
    permissionProfile: profileName,
    ...(strictAllowedRoots === undefined ? {} : { strictAllowedRoots }),
  });
  await runtime.activityReady;
  process.stderr.write(
    `lnwjud MCP stdio ready primary=${workspace.id} root=${workspace.realRootPath} profile=${profileName}`
      + `${unrestricted ? ' unrestricted=1' : ''}${strictAllowedRoots === undefined ? '' : ` strict_roots=${strictAllowedRoots.length}`}\n`,
  );

  let shuttingDown = false;
  let handle: ReturnType<typeof startMcpStdio> | undefined;
  const close = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    try { await handle?.close(); } catch { /* transport may already be closed */ }
    try { await runtime.close(); } catch { /* runtime may already be closing */ }
  };
  const shutdownAndExit = async (): Promise<void> => {
    await close();
    process.exit(0);
  };

  handle = startMcpStdio({
    services: runtime.services,
    actor: runtime.actor,
    activityTracker: runtime.activityTracker,
    codexToolsEnabled: runtime.codexToolsEnabled,
    profileProvider: runtime.profileProvider,
    allowAiDeleteProvider: runtime.allowAiDeleteProvider,
    destructivePolicyProvider: runtime.destructivePolicyProvider,
    activeWorkspaceScopeProvider: runtime.activeWorkspaceScopeProvider,
    onError: (error): void => {
      if (/EPIPE|ECONNRESET|broken pipe/i.test(error.message)) {
        process.stderr.write(`lnwjud MCP stdio: peer closed (${error.message})\n`);
        void shutdownAndExit();
        return;
      }
      process.stderr.write(`lnwjud MCP stdio error: ${error.message}\n`);
    },
  });

  process.stdin.on('end', () => { void shutdownAndExit(); });
  process.stdin.on('close', () => { void shutdownAndExit(); });
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE' || error.code === 'ECONNRESET') void shutdownAndExit();
  });
  process.on('SIGINT', () => { void shutdownAndExit(); });
  process.on('SIGTERM', () => { void shutdownAndExit(); });

  return {
    dataPath,
    workspace,
    ...(strictAllowedRoots === undefined ? {} : { strictAllowedRoots }),
    close,
  };
}
