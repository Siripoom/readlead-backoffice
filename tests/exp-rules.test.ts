import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bangkokDayKey,
  bangkokWeekStart,
  buildExpAlerts,
  EXP_LEVELS,
  expProgress,
  FREE_WEEK_MAX,
  levelForExp,
  voteFanTotals,
  weeklyCapMeters,
  type ExpEntryLike,
} from '../lib/exp-rules'

test('EXP levels change exactly at the canonical thresholds', () => {
  for (const [index, level] of EXP_LEVELS.entries()) {
    assert.equal(levelForExp(level.minExp).level, level.level)
    if (index > 0) assert.equal(levelForExp(level.minExp - 1).level, EXP_LEVELS[index - 1].level)
  }
  assert.deepEqual(expProgress(199).next, EXP_LEVELS[1])
  assert.equal(expProgress(158_000).percent, 100)
})

test('Bangkok day and Monday week boundaries are stable', () => {
  assert.equal(bangkokDayKey('2026-08-05T16:59:59.000Z'), '2026-08-05')
  assert.equal(bangkokDayKey('2026-08-05T17:00:00.000Z'), '2026-08-06')
  assert.equal(bangkokWeekStart('2026-08-05T05:00:00.000Z').toISOString(), '2026-08-02T17:00:00.000Z')
})

test('weekly meters count granted and pending entries from Monday only', () => {
  const entries: ExpEntryLike[] = [
    { userId: 'u1', amount: 20, action: 'comment', status: 'granted', createdAt: '2026-08-03T02:00:00.000Z' },
    { userId: 'u1', amount: 10, action: 'comment', status: 'pending', createdAt: '2026-08-04T02:00:00.000Z' },
    { userId: 'u1', amount: 50, action: 'comment', status: 'rejected', createdAt: '2026-08-04T03:00:00.000Z' },
    { userId: 'u1', amount: 70, action: 'comment', status: 'granted', createdAt: '2026-08-02T10:00:00.000Z' },
  ]
  const comment = weeklyCapMeters(entries, '2026-08-05T05:00:00.000Z').find((meter) => meter.action === 'comment')
  assert.equal(comment?.used, 30)
  assert.equal(comment?.cap, 70)
})

test('all four EXP warning rules are produced and critical alerts sort first', () => {
  const now = new Date('2026-08-05T05:00:00.000Z')
  const accounts = [
    { userId: 'mismatch', userName: 'Mismatch', balance: 10, joinedAt: '2026-01-01T00:00:00.000Z' },
    { userId: 'rapid', userName: 'Rapid', balance: 1_200, joinedAt: '2026-01-01T00:00:00.000Z' },
    { userId: 'free', userName: 'Free', balance: FREE_WEEK_MAX + 1, joinedAt: '2026-01-01T00:00:00.000Z' },
    { userId: 'bot', userName: 'Bot', balance: 331, joinedAt: '2026-01-01T00:00:00.000Z' },
    { userId: 'new', userName: 'New', balance: 600, joinedAt: '2026-08-03T05:00:00.000Z' },
  ]
  const entries: ExpEntryLike[] = [
    { userId: 'mismatch', amount: 5, action: 'tip', status: 'granted', createdAt: '2026-08-01T00:00:00.000Z' },
    { userId: 'rapid', amount: 1_200, action: 'tip', status: 'granted', createdAt: '2026-08-05T04:00:00.000Z' },
    { userId: 'free', amount: FREE_WEEK_MAX + 1, action: 'read5min', status: 'granted', createdAt: '2026-08-05T04:00:00.000Z' },
    { userId: 'bot', amount: 240, action: 'readFree', status: 'granted', createdAt: '2026-08-04T00:00:00.000Z' },
    { userId: 'bot', amount: 70, action: 'comment', status: 'granted', createdAt: '2026-08-04T00:00:00.000Z' },
    { userId: 'bot', amount: 21, action: 'dailyLogin', status: 'granted', createdAt: '2026-08-04T00:00:00.000Z' },
    { userId: 'new', amount: 600, action: 'tip', status: 'granted', createdAt: '2026-08-04T00:00:00.000Z' },
  ]
  const alerts = buildExpAlerts(accounts, entries, now)
  assert.ok(alerts.some((alert) => alert.type === 'mismatch'))
  assert.ok(alerts.some((alert) => alert.type === 'rapid-growth'))
  assert.ok(alerts.some((alert) => alert.type === 'free-cap'))
  assert.ok(alerts.some((alert) => alert.type === 'bot-like'))
  assert.ok(alerts.some((alert) => alert.type === 'new-account'))
  const firstWarning = alerts.findIndex((alert) => alert.severity === 'warning')
  assert.ok(alerts.slice(0, firstWarning).every((alert) => alert.severity === 'critical'))
})

test('vote and fan totals apply compensating revocations without going negative', () => {
  const totals = voteFanTotals([
    { type: 'vote_free', amount: -5 },
    { type: 'vote_month', amount: -2 },
    { type: 'tip', amount: 100 },
    { type: 'revoke', amount: 0, metadata: { freeVotes: 3, monthlyVotes: 1, coins: 40 } },
  ])
  assert.deepEqual(totals, { freeVotes: 2, monthlyVotes: 1, coins: 60, fanPoints: 77 })
  assert.deepEqual(voteFanTotals([{ type: 'revoke', amount: 0, metadata: { freeVotes: 99, monthlyVotes: 99, coins: 99 } }]), {
    freeVotes: 0, monthlyVotes: 0, coins: 0, fanPoints: 0,
  })
})
