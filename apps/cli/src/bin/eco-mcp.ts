import { preparePackagedRuntimeEnvironment } from '../runtime/packaged-runtime-env.js';

preparePackagedRuntimeEnvironment(process.argv, process.env);

void import('./mcp-stdio.js').catch((error: unknown) => {
  process.stderr.write(`ECO MCP bootstrap failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
