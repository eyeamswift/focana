import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFriendsAndFamilyCheckoutPayload,
  claimFriendsAndFamilyInvite,
  normalizeCheckoutLocation,
  normalizeCreatorSlug,
  normalizeInviteEmail,
  type FriendsAndFamilyInviteClaimPatch,
  type FriendsAndFamilyInviteRow,
  type FriendsAndFamilyInviteStore,
} from '../src/lib/friendsAndFamily.ts';

class MemoryFriendsAndFamilyInviteStore implements FriendsAndFamilyInviteStore {
  invites: FriendsAndFamilyInviteRow[] = [];

  async findInviteBySlug(slug: string) {
    return this.clone(this.invites.find((row) => row.slug === slug) || null);
  }

  async claimActiveInvite(id: string, patch: FriendsAndFamilyInviteClaimPatch) {
    const index = this.invites.findIndex((row) => row.id === id);
    if (index === -1) {
      throw new Error(`Unknown invite ${id}`);
    }

    if (this.invites[index].status !== 'active') {
      return null;
    }

    const nextRow: FriendsAndFamilyInviteRow = {
      ...this.invites[index],
      ...patch,
      updated_at: patch.claimed_at,
    };

    this.invites[index] = nextRow;
    return this.clone(nextRow);
  }

  private clone<T>(value: T) {
    return value === null ? null : structuredClone(value);
  }
}

function makeInvite(
  overrides: Partial<FriendsAndFamilyInviteRow> = {}
): FriendsAndFamilyInviteRow {
  return {
    id: 'invite-1',
    name: 'Justin',
    email: 'justin@example.com',
    slug: 'justin',
    status: 'active',
    claimed_email: null,
    claimed_order_id: null,
    claimed_at: null,
    created_at: '2026-04-15T08:00:00.000Z',
    updated_at: '2026-04-15T08:00:00.000Z',
    ...overrides,
  };
}

test('normalizeCreatorSlug lowercases and preserves clean creator identifiers', () => {
  assert.equal(normalizeCreatorSlug(' Justin Franklin '), 'justin-franklin');
  assert.equal(normalizeCreatorSlug('creator_name'), 'creator-name');
  assert.equal(normalizeCreatorSlug('Taylor-2'), 'taylor-2');
});

test('normalizeCreatorSlug rejects invalid identifiers', () => {
  assert.equal(normalizeCreatorSlug(''), null);
  assert.equal(normalizeCreatorSlug('---'), null);
  assert.equal(normalizeCreatorSlug('taylor/../'), null);
});

test('normalizeCheckoutLocation only allows known CTA locations', () => {
  assert.equal(normalizeCheckoutLocation('hero'), 'hero');
  assert.equal(normalizeCheckoutLocation('footer'), 'footer');
  assert.equal(normalizeCheckoutLocation('sidebar'), 'unknown');
});

test('normalizeInviteEmail lowercases and validates invite recipients', () => {
  assert.equal(normalizeInviteEmail(' Justin@Example.com '), 'justin@example.com');
  assert.equal(normalizeInviteEmail(''), null);
  assert.equal(normalizeInviteEmail('not-an-email'), null);
});

test('buildFriendsAndFamilyCheckoutPayload carries creator attribution and checkout styling', () => {
  const payload = buildFriendsAndFamilyCheckoutPayload({
    storeId: 312199,
    variantId: 1438451,
    creatorSlug: 'justin',
    checkoutLocation: 'hero',
    siteOrigin: 'https://focana.app',
  });

  assert.equal(payload.data.type, 'checkouts');
  assert.equal(payload.data.relationships.store.data.id, '312199');
  assert.equal(payload.data.relationships.variant.data.id, '1438451');
  assert.equal(payload.data.attributes.checkout_data.custom.creator_slug, 'justin');
  assert.equal(payload.data.attributes.checkout_data.custom.checkout_location, 'hero');
  assert.equal(payload.data.attributes.checkout_data.custom.source, 'friends_and_family');
  assert.equal(payload.data.attributes.product_options.redirect_url, 'https://www.focana.app/download');
  assert.equal(payload.data.attributes.checkout_options.embed, true);
  assert.equal(payload.data.attributes.checkout_options.button_color, '#D97706');
});

test('claimFriendsAndFamilyInvite claims an active invite when the purchaser email matches', async () => {
  const store = new MemoryFriendsAndFamilyInviteStore();
  store.invites.push(makeInvite());

  const result = await claimFriendsAndFamilyInvite(
    {
      slug: ' Justin ',
      purchaserEmail: 'JUSTIN@example.com',
      orderId: 'order-1',
      claimedAt: '2026-04-15T10:00:00.000Z',
    },
    { store }
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'claimed');
  assert.equal(store.invites[0].status, 'claimed');
  assert.equal(store.invites[0].claimed_email, 'justin@example.com');
  assert.equal(store.invites[0].claimed_order_id, 'order-1');
  assert.equal(store.invites[0].claimed_at, '2026-04-15T10:00:00.000Z');
});

test('claimFriendsAndFamilyInvite is idempotent for duplicate webhook deliveries', async () => {
  const store = new MemoryFriendsAndFamilyInviteStore();
  store.invites.push(
    makeInvite({
      status: 'claimed',
      claimed_email: 'justin@example.com',
      claimed_order_id: 'order-1',
      claimed_at: '2026-04-15T10:00:00.000Z',
      updated_at: '2026-04-15T10:00:00.000Z',
    })
  );

  const result = await claimFriendsAndFamilyInvite(
    {
      slug: 'justin',
      purchaserEmail: 'justin@example.com',
      orderId: 'order-1',
    },
    { store }
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'already_claimed');
});

test('claimFriendsAndFamilyInvite rejects email mismatches and keeps the invite active', async () => {
  const store = new MemoryFriendsAndFamilyInviteStore();
  store.invites.push(makeInvite());

  const result = await claimFriendsAndFamilyInvite(
    {
      slug: 'justin',
      purchaserEmail: 'someone-else@example.com',
      orderId: 'order-2',
    },
    { store }
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 'email_mismatch');
  assert.equal(store.invites[0].status, 'active');
  assert.equal(store.invites[0].claimed_email, null);
});
