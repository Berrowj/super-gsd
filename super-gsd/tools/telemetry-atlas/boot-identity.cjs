'use strict';
// Boot identity is evidence, never authority to signal a PID. All metadata is private.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { safePath } = require('./contract.cjs');
const { privateDirectory } = require('./quota-sampler.cjs');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const validBootId = value => typeof value === 'string' && UUID.test(value);
function validLockIdentity(value, pid) {
  // Older Windows startup records explicitly wrote null when /proc was absent.
  if (value === undefined || value === null) return true;
  const text = value => typeof value === 'string' && value.length <= 4096 && !/[\x00-\x1f\x7f]/.test(value);
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => ['pid', 'start_time', 'executable', 'argv'].includes(key))
    && value.pid === pid && typeof value.start_time === 'string' && /^\d{1,32}$/.test(value.start_time)
    && text(value.executable) && path.isAbsolute(value.executable)
    && Array.isArray(value.argv) && value.argv.length > 0 && value.argv.length <= 256
    && text(value.argv[0]) && value.argv[0].trim().length > 0 && value.argv.every(text);
}
function currentBootId(dependencies) {
  try {
    if (dependencies?.bootId) { const value = dependencies.bootId(); return validBootId(value) ? value : null; }
    if (process.platform !== 'linux') return null;
    const fd = fs.openSync('/proc/sys/kernel/random/boot_id', 'r');
    try {
      const bytes = Buffer.alloc(39), length = fs.readSync(fd, bytes, 0, bytes.length, 0);
      const value = bytes.subarray(0, length).toString('utf8').trim();
      return length < bytes.length && validBootId(value) ? value : null;
    } finally { fs.closeSync(fd); }
  } catch { return null; }
}
function bootState(recorded, dependencies) {
  const current = currentBootId(dependencies);
  return validBootId(recorded) && current ? recorded === current ? 'same' : 'prior' : 'unknown';
}
function processState(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1 || pid > 2147483647) return 'unknown';
  try { process.kill(pid, 0); return 'alive'; } catch (error) { return error.code === 'ESRCH' ? 'dead' : 'unknown'; }
}
function snapshot(file) {
  safePath(file);
  let fd;
  try {
    const before = fs.lstatSync(file);
    if (!before.isFile() || before.isSymbolicLink() || (process.getuid && before.uid !== process.getuid())) throw new Error('unsafe_boot_record');
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    const stat = fs.fstatSync(fd);
    if (stat.dev !== before.dev || stat.ino !== before.ino || stat.size > 65536) throw new Error('unsafe_boot_record');
    const bytes = Buffer.alloc(65537), size = fs.readSync(fd, bytes, 0, bytes.length, 0);
    if (size > 65536 || fs.fstatSync(fd).size !== stat.size) throw new Error('unsafe_boot_record');
    return { bytes: bytes.subarray(0, size).toString('utf8'), dev: stat.dev, ino: stat.ino };
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
const same = (a, b) => Boolean(a && b && a.dev === b.dev && a.ino === b.ino && a.bytes === b.bytes);
function syncDirectory(directory) {
  if (process.platform === 'win32') return;
  const fd = fs.openSync(directory, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function preserveRecord({ file, receiptDirectory, reason, expected }) {
  const observed = snapshot(file);
  if (!observed || (expected && !same(expected, observed))) return null;
  privateDirectory(receiptDirectory);
  const hash = crypto.createHash('sha256').update(observed.bytes).digest('hex');
  const receipt = path.join(receiptDirectory, `${path.basename(file)}-${hash}.json`);
  safePath(receipt);
  const value = { schema_version: 1, source_name: path.basename(file), source_sha256: hash,
    source_bytes: observed.bytes, reason, preserved_at: new Date().toISOString() };
  let fd;
  try {
    fd = fs.openSync(receipt, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(value) + '\n'); fs.fsyncSync(fd);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = snapshot(receipt); let row;
    try { row = JSON.parse(existing?.bytes); } catch { throw new Error('boot_receipt_conflict'); }
    if (row.source_bytes !== observed.bytes || row.source_sha256 !== hash || row.reason !== reason) throw new Error('boot_receipt_conflict');
  } finally { if (fd !== undefined) fs.closeSync(fd); }
  syncDirectory(receiptDirectory);
  // The first receipt directory's name must survive before a caller removes
  // its original record. A directory fsync does not flush its parent's entry.
  syncDirectory(path.dirname(receiptDirectory));
  return observed;
}
function reclaimLock({ file, receiptDirectory }, dependencies) {
  // A second recovery process must not unlink a new owner's lock. Serialise the
  // read/archive/revalidate/unlink window, independently of the stale lock itself.
  // A crashed guard is a named fail-closed blocker; it is never reclaimed by age.
  safePath(file);
  const boot = currentBootId(dependencies), guard = `${file}.reclaim-${boot || 'unknown'}`;
  safePath(guard);
  let fd;
  try { fd = fs.openSync(guard, 'wx', 0o600); }
  catch (error) { if (['EEXIST', 'EPERM', 'EACCES', 'ENOENT'].includes(error.code)) return false; throw error; }
  let guardIdentity;
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, token: crypto.randomUUID(), boot_id: boot }) + '\n'); fs.fsyncSync(fd);
    guardIdentity = snapshot(guard);
    const before = snapshot(file); if (!before) return false;
    let row; try { row = JSON.parse(before.bytes); } catch { return false; }
    if (!row || Array.isArray(row) || Object.keys(row).some(key => !['pid', 'token', 'identity', 'boot_id'].includes(key))
        || !Number.isSafeInteger(row.pid) || row.pid < 1 || row.pid > 2147483647 || !UUID.test(row.token || '')
        || (row.boot_id !== undefined && row.boot_id !== null && !validBootId(row.boot_id))
        || !validLockIdentity(row.identity, row.pid)) return false;
    let reason = bootState(row.boot_id, dependencies) === 'prior' ? 'prior_boot' : null;
    if (!reason) {
      let state; try { state = (dependencies?.processState || processState)(row.pid); } catch { return false; }
      if (state !== 'dead') return false;
      reason = 'owner_process_dead';
    }
    const preserved = preserveRecord({ file, receiptDirectory, reason, expected: before });
    if (!preserved || !same(before, snapshot(file))) return false;
    fs.unlinkSync(file); syncDirectory(path.dirname(file)); return true;
  } finally {
    fs.closeSync(fd);
    if (guardIdentity && same(guardIdentity, snapshot(guard))) { fs.unlinkSync(guard); syncDirectory(path.dirname(guard)); }
  }
}
module.exports = Object.freeze({ currentBootId, validBootId, bootState, processState, reclaimLock, preserveRecord });
