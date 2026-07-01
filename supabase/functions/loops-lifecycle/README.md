# Loops Lifecycle Function

`loops-lifecycle` receives trusted Focana lifecycle events and forwards them to
Loops.

The Loops API key stays in Supabase secrets. Do not put it in the Electron app,
renderer code, or committed files.

## Secrets

Set both secrets before deploying or testing against the hosted function:

```bash
supabase secrets set \
  LOOPS_API_KEY="loops_..." \
  FOCANA_LIFECYCLE_WEBHOOK_SECRET="generate-a-long-random-secret"
```

For local testing, create an uncommitted `supabase/.env.local` with:

```bash
LOOPS_API_KEY=loops_...
FOCANA_LIFECYCLE_WEBHOOK_SECRET=generate-a-long-random-secret
```

## Deploy

```bash
supabase functions deploy loops-lifecycle --no-verify-jwt --use-api
```

## Recommended Starting Events

- `trial_started`: send when a new install enters the 7-day trial.
- `trial_day_6`: send as the gentle reminder before the trial ends.
- `trial_expired`: send when the app first reaches the day-8 upgrade gate.
- `checkout_started`: send when the user clicks monthly or lifetime checkout.
- `license_activated`: send when a pasted license key unlocks the app.

## Send A Test Event

```bash
curl -X POST "$SUPABASE_URL/functions/v1/loops-lifecycle" \
  -H "Authorization: Bearer $FOCANA_LIFECYCLE_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-trial-started-001" \
  -d '{
    "email": "customer@example.com",
    "eventName": "trial_started",
    "eventProperties": {
      "trialDays": 7,
      "plan": "trial"
    },
    "contactProperties": {
      "firstName": "Customer",
      "source": "focana"
    }
  }'
```

## Payload Shape

```json
{
  "email": "customer@example.com",
  "userId": "optional-stable-id",
  "eventName": "trial_started",
  "eventProperties": {
    "trialDays": 7
  },
  "contactProperties": {
    "firstName": "Customer"
  },
  "mailingLists": {
    "Product updates": true
  },
  "idempotencyKey": "optional-duplicate-protection-key"
}
```

Use `contactProperties` for Loops contact fields and `eventProperties` for
values that should be attached only to the event.
