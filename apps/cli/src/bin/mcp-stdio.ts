import { runHeadlessMcp } from '../runtime/headless-mcp-bootstrap.js';

runHeadlessMcp(process.argv, process.env).catch((error: unknown) => {
  process.stderr.write(`lnwjud MCP stdio failed: ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exit(1);
});
