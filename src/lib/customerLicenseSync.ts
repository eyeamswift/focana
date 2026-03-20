export type RawCustomerLicenseSyncPayload = {
  licenseInstanceId?: unknown;
  orderId?: unknown;
  customerIdLs?: unknown;
  customerEmail?: unknown;
  preferredName?: unknown;
  eventAt?: unknown;
};

export type CustomerLicenseSyncPayload = {
  license_instance_id: string;
  order_id: string | null;
  customer_id_ls: string | null;
  customer_email: string | null;
  preferred_name: string | null;
  event_at: string;
};

export type CustomerRow = {
  id: string;
  email: string | null;
  name: string | null;
  order_id: string | null;
  customer_id_ls: string | null;
  created_at: string;
};

export type CustomerLicenseInstanceRow = {
  id: string;
  customer_id: string;
  license_instance_id: string;
  order_id: string | null;
  customer_id_ls: string | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
};

type CustomerLicenseCreateInput = {
  customer_id: string;
  license_instance_id: string;
  order_id: string | null;
  customer_id_ls: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

type CustomerLicenseUpdateInput = Partial<CustomerLicenseCreateInput>;
type CustomerUpdateInput = Partial<Pick<CustomerRow, 'name'>>;

type FetchLike = typeof fetch;

export type LoggerLike = {
  warn?: (...args: unknown[]) => void;
};

export type CustomerLicenseStore = {
  findCustomerByOrderId: (orderId: string) => Promise<CustomerRow | null>;
  findCustomerByCustomerIdLs: (customerIdLs: string) => Promise<CustomerRow | null>;
  findLatestCustomerByEmail: (email: string) => Promise<CustomerRow | null>;
  findMappingByLicenseInstanceId: (licenseInstanceId: string) => Promise<CustomerLicenseInstanceRow | null>;
  createMapping: (input: CustomerLicenseCreateInput) => Promise<CustomerLicenseInstanceRow>;
  updateMapping: (id: string, patch: CustomerLicenseUpdateInput) => Promise<CustomerLicenseInstanceRow>;
  updateCustomer: (id: string, patch: CustomerUpdateInput) => Promise<CustomerRow>;
};

function clampText(value: unknown, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizePreferredName(value: unknown) {
  return clampText(value, 80).replace(/\s+/g, ' ');
}

function safeIso(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseIsoToMs(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function hasKeys(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

export function normalizeCustomerLicenseSyncPayload(
  rawPayload: RawCustomerLicenseSyncPayload
): CustomerLicenseSyncPayload | null {
  const licenseInstanceId = clampText(rawPayload.licenseInstanceId, 160);
  if (!licenseInstanceId) {
    return null;
  }

  const orderId = clampText(rawPayload.orderId, 160) || null;
  const customerIdLs = clampText(rawPayload.customerIdLs, 160) || null;
  const customerEmail = clampText(rawPayload.customerEmail, 320).toLowerCase() || null;
  const preferredName = normalizePreferredName(rawPayload.preferredName) || null;

  if (!orderId && !customerIdLs && !customerEmail) {
    return null;
  }

  return {
    license_instance_id: licenseInstanceId,
    order_id: orderId,
    customer_id_ls: customerIdLs,
    customer_email: customerEmail,
    preferred_name: preferredName,
    event_at: safeIso(rawPayload.eventAt) || new Date().toISOString(),
  };
}

async function resolveCustomer(
  payload: CustomerLicenseSyncPayload,
  store: CustomerLicenseStore
) {
  if (payload.order_id) {
    const customer = await store.findCustomerByOrderId(payload.order_id);
    if (customer) return customer;
  }

  if (payload.customer_id_ls) {
    const customer = await store.findCustomerByCustomerIdLs(payload.customer_id_ls);
    if (customer) return customer;
  }

  if (payload.customer_email) {
    const customer = await store.findLatestCustomerByEmail(payload.customer_email);
    if (customer) return customer;
  }

  return null;
}

function buildCustomerPatch(
  customer: CustomerRow,
  payload: CustomerLicenseSyncPayload
) {
  const patch: CustomerUpdateInput = {};
  const currentName = normalizePreferredName(customer.name);

  if (payload.preferred_name && payload.preferred_name !== currentName) {
    patch.name = payload.preferred_name;
  }

  return patch;
}

function buildMappingPatch(
  existing: CustomerLicenseInstanceRow,
  payload: CustomerLicenseSyncPayload,
  customerId: string
) {
  const patch: CustomerLicenseUpdateInput = {};
  const eventAtMs = parseIsoToMs(payload.event_at);
  const firstSeenMs = parseIsoToMs(existing.first_seen_at);
  const lastSeenMs = parseIsoToMs(existing.last_seen_at);

  if (existing.customer_id !== customerId) {
    patch.customer_id = customerId;
  }

  if (eventAtMs !== null && (firstSeenMs === null || eventAtMs < firstSeenMs)) {
    patch.first_seen_at = payload.event_at;
  }

  if (eventAtMs !== null && (lastSeenMs === null || eventAtMs >= lastSeenMs)) {
    patch.last_seen_at = payload.event_at;
  }

  if (payload.order_id && payload.order_id !== existing.order_id) {
    patch.order_id = payload.order_id;
  }

  if (payload.customer_id_ls && payload.customer_id_ls !== existing.customer_id_ls) {
    patch.customer_id_ls = payload.customer_id_ls;
  }

  return patch;
}

export async function syncCustomerLicenseInstance(
  rawPayload: RawCustomerLicenseSyncPayload,
  {
    store,
    logger = {},
  }: {
    store: CustomerLicenseStore;
    logger?: LoggerLike;
  }
) {
  const payload = normalizeCustomerLicenseSyncPayload(rawPayload);
  if (!payload) {
    return { ok: false, status: 'invalid_payload' as const };
  }

  const customer = await resolveCustomer(payload, store);
  if (!customer) {
    return { ok: false, status: 'customer_not_found' as const, payload };
  }

  const customerPatch = buildCustomerPatch(customer, payload);
  const resolvedCustomer = hasKeys(customerPatch)
    ? await store.updateCustomer(customer.id, customerPatch)
    : customer;

  const existing = await store.findMappingByLicenseInstanceId(payload.license_instance_id);
  if (!existing) {
    const mapping = await store.createMapping({
      customer_id: resolvedCustomer.id,
      license_instance_id: payload.license_instance_id,
      order_id: payload.order_id,
      customer_id_ls: payload.customer_id_ls,
      first_seen_at: payload.event_at,
      last_seen_at: payload.event_at,
    });

    return {
      ok: true,
      status: 'created' as const,
      payload,
      customer: resolvedCustomer,
      mapping,
    };
  }

  if (existing.customer_id !== resolvedCustomer.id) {
    logger.warn?.(
      `[license-sync] Reassigning license_instance_id=${payload.license_instance_id} from customer_id=${existing.customer_id} to customer_id=${resolvedCustomer.id}.`
    );
  }

  const patch = buildMappingPatch(existing, payload, resolvedCustomer.id);
  const mapping = hasKeys(patch)
    ? await store.updateMapping(existing.id, patch)
    : existing;

  return {
    ok: true,
    status: 'updated' as const,
    payload,
    customer: resolvedCustomer,
    mapping,
  };
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

const CUSTOMER_SELECT = 'id,email,name,order_id,customer_id_ls,created_at';
const MAPPING_SELECT =
  'id,customer_id,license_instance_id,order_id,customer_id_ls,first_seen_at,last_seen_at,created_at,updated_at';

export function createSupabaseCustomerLicenseStore({
  supabaseUrl,
  supabaseServiceKey,
  fetchImpl = fetch,
}: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  fetchImpl?: FetchLike;
}): CustomerLicenseStore {
  async function fetchCustomerByFilter(filterColumn: 'order_id' | 'customer_id_ls', filterValue: string) {
    const url = new URL(`${supabaseUrl}/rest/v1/customers`);
    url.searchParams.set('select', CUSTOMER_SELECT);
    url.searchParams.set(filterColumn, `eq.${filterValue}`);
    url.searchParams.set('limit', '1');

    const response = await fetchImpl(url, {
      headers: createHeaders(supabaseServiceKey),
    });

    const rows = await readJsonResponse<CustomerRow[]>(
      response,
      `Customer lookup failed for ${filterColumn}=${filterValue}`
    );

    return rows[0] || null;
  }

  return {
    findCustomerByOrderId(orderId) {
      return fetchCustomerByFilter('order_id', orderId);
    },

    findCustomerByCustomerIdLs(customerIdLs) {
      return fetchCustomerByFilter('customer_id_ls', customerIdLs);
    },

    async findLatestCustomerByEmail(email) {
      const url = new URL(`${supabaseUrl}/rest/v1/customers`);
      url.searchParams.set('select', CUSTOMER_SELECT);
      url.searchParams.set('email', `ilike.${email}`);
      url.searchParams.set('order', 'created_at.desc');
      url.searchParams.set('limit', '1');

      const response = await fetchImpl(url, {
        headers: createHeaders(supabaseServiceKey),
      });

      const rows = await readJsonResponse<CustomerRow[]>(
        response,
        `Customer lookup failed for email=${email}`
      );

      return rows[0] || null;
    },

    async findMappingByLicenseInstanceId(licenseInstanceId) {
      const url = new URL(`${supabaseUrl}/rest/v1/customer_license_instances`);
      url.searchParams.set('select', MAPPING_SELECT);
      url.searchParams.set('license_instance_id', `eq.${licenseInstanceId}`);
      url.searchParams.set('limit', '1');

      const response = await fetchImpl(url, {
        headers: createHeaders(supabaseServiceKey),
      });

      const rows = await readJsonResponse<CustomerLicenseInstanceRow[]>(
        response,
        `License-instance lookup failed for license_instance_id=${licenseInstanceId}`
      );

      return rows[0] || null;
    },

    async createMapping(input) {
      const url = new URL(`${supabaseUrl}/rest/v1/customer_license_instances`);
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(input),
      });

      const rows = await readJsonResponse<CustomerLicenseInstanceRow[]>(
        response,
        `License-instance insert failed for license_instance_id=${input.license_instance_id}`
      );

      if (!rows[0]) {
        throw new Error(
          `License-instance insert returned no rows for license_instance_id=${input.license_instance_id}`
        );
      }

      return rows[0];
    },

    async updateMapping(id, patch) {
      const url = new URL(`${supabaseUrl}/rest/v1/customer_license_instances`);
      url.searchParams.set('id', `eq.${id}`);

      const response = await fetchImpl(url, {
        method: 'PATCH',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(patch),
      });

      const rows = await readJsonResponse<CustomerLicenseInstanceRow[]>(
        response,
        `License-instance update failed for id=${id}`
      );

      if (!rows[0]) {
        throw new Error(`License-instance update returned no rows for id=${id}`);
      }

      return rows[0];
    },

    async updateCustomer(id, patch) {
      const url = new URL(`${supabaseUrl}/rest/v1/customers`);
      url.searchParams.set('id', `eq.${id}`);

      const response = await fetchImpl(url, {
        method: 'PATCH',
        headers: createHeaders(supabaseServiceKey, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(patch),
      });

      const rows = await readJsonResponse<CustomerRow[]>(
        response,
        `Customer update failed for id=${id}`
      );

      if (!rows[0]) {
        throw new Error(`Customer update returned no rows for id=${id}`);
      }

      return rows[0];
    },
  };
}
