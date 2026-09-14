/**
 * Unit tests for V7.7.9e progressive disclosure models.
 * Run: node --test progressive-disclosure.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeDisclosureModel,
  evidenceDisclosureModel,
  scopeDisclosureModel,
  stonesDisclosureModel
} from './progressive-disclosure.js';

describe('scopeDisclosureModel', () => {
  it('keeps identity primary and browse/advanced secondary', () => {
    const m = scopeDisclosureModel({
      resolved: true,
      summary: '1 repo · 1 chain',
      authorityLine: 'Scope abc · authority def',
      pickerOpen: false,
      advancedOpen: false
    });
    assert.equal(m.status, 'ready');
    assert.equal(m.acceptedStateAuthority, false);
    assert.equal(m.steps[0].id, 'identity');
    assert.equal(m.steps[0].open, true);
    assert.equal(m.steps.find(s => s.id === 'browse').open, false);
  });

  it('exposes loading / error / empty honestly', () => {
    assert.equal(scopeDisclosureModel({ loading: true }).status, 'loading');
    assert.equal(scopeDisclosureModel({ error: new Error('boom') }).status, 'error');
    assert.equal(scopeDisclosureModel({ resolved: false }).status, 'empty');
  });
});

describe('stonesDisclosureModel', () => {
  it('collapses raw until selected', () => {
    const empty = stonesDisclosureModel({ itemCount: 0 });
    assert.equal(empty.status, 'empty');
    const ready = stonesDisclosureModel({ itemCount: 3, selected: true, detailOpen: true, rawOpen: false });
    assert.equal(ready.status, 'ready');
    assert.equal(ready.steps.find(s => s.id === 'raw').open, false);
    assert.equal(ready.acceptedStateAuthority, false);
  });
});

describe('evidenceDisclosureModel', () => {
  it('keeps response_lod ≠ stone_lod naming note when ready', () => {
    const m = evidenceDisclosureModel({ hasResult: true, sectionsOpen: ['accepted'] });
    assert.equal(m.status, 'ready');
    assert.match(m.namingNote, /response_lod/);
    assert.match(m.namingNote, /stone_lod/);
    assert.equal(m.steps.find(s => s.id === 'observability').open, false);
  });
});

describe('authorizeDisclosureModel', () => {
  it('disables decisions without selection; material effect before raw', () => {
    const disabled = authorizeDisclosureModel({ tokenPresent: false });
    assert.equal(disabled.status, 'disabled');
    assert.equal(disabled.decisionsEnabled, false);

    const ready = authorizeDisclosureModel({
      tokenPresent: true,
      count: 2,
      selected: true,
      pending: true,
      argsOpen: true,
      rawOpen: false,
      materialEffect: 'Move one canonical chain HEAD'
    });
    assert.equal(ready.status, 'ready');
    assert.equal(ready.decisionsEnabled, true);
    assert.equal(ready.steps.find(s => s.id === 'effect').open, true);
    assert.equal(ready.steps.find(s => s.id === 'raw').open, false);
    assert.equal(ready.acceptedStateAuthority, false);
  });
});
