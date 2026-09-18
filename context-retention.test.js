/**
 * V7.7.10g context retention preview helpers.
 * Run: node --test context-retention.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PREVIEW_TOOL,
  RETENTION_SCHEMA,
  buildPreviewArgs,
  compileRetentionCard,
  summarizeRetentionCard
} from './context-retention.js';

const root = join(dirname(fileURLToPath(import.meta.url)));

test('missing tool returns fail-closed honesty', () => {
  const card = compileRetentionCard({}, { toolsAvailable: false });
  assert.equal(card.ok, false);
  assert.equal(card.error, 'tool_unavailable');
  assert.equal(card.accepted_state_authority, false);
  assert.equal(card.storage_deleted, false);
  assert.match(card.honesty, /10g retention preview tool is not on this runtime/i);
  assert.match(card.honesty, /never invents PIN\/DROP/i);
});

test('preview args allowlist strips extras and keeps only allowed keys', () => {
  assert.deepEqual(buildPreviewArgs({
    actor_id: 'console:jared',
    candidates: [{ object_ref: 'secret://pin', class: 'secret_pin', action: 'PIN' }, ['bad-row']],
    items: [{ object_ref: 'repo://x', class: 'repo_read', action: 'KEEP_REF' }],
    accepted_state_authority: true,
    set_head: true
  }), {
    actor_id: 'console:jared',
    candidates: [{ object_ref: 'secret://pin', class: 'secret_pin', action: 'PIN' }],
    items: [{ object_ref: 'repo://x', class: 'repo_read', action: 'KEEP_REF' }]
  });
});

test('PIN decision line renders and summary includes storage deleted false', () => {
  const card = compileRetentionCard({
    ok: true,
    decisions: [
      { action: 'PIN', class: 'secret_pin', reason: 'Active credential fingerprint pending rotation.' },
      { action: 'KEEP_REF', class: 'repo_read', reason: 'Reference-only repository metadata.' }
    ]
  }, { toolsAvailable: true });
  assert.equal(card.ok, true);
  assert.equal(card.tool, PREVIEW_TOOL);
  assert.equal(card.schema, RETENTION_SCHEMA);
  assert.equal(card.accepted_state_authority, false);
  assert.equal(card.storage_deleted, false);
  assert.ok(card.lines.some(line => /PIN · secret_pin · Active credential fingerprint pending rotation\./.test(line)));
  assert.match(summarizeRetentionCard(card), /Storage deleted: false/);
});

test('error-only payload stays blocked', () => {
  const card = compileRetentionCard({ error: 'worker failed' }, { toolsAvailable: true });
  assert.equal(card.ok, false);
  assert.equal(card.title, 'Retention preview blocked');
});

test('module and wiring avoid head mutation calls', () => {
  const source = readFileSync(join(root, 'context-retention.js'), 'utf8');
  const app = readFileSync(join(root, 'app.js'), 'utf8');
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(source, /set_head|set_path_head/);
  assert.match(app, /buildPreviewArgs|compileRetentionCard|summarizeRetentionCard/);
  assert.match(app, /retentionPreviewButton|retentionResult/);
  assert.match(html, /data-cairn-target="work\.retention"/);
  assert.match(html, /id="retentionPreviewButton"/);
  assert.match(html, /id="retentionResult"/);
});
