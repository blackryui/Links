import { preparePackagedRuntimeEnvironment } from '../runtime/packaged-runtime-env.js';
import { runHeadlessMcp } from '../runtime/headless-mcp-bootstrap.js';

preparePackagedRuntimeEnvironment(process.argv, process.env);

runHeadlessMcp(process.argv, process.env).catch((error: unknown) => {
  process.stderr.write(`lnwjud MCP stdio failed: ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exit(1);
});
