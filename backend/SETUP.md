# Activate real listings and buyer inquiries

The GitHub Pages site continues to work in private-draft/demo mode without an account. No Supabase project has been created or connected. `config.js` intentionally keeps the backend disabled. The implementation is prepared; it has not been tested against a live Supabase project.

## Account owner setup

1. Create a Supabase project under your own account. Review its current plan and limits before selecting it.
2. Run `backend/schema.sql`, then `backend/002-safety.sql`, once each and in that order in the new project’s SQL editor. The second migration is REQUIRED for the current website. It adds invitations, private property details, reviewer permissions, review history, private conversations, blocks, and safety reports. For a project already using schema.sql, apply only the second migration after a database backup.
3. In Authentication, enable email sign-in and configure a production email provider (SMTP). The default test email service is not a public-launch mail service. Configure authentication rate limits and CAPTCHA before a broad public launch; adding CAPTCHA also requires passing its token from the sign-in form.
4. In the **Magic Link email template**, replace the link with an email code, for example `<p>Your OpenHome sign-in code: {{ .Token }}</p>`. The website uses email + code verification, not redirect links. Set the site URL to `https://sharonballi49.github.io/Openhome-market-/`.
5. Copy the project URL and **publishable key** into `config.js`. These are public client settings. NEVER use a secret key, database password, or service-role key in the repository or browser.
6. Keep `enabled: false` on the public site until the checks below pass in a separate test deployment. Turning it on replaces fictional homes with approved real homes. Local demo drafts stay on the device and are not automatically uploaded.

## Required staging checks with two separate test accounts

- Seller A signs in, uploads photos, and submits a listing. The listing should be pending, invisible to signed-out visitors and Seller B. Seller B must not be able to fetch A's private photos or edit A's listing, even through direct API requests.
- Sign in as a separately assigned moderator, open Safety → Review listings & reports, review A's private details/photos, complete the identity/authority checks, and approve the listing. A cannot approve their own listing through the client API.
- A signed-out visitor can browse the approved listing and its photos. Samples must be absent.
- Buyer B signs in and sends an inquiry. A sees it in My listings → Messages and can reply inside OpenHome. Neither participant can select the other’s account email. A third account, including an unreported-chat moderator, must not read the conversation. Block from either side and verify both directions stop; the other person must not be able to remove your block. Reporting must preserve only the selected content for review.
- Editing a published listing must return it to pending and hide it from public search. Withdrawal must hide it. Previously issued photo links can work until they expire (up to one hour).
- Check auth failures, expired sessions, failed uploads, storage limits, and offline behavior. Do not enable the public site if these fail.

## Operations and limits

The website has a moderator-only review dashboard, accessible from Safety after signing in. Grant moderator and pilot-seller membership administratively as described below. Messages and replies stay in OpenHome, with **no email notifications**; users must refresh their messages. Moderators can read reported content snapshots, not unrelated private conversations. No payments or contract execution are implemented. Confirm the business identity, privacy/terms, support/reporting process, listing ownership review, and retention/deletion procedures before accepting public submissions. Add upload/account quotas and abuse monitoring before promoting the service broadly. The initial UI loads at most 1,000 visible listings, 200 recent conversations, and the latest 200 messages per conversation. Moderators see the oldest 200 pending listings/open reports, 200 listing reviews, and 50 resolved reports. Resolve older queue items to reveal later ones. Full pagination is future work.

Photo upload and database save are separate operations. The client cleans up failures before the database request and removed photos after success. After a database request has been attempted, it retains uploaded files on error because a lost response could conceal a successful commit. Interrupted or rejected submissions can therefore leave orphaned files. Periodically review and delete unused files through the Storage API/dashboard, not SQL deletion of storage metadata. Deleting an auth user removes database records but also requires Storage cleanup. Signed photo URLs expire after an hour; refresh the page to renew them.

Drafts are local to this browser and may be lost when browser data is cleared. The Download backup button exports the draft and photo data as JSON for safekeeping; automatic restore/import is not implemented.

References: [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).


## Pilot access and moderator setup

Keep the database service-role key out of the browser. No visitor, including a moderator, can grant themselves access through the website. First create and verify the account via email-code sign-in. Look up its actual user UUID in the Supabase Authentication dashboard, then run these commands in the SQL editor, substituting the correct IDs:

```sql
-- Assign the site operator as moderator. Never use an arbitrary visitor ID.
insert into public.moderators(user_id) values ('ACTUAL_OPERATOR_USER_UUID');
-- Invite a seller after completing your onboarding process.
insert into public.pilot_sellers(user_id,active)
values ('ACTUAL_SELLER_USER_UUID',true)
on conflict(user_id) do update set active=true;
-- Stop future submissions and uploads for an existing seller.
update public.pilot_sellers set active=false where user_id='ACTUAL_SELLER_USER_UUID';
```

These are placeholders, not executable credentials. Membership management has no browser UI in this version. Deactivating a seller does not automatically remove existing listings; withdraw those through review/report tools as needed. Moderators cannot approve their own listings.

The seller submits a legal name, full property address, county, claimed relationship, and optional property/deed reference. These go into `listing_verification`, readable only by that seller and authorized moderators. Public listings contain only the public property fields; check descriptions and images for unintended personal details before approval.

## Review procedure

1. Inspect each photo and the public description. Check the private property address and county.
2. Use the correct county's appraisal and deed records; Bexar links are included in the UI. Confirm seller identity separately through an appropriate process, not by matching a public name alone. No ID upload service is implemented.
3. Resolve co-owner, estate, trust, or representative authority questions with the appropriate professional. Public records and manual review are not title insurance or a guarantee of ownership.
4. Record the check method without sensitive ID numbers. Both identity and authority confirmations are required for publication. Returning a listing for changes or withdrawing it requires a note. Notes are visible to the seller.
5. The server checks the exact listing revision so a stale approval cannot publish changes made after review. Every seller resubmission returns to pending.

Reports have an immutable server-captured content snapshot. Resolution notes are visible to the reporter. Moderators may withdraw a reported listing while resolving the report. A report does not automatically block a person or remove content. Users can block a conversation partner separately; both directions are stopped across all their conversations, while message history remains available for reports. Direct client writes to messages, reports, blocks, memberships, and reviews are denied.

## Additional staging tests before launch

Test an uninvited seller's direct API attempts, self-assignment of moderator membership, a moderator reviewing their own listing, stale review submissions, private-field reads from another account, email-column reads, blocks in both directions, duplicate reports, report snapshots, and cross-account message reads. The included PGlite checks simulate these cases, but the actual hosted database, email delivery, Storage service, browser sessions, and responsive layout still need end-to-end staging validation.

Add published privacy/terms, a monitored moderation/support process and response policy, secure identity review procedures, and deployment-specific quotas/CAPTCHA before broad promotion. Do not claim automated identity checks or property-ownership verification: neither is implemented. No deposits, escrow, or financial document uploads are offered.
