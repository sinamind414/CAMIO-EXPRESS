import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterHelpArticles,
  HELP_ARTICLES,
  normalizeSearchText,
} from './helpCenter';

test('normalizeSearchText strips accents, apostrophes, and Arabic diacritics', () => {
  assert.equal(normalizeSearchText("How to verify a driver's ID?"), 'how to verify a driver s id');
  assert.equal(normalizeSearchText('Évacuation & Déménagement'), 'evacuation & demenagement');
  assert.equal(normalizeSearchText('التَّحَقُّق من هُوية السائق'), normalizeSearchText('التحقق من هوية السايق'));
});

test('searching "How to book a mover" ranks booking guide first', () => {
  const results = filterHelpArticles(HELP_ARTICLES, {
    query: 'How to book a mover',
  });
  assert.ok(results.length >= 1);
  assert.equal(results[0].article.id, 'faq-book-mover');
});

test('searching "How to verify a driver\'s ID" ranks driver ID KYC guide first', () => {
  const results = filterHelpArticles(HELP_ARTICLES, {
    query: "How to verify a driver's ID",
  });
  assert.ok(results.length >= 1);
  assert.equal(results[0].article.id, 'faq-verify-driver-id');
});

test('searching French & Arabic queries finds expected onboarding topics', () => {
  const frVerify = filterHelpArticles(HELP_ARTICLES, {
    query: 'vérifier identité chauffeur',
  });
  assert.equal(frVerify[0]?.article.id, 'faq-verify-driver-id');

  const arBook = filterHelpArticles(HELP_ARTICLES, {
    query: 'حجز شاحنة نقل',
  });
  assert.equal(arBook[0]?.article.id, 'faq-book-mover');
});

test('category and audience filters restrict returned articles accurately', () => {
  const driverOps = filterHelpArticles(HELP_ARTICLES, {
    category: 'driver_ops',
    audience: 'driver',
  });
  assert.ok(driverOps.length >= 3);
  assert.ok(driverOps.every((r) => r.article.category === 'driver_ops'));

  const clientInDriverOps = filterHelpArticles(HELP_ARTICLES, {
    category: 'driver_ops',
    audience: 'client',
  });
  assert.equal(clientInDriverOps.length, 0);
});

test('unmatched query returns empty list', () => {
  const empty = filterHelpArticles(HELP_ARTICLES, {
    query: 'xyzzy-nonexistent-topic-999',
  });
  assert.equal(empty.length, 0);
});
