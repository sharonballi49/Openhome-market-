# Activate real listings and buyer inquiries

The GitHub Pages site continues to work in private-draft/demo mode without an account. No Supabase project has been created or connected. `config.js` intentionally keeps the backend disabled. The implementation is prepared; it has not been tested against a live Supabase project.

## Account owner setup

1. Create a Supabase project under your own account. Review its current plan and limits before selecting it.
2. Run `backend/schema.sql` once in the SQL editor of the new project. It creates listings, inquiries, private photo storage, owner-only editing, and server-side inquiry limits.
3. In Authentication, enable email sign-in and configure a production email provider (SMTP). The default test email service is not a public-launch mail service. Configure authentication rate limits and CAPTCHA before a broad public launch; adding CAPTCHA also requires passing its token from the sign-in form.
4. In the **Magic Link email template**, replace the link with an email code, for example `<p>Your OpenHome sign-in code: {{ .Token }}</p>`. The website uses email + code verification, not redirect links. Set the site URL to `https://sharonballi49.github.io/Openhome-market-/`.
5. Copy the project URL and **publishable key** into `config.js`. These are public client settings. NEVER use a secret key, database password, or service-role key in the repository or browser.
6. Keep `enabled: false` on the public site until the checks below pass in a separate test deployment. Turning it on replaces fictional homes with approved real homes. Local demo drafts stay on the device and are not automatically uploaded.

## Required staging checks with two separate test accounts

- Seller A signs in, uploads photos, and submits a listing. The listing should be pending, invisible to signed-out visitors and Seller B. Seller B must not be able to fetch A's private photos or edit A's listing, even through direct API requests.
- In the Supabase dashboard, review A's listing and confirm ownership/authorization before setting `status` to `published`. A cannot approve their own listing through the client API.
- A signed-out visitor can browse the approved listing and its photos. Samples must be absent.
- Buyer B signs in and sends an inquiry. A sees it in My listings and can open a reply in their email app. A third account must not read it. The email must be taken from B's verified account, not a client-supplied value.
- Editing a published listing must return it to pending and hide it from public search. Withdrawal must hide it. Previously issued photo links can work until they expire (up to one hour).
- Check auth failures, expired sessions, failed uploads, storage limits, and offline behavior. Do not enable the public site if these fail.

## Operations and limits

Moderation is manual in the Supabase dashboard; there is no custom admin screen. Inquiries are delivered to the seller dashboard, with **no email notification** and no in-app reply thread. Sellers must check their dashboard; replies open their own email app. No payments or contract execution are implemented. Confirm the business identity, privacy/terms, support/reporting process, listing ownership review, and retention/deletion procedures before accepting public submissions. Add upload/account quotas and abuse monitoring before promoting the service broadly. The initial UI loads at most 1,000 visible listings and the 200 most recent received inquiries; pagination is future work.

Photo upload and database save are separate operations. The client tries to clean up failed uploads and removed photos, but an interrupted browser session can leave orphaned files. Periodically review and delete unused files through the Storage API/dashboard, not SQL deletion of storage metadata. Deleting an auth user removes database records but also requires Storage cleanup. Signed photo URLs expire after an hour; refresh the page to renew them.

Drafts are local to this browser and may be lost when browser data is cleared. The Download backup button exports the draft and photo data as JSON for safekeeping; automatic restore/import is not implemented.

References: [Passwordless email](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
