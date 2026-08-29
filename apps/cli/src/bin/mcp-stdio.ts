import process from 'node:process';
import { HeadlessMcpExitError, runHeadlessMcp } from '../runtime/headless-mcp-bootstrap.js';

void runHeadlessMcp(process.argv, process.env).catch((error: unknown) => {
  if (error instanceof HeadlessMcpExitError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode;
    return;
  }
  process.stderr.write(`lnwjud MCP stdio failed: ${error instanceof Error ? error.message : 'unknown'}\n`);
  process.exitCode = 1;
});
