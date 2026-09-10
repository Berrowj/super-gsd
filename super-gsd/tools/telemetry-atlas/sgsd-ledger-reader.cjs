'use strict';
// Bounded incremental JSON/JSONL reader. Raw line bytes exist only while parsing.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MAX_BYTES = 256 * 1024;
const DEFAULT_MAX_RECORDS = 256;
const DEFAULT_MAX_LINE_BYTES = 64 * 1024;
const MIN_BATCH_BYTES = 16 * 1024;
const ANCHOR_BYTES = 4096;
const HEX = /^[a-f0-9]{64}$/;
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const bounded = (value, fallback, hard, minimum = 1) => {
  if (value == null) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError('invalid_reader_bound');
  return Math.min(value, hard);
};

function checkPath(file) {
  if (typeof file !== 'string' || !file.length || file.includes('\0')) throw new Error('invalid_source_path');
  const resolved = path.resolve(file), parsed = path.parse(resolved);
  let current = parsed.root;
  for (const part of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error('unsafe_symlink');
  }
  const parent = fs.realpathSync(path.dirname(resolved));
  const actual = fs.realpathSync(resolved);
  if (path.dirname(actual) !== parent) throw new Error('unsafe_parent_containment');
  const pstat = fs.statSync(parent);
  if (!pstat.isDirectory()) throw new Error('unsafe_parent');
  if (process.getuid && pstat.uid !== process.getuid()) throw new Error('unsafe_parent_owner');
  return resolved;
}

function openSafe(file) {
  const resolved = checkPath(file);
  const before = fs.lstatSync(resolved, { bigint: true });
  if (!before.isFile()) throw new Error('unsafe_special_file');
  if (before.nlink !== 1n) throw new Error('unsafe_hardlink');
  if (process.getuid && before.uid !== BigInt(process.getuid())) throw new Error('unsafe_file_owner');
  const fd = fs.openSync(resolved, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = fs.fstatSync(fd, { bigint: true });
    if (!stat.isFile()) throw new Error('unsafe_special_file');
    if (stat.nlink !== 1n) throw new Error('unsafe_hardlink');
    if (process.getuid && stat.uid !== BigInt(process.getuid())) throw new Error('unsafe_file_owner');
    if (before.dev !== stat.dev || before.ino !== stat.ino) throw new Error('source_changed_during_open');
    return { fd, stat, resolved, identity: sha(`${stat.dev}:${stat.ino}:${stat.birthtimeMs}`) };
  } catch (error) { fs.closeSync(fd); throw error; }
}

function cursorValue(value) {
  if (value == null) return null;
  if (!plain(value) || value.schema_version !== 1 || !Number.isSafeInteger(value.offset) || value.offset < 0
      || !HEX.test(value.file_identity || '') || !Number.isSafeInteger(value.head_length) || value.head_length < 0 || value.head_length > ANCHOR_BYTES
      || (value.head_length > 0 && !HEX.test(value.head_sha256 || ''))
      || !Number.isSafeInteger(value.tail_start) || value.tail_start < 0
      || !Number.isSafeInteger(value.tail_length) || value.tail_length < 0 || value.tail_length > ANCHOR_BYTES
      || (value.tail_length > 0 && !HEX.test(value.tail_sha256 || ''))
      || typeof value.discarding_oversize !== 'boolean'
      || !['json','jsonl'].includes(value.format)
      || !Number.isSafeInteger(value.source_size) || value.source_size < 0
      || !/^\d+$/.test(value.mtime_ns || '')) throw new Error('invalid_cursor');
  return value;
}

function readExact(fd, position, length) {
  if (!length) return Buffer.alloc(0);
  const buffer = Buffer.alloc(length);
  let total = 0;
  while (total < length) {
    const count = fs.readSync(fd, buffer, total, length - total, position + total);
    if (!count) break;
    total += count;
  }
  return buffer.subarray(0, total);
}

function structuralGap(reason, identity, offset = 0) {
  return { offset, length: 0, sha256: sha(`sgsd-ledger-gap-v1:${reason}:${identity}:${offset}`), reason };
}

function anchors(fd, offset, existingHead = null) {
  let reads = 0, headLength, headSha;
  if (existingHead) {
    headLength = existingHead.length; headSha = existingHead.sha256;
  } else {
    headLength = Math.min(ANCHOR_BYTES, offset);
    const head = readExact(fd, 0, headLength); reads += head.length; headSha = head.length ? sha(head) : null;
  }
  const tailLength = Math.min(ANCHOR_BYTES, offset), tailStart = offset - tailLength;
  const tail = readExact(fd, tailStart, tailLength); reads += tail.length;
  return { reads, head_length: headLength, head_sha256: headSha,
    tail_start: tailStart, tail_length: tail.length, tail_sha256: tail.length ? sha(tail) : null };
}

function readBatch(options = {}) {
  if (!plain(options)) throw new Error('invalid_reader_options');
  const maxBytes = bounded(options.maxBytes, DEFAULT_MAX_BYTES, DEFAULT_MAX_BYTES, MIN_BATCH_BYTES);
  const maxRecords = bounded(options.maxRecords, DEFAULT_MAX_RECORDS, DEFAULT_MAX_RECORDS);
  const maxLineBytes = bounded(options.maxLineBytes, DEFAULT_MAX_LINE_BYTES, DEFAULT_MAX_LINE_BYTES);
  const format = options.format == null ? 'jsonl' : options.format;
  if (!['json','jsonl'].includes(format)) throw new Error('invalid_reader_format');
  if (maxBytes < maxLineBytes + ANCHOR_BYTES * 3) throw new Error('reader_budget_too_small_for_line_limit');
  let prior = cursorValue(options.cursor), opened;
  if (prior && prior.format !== format) throw new Error('cursor_format_mismatch');
  try { opened = openSafe(options.file); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const empty = Object.freeze({ schema_version: 1, offset: 0, file_identity: sha('missing'),
      head_length: 0, head_sha256: null, tail_start: 0, tail_length: 0, tail_sha256: null,
      discarding_oversize: false, format, source_size: 0, mtime_ns: '0' });
    return { records: [], cursor: empty, bytesRead: 0, pendingBytes: 0,
      gaps: [structuralGap('source_missing', 'missing')], eof: true };
  }
  const { fd, stat, resolved, identity } = opened;
  if (stat.size > BigInt(Number.MAX_SAFE_INTEGER)) { fs.closeSync(fd); throw new Error('source_too_large'); }
  const size = Number(stat.size);
  let bytesRead = 0, offset = prior?.offset || 0, reset = false, discarding = prior?.discarding_oversize || false;
  const records = [], gaps = [];
  try {
    if (prior) {
      let resetReason = null;
      if (prior.file_identity !== identity) resetReason = 'source_replaced';
      else if (size < prior.offset) resetReason = 'source_truncated';
      else if (size < prior.source_size) resetReason = 'source_truncated';
      else if (format === 'json' && (size !== prior.source_size || String(stat.mtimeNs) !== prior.mtime_ns))
        resetReason = 'source_rewritten';
      else if (size === prior.source_size && String(stat.mtimeNs) !== prior.mtime_ns) resetReason = 'source_rewritten';
      else {
        const head = readExact(fd, 0, prior.head_length); bytesRead += head.length;
        const tail = readExact(fd, prior.tail_start, prior.tail_length); bytesRead += tail.length;
        if (head.length !== prior.head_length || (head.length && sha(head) !== prior.head_sha256)
            || tail.length !== prior.tail_length || (tail.length && sha(tail) !== prior.tail_sha256)) resetReason = 'source_rewritten';
      }
      if (resetReason) {
        gaps.push(structuralGap(resetReason, identity, prior.offset)); offset = 0; discarding = false; reset = true;
      }
    }
    // Reserve bounded reads for the returned cursor's two content-free anchors.
    const reserve = Math.min(ANCHOR_BYTES * 2, Math.max(0, maxBytes - bytesRead));
    const capacity = Math.max(0, maxBytes - bytesRead - reserve);
    const available = Math.max(0, size - offset), request = Math.min(capacity, available);
    const buffer = readExact(fd, offset, request); bytesRead += buffer.length;
    let position = 0, processed = 0;
    if (format === 'json' && offset === 0) {
      if (size === 0) gaps.push(structuralGap('source_empty', identity));
      else if (size > maxLineBytes) {
        gaps.push({ ...structuralGap('record_too_large', identity), length: size });
        offset = size;
      } else if (buffer.length === size) {
        const provenance = { offset: 0, length: buffer.length, sha256: sha(buffer) };
        try { records.push({ ...provenance, value: JSON.parse(buffer.toString('utf8')) }); offset = size; }
        catch { gaps.push({ ...provenance, reason: 'malformed_json' }); }
      }
    }
    while (format === 'jsonl' && position < buffer.length && processed < maxRecords) {
      const newline = buffer.indexOf(0x0a, position);
      if (newline < 0) break;
      const start = position, lineOffset = offset + start, line = buffer.subarray(start, newline);
      position = newline + 1; processed++;
      if (discarding) { discarding = false; continue; }
      const provenance = { offset: lineOffset, length: line.length, sha256: sha(line) };
      if (line.length > maxLineBytes) { gaps.push({ ...provenance, reason: 'line_too_large' }); continue; }
      try { records.push({ ...provenance, value: JSON.parse(line.toString('utf8')) }); }
      catch { gaps.push({ ...provenance, reason: 'malformed_json' }); }
    }
    offset += position;
    if (format === 'jsonl' && processed < maxRecords && position < buffer.length) {
      const remainder = buffer.subarray(position);
      if (remainder.length > maxLineBytes) {
        gaps.push({ offset, length: remainder.length, sha256: sha(remainder),
          reason: 'line_too_large' });
        offset += remainder.length; discarding = true;
      }
      // Otherwise it is an incomplete tail: cursor deliberately remains at its start.
    }
    const after = fs.fstatSync(fd, { bigint: true });
    let pathAfter;
    try { pathAfter = fs.lstatSync(resolved, { bigint: true }); } catch { pathAfter = null; }
    const snapshotChanged = format === 'json'
      && (after.size !== stat.size || after.mtimeNs !== stat.mtimeNs);
    const jsonlRewritten = format === 'jsonl'
      && after.size === stat.size && after.mtimeNs !== stat.mtimeNs;
    if (!pathAfter || pathAfter.dev !== after.dev || pathAfter.ino !== after.ino
        || after.size < stat.size || snapshotChanged || jsonlRewritten) {
      const changed = structuralGap('source_changed_during_read', identity, offset);
      const next = Object.freeze({ schema_version: 1, offset: 0, file_identity: identity,
        head_length: 0, head_sha256: null, tail_start: 0, tail_length: 0, tail_sha256: null,
        discarding_oversize: false, format, source_size: Number(after.size), mtime_ns: String(after.mtimeNs) });
      return { records: [], cursor: next, bytesRead, pendingBytes: Number(after.size), gaps: [changed], eof: false };
    }
    const finalSize = Number(after.size);
    const keepHead = prior && !reset ? { length: prior.head_length, sha256: prior.head_sha256 } : null;
    const anchor = anchors(fd, offset, keepHead); bytesRead += anchor.reads;
    const next = Object.freeze({ schema_version: 1, offset, file_identity: identity,
      head_length: anchor.head_length, head_sha256: anchor.head_sha256,
      tail_start: anchor.tail_start, tail_length: anchor.tail_length, tail_sha256: anchor.tail_sha256,
      discarding_oversize: discarding, format, source_size: finalSize, mtime_ns: String(after.mtimeNs) });
    const pendingBytes = Math.max(0, finalSize - offset);
    return { records, cursor: next, bytesRead, pendingBytes, gaps, eof: pendingBytes === 0 && !discarding };
  } finally { fs.closeSync(fd); }
}

module.exports = Object.freeze({ readBatch, DEFAULT_MAX_BYTES, DEFAULT_MAX_RECORDS, DEFAULT_MAX_LINE_BYTES });
