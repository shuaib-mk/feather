import { parseLocally, runLavenderAgent } from '../backend/agent'
import { SEVERE_FALL_CARE_MESSAGE } from '../backend/guardrail'
import { sendAgentMessage } from '../frontend/aiClient'
import { saveLogEntry, loadCycleData } from '../../client/src/cycleStorage'
import { hi } from '../backend/lexicon/hi'
let passed = 0, failed = 0
function check(name, cond, extra) { if (cond) { console.log('[PASS] ' + name); passed++ } else { console.error('[FAIL] ' + name, extra || ''); failed++ } }
const TODAY = '2026-11-03'
const toolMsg = (calls) => ({ choices: [{ message: { role: 'assistant', content: null, tool_calls: calls } }] })
const textMsg = (content) => ({ choices: [{ message: { role: 'assistant', content: content } }] })
const logCall = (id, args) => ({ id: id, function: { name: 'log_entry', arguments: JSON.stringify(args) } })
async function withLive(responses, fn) {
  process.env.META_API_KEY = 'test-key'
  process.env.META_BASE_URL = 'https://mock.meta.test/v1'
  const orig = globalThis.fetch
  let i = 0
  globalThis.fetch = (async () => { const r = responses[Math.min(i++, responses.length - 1)]; return { ok: true, status: 200, json: () => Promise.resolve(r) } }) as any
  try { await fn() } finally { globalThis.fetch = orig }
}
function mockStorage() {
  const store = {}
  const api = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = String(v) }, removeItem: (k) => { delete store[k] }, clear: () => { for (const k in store) delete store[k] } }
  Object.assign(globalThis, { localStorage: api })
  return store
}
async function main() {
  const EXACT = 'Log my period for today. I had a lot of blood coming and it was fucking painful.'
  const r0 = parseLocally(EXACT, TODAY, {})
  check('exact input slips for today', !!(r0.entry) && r0.entry.date === TODAY && r0.needsClarification === false, r0.entry)
  check('exact input heavy flow mapped', !!(r0.entry) && r0.entry.flow === 'heavy', r0.entry)
  check('exact input pain captured', !!(r0.entry) && (r0.entry.symptoms || []).indexOf('cramps') !== -1, r0.entry)
  check('exact input care plus slip', typeof r0.message === 'string' && r0.message.indexOf('2026-11-03') !== -1, r0.message.slice(0, 80))
  const r1 = parseLocally('I got my period today.', TODAY, {})
  check('casual period log slips', !!(r1.entry) && r1.entry.date === TODAY && r1.entry.kind === 'period_started', r1.entry)
  const r2 = parseLocally('I have been bleeding since yesterday.', TODAY, {})
  check('relative yesterday slips', !!(r2.entry) && r2.entry.date === '2026-11-02' && r2.entry.kind === 'period_started', r2.entry)
  const r3 = parseLocally('Started bleeding this morning.', TODAY, {})
  check('started bleeding slips', !!(r3.entry) && r3.entry.date === TODAY && r3.entry.kind === 'period_started', r3.entry)
  const r4 = parseLocally('bleeding heavily today', TODAY, {})
  check('natural heavy description maps', !!(r4.entry) && r4.entry.flow === 'heavy', r4.entry)
  const r5 = parseLocally('I am in a lot of pain today', TODAY, {})
  check('pain description captured', !!(r5.entry) && (r5.entry.symptoms || []).indexOf('cramps') !== -1, r5.entry)
  const r6 = parseLocally('Log today, the bleeding is heavy and painful.', TODAY, {})
  check('multi detail one sentence', !!(r6.entry) && r6.entry.date === TODAY && r6.entry.flow === 'heavy' && (r6.entry.symptoms || []).indexOf('cramps') !== -1, r6.entry)
  const pend: any = { date: TODAY, flow: 'heavy', symptoms: ['cramps'], mood: null, energy: null, sleep: null, notes: 'x', kind: 'daily_log' }
  const r7 = parseLocally('My flow was actually light.', TODAY, { pendingEntry: pend })
  check('correction edits pending slip', !!(r7.entry) && r7.entry.flow === 'light' && (r7.entry.symptoms || []).indexOf('cramps') !== -1 && r7.replacesExisting === true, r7.entry)
  const r8 = parseLocally('My period started and the flow is quite heavy.', TODAY, {})
  check('dateless asks instead of inventing', r8.entry == null && r8.needsClarification === true && (r8.message || '').trim() !== '', r8.message)
  await withLive([toolMsg([logCall('m1', { date: TODAY, flow: 'heavy', symptoms: ['cramps'], kind: 'daily_log' })]), textMsg('Logged for today.')], async () => {
    const r = await runLavenderAgent(EXACT, { currentDate: TODAY })
    check('live keeps validated heavy slip', !!(r.entry) && r.entry.flow === 'heavy' && (r.entry.symptoms || []).indexOf('cramps') !== -1, r.entry)
    check('live severe input shows care', typeof r.message === 'string' && r.message.indexOf('please get help now') !== -1, r.message.slice(0, 60))
  })
  const eorig = globalThis.fetch
  globalThis.fetch = (async () => ({ ok: true, status: 200, json: () => Promise.resolve({ choices: [{ message: { role: 'assistant', content: '' } }] }) })) as any
  const re = await runLavenderAgent('I got my period today and I am in a lot of pain.', { currentDate: TODAY })
  globalThis.fetch = eorig
  check('empty model falls back to slip', re.mode === 'offline' && !!(re.entry) && re.entry.date === TODAY, re.message)
  const uorig = globalThis.fetch
  globalThis.fetch = (async () => { throw new Error('network down') }) as any
  const ru = await sendAgentMessage('I got my period today.', { currentDate: TODAY }, [])
  globalThis.fetch = uorig
  check('unavailable model falls back offline', ru.isOfflineFallback === true && !!(ru.entry) && ru.entry.date === TODAY, ru.message)
  check('hindi heavy mapping present', hi.flow.heavy.some((p) => p === '\u092c\u0939\u0941\u0924 \u0916\u0942\u0928'), 'hi heavy')

  const hd = parseLocally('\u0906\u091c \u0915\u092e\u0930 \u0926\u0930\u094d\u0926 \u0939\u0948', TODAY, {})

  check('hindi compound pain maps once', !!(hd.entry) && (hd.entry.symptoms || []).indexOf('backache') !== -1 && (hd.entry.symptoms || []).indexOf('cramps') === -1, hd.entry)
  mockStorage()
  const pre = loadCycleData()
  check('parsing alone saves nothing', (pre.logs || []).length === 0, pre.logs.length)
  const sv = saveLogEntry({ logDate: TODAY, flow: 'heavy', symptoms: ['cramps'], mood: null, energy: null, sleepHours: null, notes: 'confirm path', kind: 'period_started' }, { kind: 'period_started' })
  const post = loadCycleData()
  check('confirm saves exactly one', sv && sv.saved !== false && post.logs.filter((l) => l.logDate === TODAY).length === 1, post.logs.length)
  const working = globalThis.localStorage
  const throwing = { getItem: working.getItem, removeItem: working.removeItem, clear: working.clear, setItem: () => { throw new Error('QuotaExceededError') } }
  Object.assign(globalThis, { localStorage: throwing })
  let fres = null
  let fthrew = false
  try { fres = saveLogEntry({ logDate: TODAY, flow: 'heavy', symptoms: [], mood: null, energy: null, sleepHours: null, notes: null, kind: 'daily_log' }, {}) } catch { fthrew = true }
  Object.assign(globalThis, { localStorage: working })
  check('storage failure reports reason', fthrew === false && fres && fres.saved === false && typeof fres.error === 'string', fres)
  Object.assign(globalThis, { localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} } })
  const cancelled = loadCycleData()
  check('cancelled slip saves nothing', (cancelled.logs || []).length === 0, cancelled.logs.length)
  console.log('ArchNatural Results: ' + passed + ' passed, ' + failed + ' failed.')
  if (failed > 0) process.exit(1)
}
main()




