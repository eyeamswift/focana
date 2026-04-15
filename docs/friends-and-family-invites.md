# Friends-and-Family Invites

## Purpose
Create private early-access invites with a shareable slug link and email-backed claim tracking.

## Required Inputs
- Name
- Email

## One-Time Setup
Apply the latest Supabase migrations before using the script. The invite flow now expects:
- `friends_and_family_invites.email`
- `customers.creator_slug`

## Create an Invite
Run:

```bash
npm run invite:create -- --name "Justin Franklin" --email "justin@example.com"
```

Preview without inserting:

```bash
npm run invite:create -- --name "Justin Franklin" --email "justin@example.com" --dry-run
```

## What the Script Does
- Normalizes the creator name into a slug
- Validates the invite email
- Loads local env from `.env` and `.env.local`
- Checks whether the email already has an invite
- Finds the next available slug if the base slug is already taken
- Inserts a new `friends_and_family_invites` row
- Prints the final share link

## Link Format
`https://focana.app/friends-and-family/<slug>`

## Important Rule
The recipient must use the same email at checkout that was stored on the invite. The webhook uses that email to claim the invite.

## Duplicate and Correction Rules
- One invite per email
- Slugs stay unique
- If the email already exists, reuse or update that invite instead of creating a new one
- If a slug is already taken, the script automatically creates the next available slug such as `justin-franklin-2`
- If an invite should stop working, set its status to `revoked`
