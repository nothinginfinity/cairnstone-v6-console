/**
 * Unit tests for V7.7.10b Give Access / Assign / Forward helpers.
 * Run: node --test access-share.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  ACCESS_GRANT_TOOLS,
  GRANT_PERMISSIONS,
  HUMAN_COMMIT_OPS,
  parseObjectRef,
  formatObjectRef,
  objectRefFromMessage,
  objectRefFromStone,
  objectRefFromRepo,
  objectRefFromCodeSession,
  objectRefFromResponse,
  permissionImpliesExecute,
  permissionLabel,
  grantStatusLabel,
  buildAccessGrantProposal,
  buildAssignProposal,
  buildForwardWithNotePayload,
  buildRevokeProposal,
  isToolMissingError,
  toolMissingHonesty,
  summarizeProposalCard,
  localResolveAttachment,
  entrySurfaces,
  assertShareNeverMovesHeads
} from './access-share.js';

const root = join(dirname(fileURLToPath(import.meta.url)));

test('canonical object refs parse and format', () => {
  assert.deepEqual(parseObjectRef('msg:abc-123'), { kind: 'msg', id: 'abc-123', raw: 'msg:abc-123' });
  assert.equal(formatObjectRef('stone', 'deadbeef'), 'stone:deadbeef');
  assert.equal(parseObjectRef('not-a-ref'), null);
  assert.equal(formatObjectRef('stone', ''), null);
});

test('builders from message / stone / repo / session / response', () => {
  const msg = objectRefFromMessage({ message_id: 'm1', stone_hash: 'h1', subject: 'Hello' });
  assert.equal(msg.object_ref, 'msg:m1');
  assert.deepEqual(msg.secondary_refs, ['stone:h1']);

  const stone = objectRefFromStone({ hash: 'aabb', title: 'T', repo: 'org/r', commit: 'c'.repeat(40) });
  assert.equal(stone.object_ref, 'stone:aabb');
  assert.ok(stone.secondary_refs[0].startsWith('repo:org/r@'));

  assert.equal(objectRefFromRepo({ repo: 'a/b', commit_sha: 'sha1' }).object_ref, 'repo:a/b@sha1');
  assert.equal(objectRefFromCodeSession('cs:1').object_ref, 'session:cs:1');
  assert.equal(objectRefFromResponse({ response_id: 'gr:9' }).object_ref, 'response:gr:9');
});

test('Give Access proposal requires human Commit and does not imply execute', () => {
  const bad = buildAccessGrantProposal({});
  assert.equal(bad.ok, false);
  assert.equal(bad.human_commit_required, true);

  const good = buildAccessGrantProposal({
    object_ref: 'msg:m1',
    principal_actor_id: 'grok:cairnstone-v6',
    permission: 'read',
    grantor_actor_id: 'console:jared',
    notify: true
  });
  assert.equal(good.ok, true);
  assert.equal(good.mcp_tool, ACCESS_GRANT_TOOLS.create);
  assert.equal(good.duplicates_payload, false);
  assert.equal(good.accepted_state_authority, false);
  assert.equal(good.permission_implies_execute, false);
  assert.equal(permissionImpliesExecute('execute-against'), false);
  assert.match(permissionLabel('read'), /visibility only/i);
  assert.ok(GRANT_PERMISSIONS.includes('discuss'));
});

test('Assign creates Task Run proposal over same refs without auto-dispatch', () => {
  const p = buildAssignProposal({
    object_refs: ['msg:m1', 'stone:h1'],
    assignee_actor_id: 'claude:cairnstone-v6',
    requester_actor_id: 'console:jared',
    task: 'Please review'
  });
  assert.equal(p.ok, true);
  assert.equal(p.auto_dispatch, false);
  assert.equal(p.grants_access, false);
  assert.equal(p.status, 'proposed');
  assert.deepEqual(p.args.attachment_refs, ['msg:m1', 'stone:h1']);
  assert.equal(p.mcp_tool, ACCESS_GRANT_TOOLS.taskRunPropose);
  assert.ok(HUMAN_COMMIT_OPS.includes('assign-proposal'));
});

test('Forward with note builds AC1 referencing original object_ref', () => {
  const f = buildForwardWithNotePayload({
    from: 'console:jared',
    to: ['claude:cairnstone-v6'],
    note: 'FYI — please see this.',
    original_object_ref: 'msg:m1'
  });
  assert.equal(f.ok, true);
  assert.equal(f.mcp_tool, 'cairnstone_send_message');
  assert.equal(f.creates_new_correspondence, true);
  assert.match(f.args.content, /msg:m1/);
  assert.match(f.args.content, /Forward with note/);
  assert.doesNotMatch(f.args.content, /Give Access creates/);
});

test('Revoke is future-access-only', () => {
  const r = buildRevokeProposal({ grant_id: 'ag:1', actor_id: 'console:jared' });
  assert.equal(r.ok, true);
  assert.equal(r.future_access_only, true);
  assert.equal(r.erases_already_read, false);
  assert.equal(grantStatusLabel('revoked'), 'Revoked (future access blocked)');
});

test('tool missing honesty and local attachment resolve', () => {
  assert.equal(isToolMissingError(new Error('Unknown tool: cairnstone_access_grant_create')), true);
  assert.equal(isToolMissingError(new Error('network down')), false);
  const h = toolMissingHonesty(ACCESS_GRANT_TOOLS.create);
  assert.equal(h.available, false);
  assert.match(h.body, /0\.5\.40/);
  const local = localResolveAttachment('stone:abc');
  assert.equal(local.ok, true);
  assert.equal(local.resolved_locally, true);
  assert.equal(localResolveAttachment('nope').ok, false);
});

test('proposal card summary and entry surfaces', () => {
  const card = summarizeProposalCard(buildAccessGrantProposal({
    object_ref: 'msg:m1',
    principal_actor_id: 'grok:cairnstone-v6',
    permission: 'discuss',
    grantor_actor_id: 'console:jared'
  }));
  assert.match(card.title, /Commit/i);
  assert.ok(card.lines.some(l => /discuss/.test(l)));
  const surfaces = entrySurfaces();
  assert.ok(surfaces.some(s => s.surface === 'message-reader'));
  assert.ok(surfaces.some(s => s.surface === 'access'));
});

test('share helpers and app wiring never mcpCall HEAD tools', () => {
  const share = readFileSync(join(root, 'access-share.js'), 'utf8');
  const app = readFileSync(join(root, 'app.js'), 'utf8');
  assert.equal(assertShareNeverMovesHeads(share).ok, true);
  assert.equal(assertShareNeverMovesHeads(app).ok, true);
  assert.doesNotMatch(share, /mcpCall\(/);
  assert.match(ACCESS_GRANT_TOOLS.create, /cairnstone_access_grant_create/);
  assert.match(ACCESS_GRANT_TOOLS.attachmentResolve, /cairnstone_attachment_resolve/);
});
