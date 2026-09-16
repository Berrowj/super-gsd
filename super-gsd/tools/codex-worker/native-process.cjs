'use strict';

// Small platform seam for the existing native rollout bridge. It observes a
// Windows process through the local OS query only; it never starts, signals or
// changes the target process.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const WINDOWS_QUERY = [
  "$ErrorActionPreference = 'Stop'",
  '$targetPid = [int]$env:SGSD_NATIVE_PID',
  '$p = Get-CimInstance Win32_Process -Filter ("ProcessId={0}" -f $targetPid)',
  '$os = Get-CimInstance Win32_OperatingSystem',
  'if ($null -eq $p -or $null -eq $os -or [string]::IsNullOrWhiteSpace($p.ExecutablePath)) { exit 3 }',
  '$created = [Management.ManagementDateTimeConverter]::ToDateTime($p.CreationDate).ToUniversalTime().ToString("yyyyMMddHHmmssfffffff")',
  '$boot = [Management.ManagementDateTimeConverter]::ToDateTime($os.LastBootUpTime).ToUniversalTime().ToString("o")',
  '[pscustomobject]@{ pid = [int]$p.ProcessId; start_time = $created; executable = $p.ExecutablePath; boot_time = $boot } | ConvertTo-Json -Compress',
].join('; ');
const WINDOWS_BOOT_QUERY = [
  "$ErrorActionPreference = 'Stop'",
  '$os = Get-CimInstance Win32_OperatingSystem',
  'if ($null -eq $os) { exit 3 }',
  '[Management.ManagementDateTimeConverter]::ToDateTime($os.LastBootUpTime).ToUniversalTime().ToString("o")',
].join('; ');

function fail(reason) { throw new Error(reason); }
function uuidFromBoot(timestamp) {
  const hex = crypto.createHash('sha256').update(timestamp).digest('hex').slice(0, 32).split('');
  hex[12] = '4'; hex[16] = ['8', '9', 'a', 'b'][parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}
function normalizeWindowsStart(value) {
  if (typeof value !== 'string' || !/^\d{21}$/.test(value)) fail('codex_bridge_process_unverified');
  return value;
}
const windowsAbsolute = value => typeof value === 'string'
  && (/^[A-Za-z]:[\\/]/.test(value) || /^\\\\/.test(value)) && path.win32.isAbsolute(value);
function normalizeWindowsProcess(value, { pid, cwd } = {}) {
  if (!value || value.pid !== pid || !Number.isSafeInteger(value.pid) || value.pid < 1
      || !windowsAbsolute(value.executable) || /[\x00-\x1f\x7f]/.test(value.executable)
      || !windowsAbsolute(cwd) || /[\x00-\x1f\x7f]/.test(cwd)) fail('codex_bridge_process_unverified');
  return { pid, start_time: normalizeWindowsStart(value.start_time), executable: path.win32.normalize(value.executable),
    cwd: path.win32.normalize(cwd), environment: {}, boot_id: uuidFromBoot(value.boot_time) };
}
function powershell(script, pid) {
  try {
    const env = { ...process.env, SGSD_NATIVE_PID: String(pid) };
    return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8', env, windowsHide: true, timeout: 5000, maxBuffer: 65536,
    }).trim();
  } catch { fail('codex_bridge_process_unverified'); }
}
function readWindowsBootId() {
  if (process.platform !== 'win32') fail('native_process_platform_unsupported');
  const value = powershell(WINDOWS_BOOT_QUERY, 0);
  if (!value || !Number.isFinite(Date.parse(value))) fail('native_process_boot_unverified');
  return uuidFromBoot(value);
}
function readWindowsProcess(pid, expectedCwd, { requireInvokerCwd = false } = {}) {
  if (process.platform !== 'win32' || !Number.isSafeInteger(pid) || pid < 1) fail('codex_bridge_process_unverified');
  if (typeof expectedCwd !== 'string' || !path.win32.isAbsolute(expectedCwd)) fail('codex_bridge_process_unverified');
  const cwd = path.win32.normalize(expectedCwd);
  if (requireInvokerCwd && path.win32.normalize(process.cwd()).toLowerCase() !== cwd.toLowerCase()) fail('codex_bridge_identity_mismatch');
  let value;
  try { value = JSON.parse(powershell(WINDOWS_QUERY, pid)); } catch { fail('codex_bridge_process_unverified'); }
  return normalizeWindowsProcess(value, { pid, cwd });
}
function readBootId() {
  if (process.platform === 'win32') return readWindowsBootId();
  if (process.platform !== 'linux') fail('native_process_platform_unsupported');
  return fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim();
}
function readNativeProcess(pid, expectedCwd, options = {}) {
  if (process.platform === 'win32') return readWindowsProcess(pid, expectedCwd, options);
  if (process.platform !== 'linux' || !Number.isSafeInteger(pid) || pid < 1) return null;
  const base = `/proc/${pid}`;
  try {
    const stat = fs.readFileSync(`${base}/stat`, 'utf8'), fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
    if (!/^\d+$/.test(fields[19]) || ['Z', 'X'].includes(fields[0])) return null;
    return { start_time: fields[19], executable: fs.readlinkSync(`${base}/exe`), cwd: fs.realpathSync(`${base}/cwd`), boot_id: readBootId() };
  } catch { return null; }
}
module.exports = Object.freeze({ normalizeWindowsProcess, readWindowsBootId, readWindowsProcess, readBootId, readNativeProcess, uuidFromBoot });
