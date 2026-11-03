import { parseLocally, runLavenderAgent } from '../backend/agent'
let passed = 0, failed = 0
function check(name, cond, extra) { if (cond) { console.log('[PASS] ' + name); passed++ } else { console.error('[FAIL] ' + name, extra || ''); failed++ } }
const TODAY = '2026-11-03'
const toolMsg = (calls) => ({ choices: [{ message: { role: 'assistant', content: null, tool_calls: calls } }] })
const textMsg = (content) => ({ choices: [{ message: { role: 'assistant', content: content } }] })
async function withLive(responses, fn) {
  process.env.META_API_KEY = 'test-key'
  process.env.META_BASE_URL = 'https://mock.meta.test/v1'
  const orig = globalThis.fetch
  let i = 0
  globalThis.fetch = (async () => { const r = responses[Math.min(i++, responses.length - 1)]; return { ok: true, status: 200, json: () => Promise.resolve(r) } }) as any
  try { await fn() } finally { globalThis.fetch = orig }
}
async function main() {
  const h1 = parseLocally('Log for August 31', TODAY, {})
  check('headline slip shape', !!(h1.entry) && h1.entry.date === '2026-08-31' && h1.entry.kind === 'period_started' && h1.responseType === 'log', h1.entry)
  check('headline confirm card message', h1.needsClarification === false && h1.message.indexOf('2026-08-31') !== -1 && h1.message.indexOf('review and confirm') !== -1, h1.message)
  const h2 = parseLocally('Log for October 15', TODAY, {})
  check('recent historical date slips', !!(h2.entry) && h2.entry.date === '2026-10-15' && h2.entry.kind === 'period_started', h2.entry)
  const f1 = parseLocally('Log for December 25', TODAY, {})
  check('future month-day never logs', f1.entry == null && (f1.message || '').trim() !== '', f1.message)
  const f2 = parseLocally('Log for August 31 2027', TODAY, {})
  check('explicit future year never logs', f2.entry == null && (f2.entries || []).length === 0 && f2.message.indexOf('2027-08-31') !== -1, f2.message)
  const g1 = parseLocally('Hello', TODAY, {})
  check('offline bare greeting conversational', g1.entry == null && g1.responseType === 'conversation' && (g1.message || '').trim() !== '', g1.message)
  await withLive([textMsg('Hello! Great to see you.')], async () => {
    const r = await runLavenderAgent('Hello', { currentDate: TODAY })
    check('greeting reaches Muse live', r.mode === 'live' && r.entry == null && (r.message || '').indexOf('Great to see you') !== -1, r.message)
  })
  await withLive([textMsg('I can help with logging, history questions and planning.')], async () => {
    const r = await runLavenderAgent('What can you do?', { currentDate: TODAY })
    check('follow-up question reaches Muse live', r.mode === 'live' && r.entry == null && r.entries == null, r.message)
  })
  console.log('ArchRefine Results: ' + passed + ' passed, ' + failed + ' failed.')
  if (failed > 0) process.exit(1)
}
main()

