import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const supervisorSource = readFileSync(join(__dirname, 'vtp-tunnel-supervisor.cjs'), 'utf8');

describe('vtp-tunnel-supervisor remote bearer handoff', () => {
  it('keeps the remote bearer file self-healing while the ssh session is alive', () => {
    expect(supervisorSource).toContain('write_bearer()');
    expect(supervisorSource).toContain('bearer_watchdog_pid');
    expect(supervisorSource).toContain('while sleep 15');
    expect(supervisorSource).toContain('if [ "$(cat "$bearer_file" 2>/dev/null)" != "$__vtp_bearer" ]; then write_bearer; fi');
  });
});
