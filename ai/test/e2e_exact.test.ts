import { parseLocally, runLavenderAgent } from '../backend/agent'
import { sendAgentMessage } from '../frontend/aiClient'
let passed = 0, failed = 0
function check(name, cond, extra) { if (cond) { console.log('[PASS] ' + name); passed++ } else { console.error('[FAIL] ' + name, extra || ''); failed++ } }
const TODAY = '2026-11-03'
async function main() {
  const off = parseLocally('log for august 31', TODAY, {})
  check('offline exact never blank', !!(off.message || '').trim(), off.message)
  check('offline exact prepares period slip', !!(off.entry) && off.entry.date === '2026-08-31' && off.entry.kind === 'period_started' && off.needsClarification === false && off.message.indexOf('2026-08-31') !== -1, off.message)
  const off2 = parseLocally('Log my period for August 31.', TODAY, {})
  check('offline period-for-date slip', !!(off2.entry) && off2.entry.date === '2026-08-31' && off2.entry.kind === 'period_started', off2.entry)
  process.env.META_API_KEY = 'test-key'
  process.env.META_BASE_URL = 'https://mock.meta.test/v1'
  const orig = globalThis.fetch
  globalThis.fetch = (() => ({ ok: true, status: 200, json: () => Promise.resolve({ choices: [{ message: { role: 'assistant', content: '' } }] }) })) as any
  const liveEmpty = await runLavenderAgent('log for august 31', { currentDate: TODAY })
  check('live-empty exact never blank', !!(liveEmpty.message || '').trim(), liveEmpty.message)
  check('live-empty exact falls back offline with slip', liveEmpty.mode === 'offline' && !!(liveEmpty.entry) && liveEmpty.entry.date === '2026-08-31' && liveEmpty.entry.kind === 'period_started', liveEmpty.entry)
  const liveEmpty2 = await runLavenderAgent('Log my period for August 31.', { currentDate: TODAY })
  check('live-empty period-for-date slip via fallback', !!(liveEmpty2.entry) && liveEmpty2.entry.date === '2026-08-31', liveEmpty2.entry)
  globalThis.fetch = (() => ({ ok: true, status: 200, json: () => Promise.resolve({ message: '', entry: null, needsClarification: false, activityTrail: [], toolCalls: [] }) })) as any
  const viaClient = await sendAgentMessage('log for august 31', { currentDate: TODAY }, [])
  check('client blank-live falls back offline', !!(viaClient.message || '').trim() && viaClient.isOfflineFallback === true, viaClient.message)
  globalThis.fetch = orig
  const conv = parseLocally('Hi, how are you', TODAY, {})
  check('conversation creates no log', conv.entry == null && !!(conv.message || '').trim(), conv.message)
  console.log('Exact Results: ' + passed + ' passed, ' + failed + ' failed.')
  if (failed > 0) process.exit(1)
}
main()




