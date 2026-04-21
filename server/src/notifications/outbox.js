const { Op } = require('sequelize');
const { NotificationOutbox } = require('../models');
const { dispatchDomainEventNow } = require('./index');

const MAX_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 3000;
const LOCK_STALE_MS = 60 * 1000;

let dispatcherTimer = null;
let dispatcherRunning = false;

function computeNextAvailableAt(attemptCount) {
  const backoffMs = Math.min(15 * 60 * 1000, 5000 * (2 ** Math.max(0, attemptCount - 1)));
  return new Date(Date.now() + backoffMs);
}

async function enqueueDomainEvent(eventType, payload, options = {}) {
  return NotificationOutbox.create({
    event_type: eventType,
    payload,
    status: 'pending',
    available_at: new Date()
  }, {
    transaction: options.transaction
  });
}

async function claimPendingRows(limit = 10) {
  const now = new Date();
  const staleLockDate = new Date(Date.now() - LOCK_STALE_MS);

  const candidates = await NotificationOutbox.findAll({
    where: {
      [Op.or]: [
        {
          status: 'pending',
          available_at: {
            [Op.lte]: now
          }
        },
        {
          status: 'processing',
          locked_at: {
            [Op.lte]: staleLockDate
          }
        }
      ]
    },
    order: [['id', 'ASC']],
    limit
  });

  const claimedRows = [];

  for (const row of candidates) {
    const [affectedRows] = await NotificationOutbox.update({
      status: 'processing',
      locked_at: new Date(),
      last_error: null
    }, {
      where: {
        id: row.id,
        status: row.status
      }
    });

    if (affectedRows > 0) {
      claimedRows.push(await NotificationOutbox.findByPk(row.id));
    }
  }

  return claimedRows.filter(Boolean);
}

async function processOutboxRow(row) {
  try {
    await dispatchDomainEventNow(row.event_type, row.payload);
    await row.update({
      status: 'completed',
      dispatched_at: new Date(),
      locked_at: null,
      last_error: null
    });
  } catch (error) {
    const nextAttemptCount = Number(row.attempt_count || 0) + 1;
    const nextStatus = nextAttemptCount >= MAX_ATTEMPTS ? 'failed' : 'pending';

    await row.update({
      status: nextStatus,
      attempt_count: nextAttemptCount,
      available_at: computeNextAvailableAt(nextAttemptCount),
      locked_at: null,
      last_error: error?.stack || error?.message || 'unknown_error'
    });
  }
}

async function processPendingNotificationOutbox() {
  if (dispatcherRunning) {
    return;
  }

  dispatcherRunning = true;
  try {
    const rows = await claimPendingRows();
    for (const row of rows) {
      await processOutboxRow(row);
    }
  } finally {
    dispatcherRunning = false;
  }
}

function startNotificationOutboxDispatcher() {
  if (dispatcherTimer) {
    return;
  }

  dispatcherTimer = setInterval(() => {
    processPendingNotificationOutbox().catch((error) => {
      console.error('Process notification outbox failed:', error);
    });
  }, POLL_INTERVAL_MS);

  processPendingNotificationOutbox().catch((error) => {
    console.error('Initial notification outbox processing failed:', error);
  });
}

function stopNotificationOutboxDispatcher() {
  if (!dispatcherTimer) {
    return;
  }

  clearInterval(dispatcherTimer);
  dispatcherTimer = null;
}

module.exports = {
  enqueueDomainEvent,
  processPendingNotificationOutbox,
  startNotificationOutboxDispatcher,
  stopNotificationOutboxDispatcher
};
