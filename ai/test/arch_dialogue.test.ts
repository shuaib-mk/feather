import { parseLocally, runLavenderAgent } from '../backend/agent'
import { nextPendingSlip } from '../../client/src/lib/conversation'
let passed = 0, failed = 0
function check(name: string, cond: boolean, extra?: unknown) { if (cond) { console.log('[PASS] ' + name); passed++ } else { console.error('[FAIL] ' + name, extra || ''); failed++ } }
const TODAY = '2026-11-03'
const toolMsg = (calls: any[]) => ({ choices: [{ message: { role: 'assistant', content: null, tool_calls: calls } }] })
const textMsg = (content: string) => ({ choices: [{ message: { role: 'assistant', content: content } }] })
const logCall = (id: string, args: any) => ({ id: id, function: { name: 'log_entry', arguments: JSON.stringify(args) } })
async function withLive(responses: any[], fn: () => Promise<void>) {
  process.env.META_API_KEY = 'test-key'
  process.env.META_BASE_URL = 'https://mock.meta.test/v1'
  const orig = globalThis.fetch
  let i = 0
  globalThis.fetch = (async () => { const r = responses[Math.min(i++, responses.length - 1)]; return { ok: true, status: 200, json: () => Promise.resolve(r) } }) as any
  try { await fn() } finally { globalThis.fetch = orig }
}
async function main() {
  const s1 = parseLocally('My cycle began this morning, flow is heavy', TODAY, {})
  check('slip has stable id', !!(s1.entry) && s1.entry.slipId === 'slip-2026-11-03-period_started', s1.entry)
  const pend: any = { date: '2026-10-02', flow: 'heavy', symptoms: ['cramps'], mood: null, energy: null, sleep: null, notes: 'x', kind: 'daily_log', slipId: 'slip-2026-10-02-daily_log' }
  const c1 = parseLocally('no wait, actually it was light', TODAY, { pendingEntry: pend })
  check('correction keeps slip id', !!(c1.entry) && c1.entry.slipId === 'slip-2026-10-02-daily_log' && c1.entry.flow === 'light' && c1.replacesExisting === true, c1.entry)
  const bf = parseLocally('periods started October 2nd, September 9th and August 14th', TODAY, {})
  const ids = ((bf.entries || []) as any[]).map((e) => e.slipId)
  check('backfill slips have distinct ids', ids.length === 3 && new Set(ids).size === 3 && ids.every((x) => typeof x === 'string' && x.indexOf('slip-') === 0), ids)
  const fq = parseLocally('I had my period in September', TODAY, {})
  check('month question asked', fq.needsClarification === true && fq.entry == null, fq.message)
  const fa = parseLocally('the 12th', TODAY, { openQuestion: fq.clarificationQuestion, priorPrompt: 'I had my period in September' })
  check('fragment answer completes the slip', !!(fa.entry) && fa.entry.date === '2026-09-12' && fa.entry.kind === 'period_started', fa.entry)
  const hq = parseLocally('My period started and the flow is quite heavy', TODAY, {})
  const ha = parseLocally('yesterday', TODAY, { openQuestion: hq.clarificationQuestion, priorPrompt: 'My period started and the flow is quite heavy' })
  check('relative answer keeps stated flow', !!(ha.entry) && ha.entry.date === '2026-11-02' && ha.entry.flow === 'heavy' && ha.entry.kind === 'period_started', ha.entry)
  const rows: any = [{ date: '2026-10-02', kind: 'period_started', flow: null, symptoms: [], mood: null, energy: null, sleep: null, notes: null, slipId: 'slip-2026-10-02-period_started-0' }, { date: '2026-10-09', kind: 'period_started', flow: null, symptoms: [], mood: null, energy: null, sleep: null, notes: null, slipId: 'slip-2026-10-09-period_started-1' }]
  const rAmb = parseLocally('make it light', TODAY, { pendingEntries: rows })
  check('ambiguous multi-pending asks with dates', rAmb.entry == null && rAmb.needsClarification === true && rAmb.message.indexOf('2026-10-02') !== -1 && rAmb.message.indexOf('2026-10-09') !== -1, rAmb.message)
  const rRow = parseLocally('change the October 2nd entry to October 3rd', TODAY, { pendingEntries: rows })
  check('named row corrected in place', !!(rRow.entry) && rRow.entry.date === '2026-10-03' && rRow.entry.slipId === 'slip-2026-10-02-period_started-0' && rRow.replacesExisting === true, rRow.entry)
  const rOne = parseLocally('make it heavy', TODAY, { pendingEntries: [rows[0]] })
  check('single pending row targeted', !!(rOne.entry) && rOne.entry.date === '2026-10-02' && rOne.replacesExisting === true, rOne.entry)
  const savedRecent: any = [{ date: '2026-10-28', flow: 'medium', symptoms: [], mood: null, energy: null, sleep: null, notes: 'x', kind: 'daily_log' }]
  const rPend = parseLocally('make it light', TODAY, { pendingEntry: pend, recentEntries: savedRecent })
  check('pending beats saved record', !!(rPend.entry) && rPend.entry.date === '2026-10-02' && rPend.entry.slipId === 'slip-2026-10-02-daily_log', rPend.entry)
  const rDisc = parseLocally('don\'t log that', TODAY, { pendingEntry: pend })
  check('explicit discard clears pending', rDisc.entry == null && rDisc.discardedSlip === true, rDisc.message)
  const rNoPend = parseLocally('undo that', TODAY, {})
  check('cancel without pending is honest', rNoPend.entry == null && !rNoPend.discardedSlip && rNoPend.message.indexOf('no pending slip') !== -1, rNoPend.message)
  const fresh: any = { date: TODAY, flow: 'light', symptoms: [], mood: null, energy: null, sleep: null, notes: null, kind: 'daily_log' }
  check('nextPendingSlip replaces on new slip', nextPendingSlip(pend as any, { entry: fresh } as any) === fresh, 'replace')
  check('nextPendingSlip clears on discard', nextPendingSlip(pend as any, { discardedSlip: true } as any) === null, 'discard')
  check('nextPendingSlip preserves on message-only', nextPendingSlip(pend as any, { entry: null } as any) === pend, 'preserve')
  check('nextPendingSlip yields to backfill rows', nextPendingSlip(pend as any, { entries: [fresh] } as any) === null, 'rows')
  await withLive([toolMsg([logCall('n1', { date: TODAY, flow: 'medium', kind: 'daily_log', symptoms: ['cramps'] })]), textMsg('Noted.')], async () => {
    const r = await runLavenderAgent('I have been bleeding since this morning and my flow is medium', { currentDate: TODAY })
    check('live slip carries stable id', !!(r.entry) && r.entry.slipId === 'slip-' + TODAY + '-daily_log' && r.mode === 'live', r.entry)
  })
  // Live path: an explicit cancel is resolved before any model call and discards the slip.
  process.env.META_API_KEY = 'test-key'
  const origFetch = globalThis.fetch
  let fetchCalls = 0
  globalThis.fetch = (async () => { fetchCalls++; return { ok: true, status: 200, json: () => Promise.resolve(textMsg('ok')) } }) as any
  try {
    const rCancel: any = await runLavenderAgent('please cancel that', { currentDate: TODAY, pendingEntry: pend })
    check('live cancel discards without a model call', rCancel.entry == null && rCancel.discardedSlip === true && fetchCalls === 0, { fetchCalls, msg: rCancel.message })
    const rRowsCancel: any = await runLavenderAgent('cancel that', { currentDate: TODAY, pendingEntries: rows })
    check('live cancel also discards pending backfill rows', rRowsCancel.entry == null && rRowsCancel.discardedSlip === true && fetchCalls === 0, { fetchCalls, msg: rRowsCancel.message })
  } finally {
    globalThis.fetch = origFetch
  }

  // Backfill dates written with "the" ("September the 12th") are understood.
  const bfThe = parseLocally('my periods started on September the 12th and October the 10th', TODAY, {})
  const bfDates = ((bfThe.entries || []) as any[]).map((e) => e.date)
  check('backfill accepts "<month> the <day>"', bfDates.indexOf('2026-09-12') !== -1 && bfDates.indexOf('2026-10-10') !== -1, bfDates)

  // A self-contained new message is not glued onto an unrelated open question.
  const fresh2 = parseLocally('exam on Nov 20', TODAY, { openQuestion: 'Which day in September?', priorPrompt: 'I had my period in September' })
  check('new request is not merged with the open question', !(fresh2.activityTrail || []).some((s: any) => s.step === 'Follow-up Context'), fresh2.activityTrail)
}

main().then(() => {
  console.log('\nArch dialogue: ' + passed + ' passed, ' + failed + ' failed.')
  process.exit(failed > 0 ? 1 : 0)
}).catch((err) => { console.error(err); process.exit(1) })
