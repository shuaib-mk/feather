import { parseLocally, runLavenderAgent } from '../backend/agent'
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
async function main() {
  await withLive([toolMsg([logCall('b1', { date: TODAY, kind: 'period_started' })]), textMsg('Logged.')], async () => {
    const r = await runLavenderAgent('I got my period today', { currentDate: TODAY })
    check('live slip kept, message preserved', !!(r.entry) && r.entry.date === TODAY && r.message === 'Logged.', r)
    check('live slip is live mode', r.mode === 'live', r.mode)
    check('model invoke diagnostic recorded', (r.activityTrail || []).some((a) => a.step === 'Model Invoke'), r.activityTrail)
  })
  await withLive([toolMsg([logCall('c1', { date: TODAY, kind: 'daily_log', symptoms: ['cramps'] }), { id: 'c2', function: { name: 'get_cycle_history', arguments: '{}' } }]), textMsg('Noted cramps.')], async () => {
    const r = await runLavenderAgent('I have cramps today', { currentDate: TODAY })
    const names = (r.toolCalls || []).map((c) => c.toolName)
    check('multi-tool turn honors every call', names.indexOf('log_entry') !== -1 && names.indexOf('get_cycle_history') !== -1, names)
    check('symptom slip kept', !!(r.entry) && (r.entry.symptoms || []).indexOf('cramps') !== -1, r.entry)
  })
  await withLive([toolMsg([logCall('d1', { date: '2027-01-01', kind: 'period_started' })]), textMsg('All set, logged.')], async () => {
    const r = await runLavenderAgent('period started', { currentDate: TODAY })
    check('invalid tool args never fake success', r.entry == null && r.message.indexOf('could not save') !== -1 && r.message.indexOf('All set') === -1, r.message)
  })
  const seen = []
  process.env.META_API_KEY = 'test-key'
  const origFetch = globalThis.fetch
  globalThis.fetch = (async (url, opts) => { seen.push(JSON.parse(opts.body)); return { ok: true, status: 200, json: () => Promise.resolve(textMsg('Still here.')) } }) as any
  const hist = [{ role: 'user', content: 'I got my period yesterday' }, { role: 'assistant', content: 'Noted.' }] as any
  await runLavenderAgent('It was quite heavy.', { currentDate: TODAY }, hist)
  globalThis.fetch = origFetch
  const sent = seen.length ? seen[0].messages : []
  const hasHist = sent.some((m) => m.content === 'I got my period yesterday') && sent.some((m) => m.content === 'It was quite heavy.')
  check('history forwarded to model', sent.length >= 4 && hasHist, sent.length)
  await withLive([textMsg('Which date did you mean, yesterday or today?')], async () => {
    const r = await runLavenderAgent('I have cramps', { currentDate: TODAY })
    check('clarifying question invents nothing', r.needsClarification === true && r.entry == null && (r.message || '').indexOf('Which date') !== -1, r.message)
  })
  const e1 = parseLocally('period started August 31', TODAY, {})
  check('explicit period prefers most recent past', !!(e1.entry) && e1.entry.date === '2026-08-31' && e1.entry.kind === 'period_started', e1.entry)
  const e2 = parseLocally('period started August 31 2026', TODAY, {})
  check('explicit year preserved', !!(e2.entry) && e2.entry.date === '2026-08-31', e2.entry)
  const e3 = parseLocally('Log for August 31', TODAY, {})
  check('bare log verb prepares period slip', !!(e3.entry) && e3.entry.date === '2026-08-31' && e3.entry.kind === 'period_started', e3.entry)
  console.log('ArchPrimary Results: ' + passed + ' passed, ' + failed + ' failed.')
  if (failed > 0) process.exit(1)
}
main()



