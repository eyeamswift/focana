import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeCustomerLicenseSyncPayload,
  syncCustomerLicenseInstance,
  type CustomerLicenseInstanceRow,
  type CustomerLicenseStore,
  type CustomerRow,
} from '../src/lib/customerLicenseSync.ts';

class MemoryCustomerLicenseStore implements CustomerLicenseStore {
  customers: CustomerRow[] = [];
  mappings: CustomerLicenseInstanceRow[] = [];
  nextMappingId = 1;

  async findCustomerByOrderId(orderId: string) {
    return this.clone(this.customers.find((row) => row.order_id === orderId) || null);
  }

  async findCustomerByCustomerIdLs(customerIdLs: string) {
    return this.clone(this.customers.find((row) => row.customer_id_ls === customerIdLs) || null);
  }

  async findLatestCustomerByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const matches = this.customers
      .filter((row) => (row.email || '').trim().toLowerCase() === normalizedEmail)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

    return this.clone(matches[0] || null);
  }

  async findMappingByLicenseInstanceId(licenseInstanceId: string) {
    return this.clone(this.mappings.find((row) => row.license_instance_id === licenseInstanceId) || null);
  }

  async createMapping(input: {
    customer_id: string;
    license_instance_id: string;
    order_id: string | null;
    customer_id_ls: string | null;
    first_seen_at: string;
    last_seen_at: string;
  }) {
    const row: CustomerLicenseInstanceRow = {
      id: `mapping-${this.nextMappingId++}`,
      customer_id: input.customer_id,
      license_instance_id: input.license_instance_id,
      order_id: input.order_id,
      customer_id_ls: input.customer_id_ls,
      first_seen_at: input.first_seen_at,
      last_seen_at: input.last_seen_at,
      created_at: input.first_seen_at,
      updated_at: input.last_seen_at,
    };

    this.mappings.push(row);
    return this.clone(row);
  }

  async updateMapping(
    id: string,
    patch: Partial<{
      customer_id: string;
      license_instance_id: string;
      order_id: string | null;
      customer_id_ls: string | null;
      first_seen_at: string;
      last_seen_at: string;
    }>
  ) {
    const index = this.mappings.findIndex((row) => row.id === id);
    if (index === -1) {
      throw new Error(`Unknown mapping ${id}`);
    }

    const nextRow = {
      ...this.mappings[index],
      ...patch,
      updated_at: patch.last_seen_at || patch.first_seen_at || this.mappings[index].updated_at,
    };

    this.mappings[index] = nextRow;
    return this.clone(nextRow);
  }

  async updateCustomer(
    id: string,
    patch: Partial<{
      name: string | null;
    }>
  ) {
    const index = this.customers.findIndex((row) => row.id === id);
    if (index === -1) {
      throw new Error(`Unknown customer ${id}`);
    }

    const nextRow = {
      ...this.customers[index],
      ...patch,
    };

    this.customers[index] = nextRow;
    return this.clone(nextRow);
  }

  private clone<T>(value: T) {
    return value === null ? null : structuredClone(value);
  }
}

function makeCustomer(
  id: string,
  overrides: Partial<{
    email: string | null;
    name: string | null;
    order_id: string | null;
    customer_id_ls: string | null;
    created_at: string;
  }> = {}
): CustomerRow {
  return {
    id,
    email: 'customer@example.com',
    name: 'Original Name',
    order_id: 'order-1',
    customer_id_ls: 'customer-ls-1',
    created_at: '2026-03-20T10:00:00.000Z',
    ...overrides,
  };
}

test('normalizeCustomerLicenseSyncPayload requires a license instance id and customer identifier', () => {
  assert.equal(normalizeCustomerLicenseSyncPayload({ licenseInstanceId: '' }), null);
  assert.equal(normalizeCustomerLicenseSyncPayload({ licenseInstanceId: 'instance-1' }), null);

  const normalized = normalizeCustomerLicenseSyncPayload({
    licenseInstanceId: ' instance-1 ',
    orderId: ' order-1 ',
    customerEmail: ' CUSTOMER@example.com ',
    preferredName: '  Ari   Franklin  ',
  });

  assert.equal(normalized?.license_instance_id, 'instance-1');
  assert.equal(normalized?.order_id, 'order-1');
  assert.equal(normalized?.customer_id_ls, null);
  assert.equal(normalized?.customer_email, 'customer@example.com');
  assert.equal(normalized?.preferred_name, 'Ari Franklin');
  assert.match(normalized?.event_at || '', /^\d{4}-\d{2}-\d{2}T/);
});

test('syncCustomerLicenseInstance creates a mapping via order_id lookup', async () => {
  const store = new MemoryCustomerLicenseStore();
  store.customers.push(makeCustomer('customer-1'));

  const result = await syncCustomerLicenseInstance(
    {
      licenseInstanceId: 'instance-1',
      orderId: 'order-1',
      customerIdLs: 'customer-ls-1',
      customerEmail: 'customer@example.com',
      eventAt: '2026-03-20T12:00:00.000Z',
    },
    { store }
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'created');
  assert.equal(store.mappings.length, 1);
  assert.equal(store.mappings[0].customer_id, 'customer-1');
  assert.equal(store.mappings[0].license_instance_id, 'instance-1');
});

test('syncCustomerLicenseInstance falls back to Lemon customer id and updates last_seen_at', async () => {
  const store = new MemoryCustomerLicenseStore();
  store.customers.push(makeCustomer('customer-1', {
    order_id: null,
  }));

  await syncCustomerLicenseInstance(
    {
      licenseInstanceId: 'instance-1',
      customerIdLs: 'customer-ls-1',
      customerEmail: 'customer@example.com',
      eventAt: '2026-03-20T12:00:00.000Z',
    },
    { store }
  );

  const result = await syncCustomerLicenseInstance(
    {
      licenseInstanceId: 'instance-1',
      customerIdLs: 'customer-ls-1',
      customerEmail: 'customer@example.com',
      eventAt: '2026-03-20T15:30:00.000Z',
    },
    { store }
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, 'updated');
  assert.equal(store.mappings.length, 1);
  assert.equal(store.mappings[0].last_seen_at, '2026-03-20T15:30:00.000Z');
});

test('syncCustomerLicenseInstance falls back to email when stronger ids are missing', async () => {
  const store = new MemoryCustomerLicenseStore();
  store.customers.push(makeCustomer('customer-1', {
    order_id: null,
    customer_id_ls: null,
  }));

  const result = await syncCustomerLicenseInstance(
    {
      licenseInstanceId: 'instance-2',
      customerEmail: 'customer@example.com',
      eventAt: '2026-03-20T16:00:00.000Z',
    },
    { store }
  );

  assert.equal(result.ok, true);
  assert.equal(result.customer?.id, 'customer-1');
  assert.equal(store.mappings[0].license_instance_id, 'instance-2');
});

test('syncCustomerLicenseInstance updates the customer name when a preferred name is provided', async () => {
  const store = new MemoryCustomerLicenseStore();
  store.customers.push(makeCustomer('customer-1', {
    name: 'Original Name',
  }));

  const result = await syncCustomerLicenseInstance(
    {
      licenseInstanceId: 'instance-3',
      orderId: 'order-1',
      preferredName: '  Ari  ',
      eventAt: '2026-03-20T17:00:00.000Z',
    },
    { store }
  );

  assert.equal(result.ok, true);
  assert.equal(result.customer?.name, 'Ari');
  assert.equal(store.customers[0].name, 'Ari');
});
