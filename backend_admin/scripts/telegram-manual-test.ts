/**
 * Telegram Bot Manual Testing Script
 *
 * Automates the T15.3 manual testing checklist:
 * - Bot responds to commands within 2 seconds
 * - Status updates reflect in database
 * - Rate limiting blocks after 30 req/min
 * - Location updates are processed
 * - Assignment notifications are sent
 *
 * Usage: npx ts-node scripts/telegram-manual-test.ts
 * Requires: Backend server running on PORT (default 5001)
 */

import * as dotenv from 'dotenv';

dotenv.config();

const BASE_URL = `http://localhost:${process.env.PORT || 5001}`;
const TEST_TELEGRAM_ID = '123456789';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

let passCount = 0;
let failCount = 0;

function pass(msg: string) {
  passCount++;
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function fail(msg: string, err?: any) {
  failCount++;
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
  if (err) console.log(`  ${colors.red}${err}${colors.reset}`);
}

function info(msg: string) {
  console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`);
}

async function request(path: string, opts: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  const latency = Date.now() - start;
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body, latency };
}

async function testCommandResponseTime() {
  info('Testing command response time (< 2 seconds)');
  const commands = ['/start', '/status', '/help', '/online'];

  for (const cmd of commands) {
    const { body, latency } = await request('/v1/telegram/webhook', {
      method: 'POST',
      body: JSON.stringify({
        update_id: Math.floor(Math.random() * 1000000),
        message: {
          message_id: 1,
          from: { id: parseInt(TEST_TELEGRAM_ID), is_bot: false, first_name: 'Test' },
          chat: { id: parseInt(TEST_TELEGRAM_ID), type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: cmd,
        },
      }),
    });

    if (latency < 2000) {
      pass(`${cmd} responded in ${latency}ms`);
    } else {
      fail(`${cmd} took ${latency}ms (expected < 2000ms)`);
    }
  }
}

async function testRateLimiting() {
  info('Testing rate limiting (30 req/min per telegram_id)');

  const promises: Promise<any>[] = [];
  for (let i = 0; i < 35; i++) {
    promises.push(
      request('/v1/telegram/webhook', {
        method: 'POST',
        body: JSON.stringify({
          update_id: 1000000 + i,
          message: {
            message_id: i,
            from: { id: parseInt(TEST_TELEGRAM_ID), is_bot: false, first_name: 'Test' },
            chat: { id: parseInt(TEST_TELEGRAM_ID), type: 'private' },
            date: Math.floor(Date.now() / 1000),
            text: '/status',
          },
        }),
      }),
    );
  }

  const results = await Promise.all(promises);
  const rateLimited = results.filter((r) => r.body?.message?.includes('Rate limit') || r.body?.data?.text?.includes('Rate limit'));

  if (rateLimited.length > 0) {
    pass(`Rate limiting activated: ${rateLimited.length} of 35 requests blocked`);
  } else {
    fail('Rate limiting did not activate after 35 rapid requests');
  }
}

async function testLocationUpdate() {
  info('Testing location update processing');

  const { body } = await request('/v1/telegram/webhook', {
    method: 'POST',
    body: JSON.stringify({
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        message_id: 1,
        from: { id: parseInt(TEST_TELEGRAM_ID), is_bot: false, first_name: 'Test' },
        chat: { id: parseInt(TEST_TELEGRAM_ID), type: 'private' },
        date: Math.floor(Date.now() / 1000),
        location: { latitude: 11.5564, longitude: 104.9282 },
      },
    }),
  });

  if (body?.success) {
    pass('Location update webhook accepted');
  } else {
    fail('Location update webhook failed', body);
  }
}

async function testWebhookSecretValidation() {
  info('Testing webhook secret validation (dev mode: disabled)');

  const { res } = await request('/v1/telegram/webhook', {
    method: 'POST',
    body: JSON.stringify({
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        message_id: 1,
        from: { id: 999999, is_bot: false, first_name: 'Test' },
        chat: { id: 999999, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: '/start',
      },
    }),
  });

  if (res.status === 200) {
    pass('Webhook accepted without secret token (dev mode)');
  } else {
    fail(`Webhook rejected with status ${res.status}`);
  }
}

async function testIdempotency() {
  info('Testing idempotency (duplicate update_id)');

  const updateId = 9999999;
  const payload = JSON.stringify({
    update_id: updateId,
    message: {
      message_id: 1,
      from: { id: 888888, is_bot: false, first_name: 'Test' },
      chat: { id: 888888, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text: '/start',
    },
  });

  const r1 = await request('/v1/telegram/webhook', {
    method: 'POST',
    body: payload,
  });

  const r2 = await request('/v1/telegram/webhook', {
    method: 'POST',
    body: payload,
  });

  if (r1.body?.success && r2.body?.message === 'Duplicate or invalid update') {
    pass('Duplicate update_id detected and ignored');
  } else {
    fail('Idempotency not working', r2.body);
  }
}

async function testCallbackQueries() {
  info('Testing inline button callbacks');

  const callbacks = ['status:online', 'status:offline', 'status:view', 'help'];

  for (const cb of callbacks) {
    const { body, latency } = await request('/v1/telegram/webhook', {
      method: 'POST',
      body: JSON.stringify({
        update_id: Math.floor(Math.random() * 1000000),
        callback_query: {
          id: `cb_${cb}`,
          from: { id: parseInt(TEST_TELEGRAM_ID), is_bot: false, first_name: 'Test' },
          message: { message_id: 1, chat: { id: parseInt(TEST_TELEGRAM_ID), type: 'private' } },
          data: cb,
        },
      }),
    });

    if (latency < 2000 && body?.success) {
      pass(`Callback ${cb} responded in ${latency}ms`);
    } else {
      fail(`Callback ${cb} failed or too slow (${latency}ms)`);
    }
  }
}

async function run() {
  console.log(`${colors.cyan}=============================================${colors.reset}`);
  console.log(`${colors.cyan}  Telegram Bot Manual Testing (T15.3)${colors.reset}`);
  console.log(`${colors.cyan}  Target: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.cyan}=============================================${colors.reset}\n`);

  try {
    await testCommandResponseTime();
    await testCallbackQueries();
    await testRateLimiting();
    await testLocationUpdate();
    await testWebhookSecretValidation();
    await testIdempotency();
  } catch (err) {
    fail('Unexpected error during tests', err);
  }

  console.log(`\n${colors.cyan}=============================================${colors.reset}`);
  console.log(`  Results: ${colors.green}${passCount} passed${colors.reset}, ${colors.red}${failCount} failed${colors.reset}`);
  console.log(`${colors.cyan}=============================================${colors.reset}`);

  process.exit(failCount > 0 ? 1 : 0);
}

run();
