import { resolveSiteOrigin } from './siteOrigin.ts';

const API_BASE_URL = 'https://api.lemonsqueezy.com/v1';
const CREATOR_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_SELECT =
  'id,name,email,slug,status,claimed_email,claimed_order_id,claimed_at,created_at,updated_at';

type FetchLike = typeof fetch;

export type FriendsAndFamilyCheckoutLocation = 'hero' | 'footer' | 'unknown';
export type FriendsAndFamilyInviteStatus = 'active' | 'claimed' | 'revoked';
export type FriendsAndFamilyInviteClaimStatus =
  | 'claimed'
  | 'already_claimed'
  | 'email_mismatch'
  | 'invalid_email'
  | 'invalid_invite_email'
  | 'not_active'
  | 'not_found';

export type FriendsAndFamilyInviteRow = {
  id: string;
  name: string;
  email: string;
  slug: string;
  status: FriendsAndFamilyInviteStatus;
  claimed_email: string | null;
  claimed_order_id: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FriendsAndFamilyInviteClaimPatch = {
  status: 'claimed';
  claimed_email: string;
  claimed_order_id: string;
  claimed_at: string;
};

export type FriendsAndFamilyInviteClaimResult = {
  ok: boolean;
  status: FriendsAndFamilyInviteClaimStatus;
  invite: FriendsAndFamilyInviteRow | null;
};

export type FriendsAndFamilyInviteStore = {
  findInviteBySlug(slug: string): Promise<FriendsAndFamilyInviteRow | null>;
  claimActiveInvite(
    id: string,
    patch: FriendsAndFamilyInviteClaimPatch
  ): Promise<FriendsAndFamilyInviteRow | null>;
};

export function normalizeCreatorSlug(value: string | null | undefined) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalized || normalized.length > 80 || !CREATOR_SLUG_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

export function normalizeInviteEmail(value: string | null | undefined) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized || !EMAIL_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

export function normalizeCheckoutLocation(value: string | null | undefined): FriendsAndFamilyCheckoutLocation {
  if (value === 'hero' || value === 'footer') return value;
  return 'unknown';
}

export function isActiveFriendsAndFamilyInvite(invite: FriendsAndFamilyInviteRow | null | undefined) {
  return Boolean(invite && invite.status === 'active');
}

function createHeaders(serviceKey: string, extraHeaders: Record<string, string> = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extraHeaders,
  };
}

async function readJsonResponse<T>(response: Response, context: string) {
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`${context}: ${errText || response.status}`);
  }

  return (await response.json()) as T;
}

function normalizeInviteRow(row: FriendsAndFamilyInviteRow): FriendsAndFamilyInviteRow {
  return {
    ...row,
    email: normalizeInviteEmail(row.email) || String(row.email || '').trim().toLowerCase(),
    slug: normalizeCreatorSlug(row.slug) || row.slug,
    claimed_email: normalizeInviteEmail(row.claimed_email),
  };
}

function isMatchingClaim(
  invite: FriendsAndFamilyInviteRow,
  purchaserEmail: string,
  orderId: string
) {
  return (
    invite.status === 'claimed' &&
    normalizeInviteEmail(invite.claimed_email) === purchaserEmail &&
    String(invite.claimed_order_id || '').trim() === orderId
  );
}

export function createSupabaseFriendsAndFamilyInviteStore({
  supabaseUrl,
  supabaseServiceKey,
  fetchImpl = fetch,
}: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  fetchImpl?: FetchLike;
}): FriendsAndFamilyInviteStore {
  return {
    async findInviteBySlug(slug) {
      const normalizedSlug = normalizeCreatorSlug(slug);
      if (!normalizedSlug) return null;

      const url = new URL(`${supabaseUrl}/rest/v1/friends_and_family_invites`);
      url.searchParams.set('select', INVITE_SELECT);
      url.searchParams.set('slug', `eq.${normalizedSlug}`);
      url.searchParams.set('limit', '1');

      const response = await fetchImpl(url, {
        headers: createHeaders(supabaseServiceKey),
      });

      const rows = await readJsonResponse<FriendsAndFamilyInviteRow[]>(
        response,
        `Friends-and-family invite lookup failed for slug=${normalizedSlug}`
      );

      return rows[0] ? normalizeInviteRow(rows[0]) : null;
    },

    async claimActiveInvite(id, patch) {
      const url = new URL(`${supabaseUrl}/rest/v1/friends_and_family_invites`);
      url.searchParams.set('id', `eq.${id}`);
      url.searchParams.set('status', 'eq.active');

      const response = await fetchImpl(url, {
        method: 'PATCH',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(patch),
      });

      const rows = await readJsonResponse<FriendsAndFamilyInviteRow[]>(
        response,
        `Friends-and-family invite claim failed for id=${id}`
      );

      return rows[0] ? normalizeInviteRow(rows[0]) : null;
    },
  };
}

export async function claimFriendsAndFamilyInvite(
  {
    slug,
    purchaserEmail,
    orderId,
    claimedAt = new Date().toISOString(),
  }: {
    slug: string;
    purchaserEmail: string;
    orderId: string;
    claimedAt?: string;
  },
  {
    store,
  }: {
    store: FriendsAndFamilyInviteStore;
  }
): Promise<FriendsAndFamilyInviteClaimResult> {
  const normalizedSlug = normalizeCreatorSlug(slug);
  if (!normalizedSlug) {
    return { ok: false, status: 'not_found', invite: null };
  }

  const normalizedPurchaserEmail = normalizeInviteEmail(purchaserEmail);
  if (!normalizedPurchaserEmail) {
    return { ok: false, status: 'invalid_email', invite: null };
  }

  const normalizedOrderId = String(orderId || '').trim();
  const invite = await store.findInviteBySlug(normalizedSlug);

  if (!invite) {
    return { ok: false, status: 'not_found', invite: null };
  }

  const inviteEmail = normalizeInviteEmail(invite.email);
  if (!inviteEmail) {
    return { ok: false, status: 'invalid_invite_email', invite };
  }

  if (invite.status === 'claimed') {
    if (isMatchingClaim(invite, normalizedPurchaserEmail, normalizedOrderId)) {
      return { ok: true, status: 'already_claimed', invite };
    }

    return { ok: false, status: 'not_active', invite };
  }

  if (invite.status !== 'active') {
    return { ok: false, status: 'not_active', invite };
  }

  if (inviteEmail !== normalizedPurchaserEmail) {
    return { ok: false, status: 'email_mismatch', invite };
  }

  const claimedInvite = await store.claimActiveInvite(invite.id, {
    status: 'claimed',
    claimed_email: normalizedPurchaserEmail,
    claimed_order_id: normalizedOrderId,
    claimed_at: claimedAt,
  });

  if (claimedInvite) {
    return { ok: true, status: 'claimed', invite: claimedInvite };
  }

  const latestInvite = await store.findInviteBySlug(normalizedSlug);
  if (latestInvite && isMatchingClaim(latestInvite, normalizedPurchaserEmail, normalizedOrderId)) {
    return { ok: true, status: 'already_claimed', invite: latestInvite };
  }

  return {
    ok: false,
    status: latestInvite ? 'not_active' : 'not_found',
    invite: latestInvite,
  };
}

export function buildFriendsAndFamilyCheckoutPayload({
  storeId,
  variantId,
  creatorSlug,
  checkoutLocation,
  siteOrigin,
}: {
  storeId: string | number;
  variantId: string | number;
  creatorSlug: string;
  checkoutLocation: FriendsAndFamilyCheckoutLocation;
  siteOrigin?: string;
}) {
  const origin = resolveSiteOrigin(siteOrigin);
  const downloadUrl = new URL('/download', origin).toString();

  return {
    data: {
      type: 'checkouts',
      attributes: {
        product_options: {
          redirect_url: downloadUrl,
          receipt_button_text: 'Download Focana',
          receipt_link_url: downloadUrl,
          receipt_thank_you_note: 'If your download page does not open automatically, use the button above.',
          enabled_variants: [Number(variantId)],
        },
        checkout_options: {
          embed: true,
          media: false,
          logo: true,
          desc: false,
          discount: false,
          background_color: '#FFF9E6',
          headings_color: '#5C4033',
          primary_text_color: '#5C4033',
          secondary_text_color: '#8B6F47',
          links_color: '#D97706',
          borders_color: '#E7D0A9',
          checkbox_color: '#D97706',
          active_state_color: '#D97706',
          button_color: '#D97706',
          button_text_color: '#FFF9E6',
        },
        checkout_data: {
          custom: {
            source: 'friends_and_family',
            creator_slug: creatorSlug,
            checkout_location: checkoutLocation,
          },
        },
      },
      relationships: {
        store: {
          data: {
            type: 'stores',
            id: String(storeId),
          },
        },
        variant: {
          data: {
            type: 'variants',
            id: String(variantId),
          },
        },
      },
    },
  };
}

export async function createFriendsAndFamilyCheckout({
  apiKey,
  storeId,
  variantId,
  creatorSlug,
  checkoutLocation,
  siteOrigin,
  fetchImpl = fetch,
}: {
  apiKey: string;
  storeId: string | number;
  variantId: string | number;
  creatorSlug: string;
  checkoutLocation: FriendsAndFamilyCheckoutLocation;
  siteOrigin?: string;
  fetchImpl?: typeof fetch;
}) {
  const response = await fetchImpl(`${API_BASE_URL}/checkouts`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(
      buildFriendsAndFamilyCheckoutPayload({
        storeId,
        variantId,
        creatorSlug,
        checkoutLocation,
        siteOrigin,
      })
    ),
  });

  const text = await response.text();
  let payload: any = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload?.errors?.[0]?.detail ||
      payload?.errors?.[0]?.title ||
      payload?.error ||
      payload?.message ||
      text ||
      `Lemon checkout creation failed with status ${response.status}`;

    throw new Error(detail);
  }

  const checkoutUrl = payload?.data?.attributes?.url;
  if (typeof checkoutUrl !== 'string' || !checkoutUrl.trim()) {
    throw new Error('Lemon checkout creation did not return a checkout URL.');
  }

  return {
    checkoutUrl: checkoutUrl.trim(),
    payload,
  };
}
