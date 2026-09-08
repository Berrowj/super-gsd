#!/usr/bin/env node
'use strict';
const mailbox = require('./mailbox.cjs');
function main(argv = process.argv.slice(2)) {
  const [action, ...args] = argv;
  const value = (flag, fallback) => { const i = args.indexOf(flag); return i < 0 ? fallback : args[i + 1]; };
  const project = value('--project', process.cwd());
  const owner = value('--owner'), worker = value('--worker');
  if (action === 'status') return { workers: mailbox.list(project).filter(row => (!owner || row.owner === owner) && (!worker || row.worker_id === worker)) };
  if (action === 'receipt') return mailbox.receipt(project, worker, value('--command'));
  const answers = value('--answers-json');
  return mailbox.submit(project, worker, action, { requestId: value('--request'), text: value('--text'),
    answers: answers === undefined ? undefined : JSON.parse(answers), owner });
}
if (require.main === module) {
  try { process.stdout.write(JSON.stringify(main()) + '\n'); }
  catch (error) { process.stderr.write(`WORKER_CONTROL: ${error.code === 'EEXIST' ? 'duplicate_control_message' : error.message}\n`); process.exitCode = 2; }
}
module.exports = { main };
