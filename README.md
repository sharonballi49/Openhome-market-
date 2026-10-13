# OpenHome Market

**Your home. Your buyer. Your move.**

San Antonio owner-to-owner marketplace, hosted on GitHub Pages. The public site currently runs in **demo/private-draft mode**. No real listings, buyer messages, accounts, or payments are live yet.

## Working now

- Home search, price sorting, saved homes, and fictional sample listings.
- My listings dashboard: create, edit, delete, and download backups of private local drafts.
- Up to six home photos per draft, resized to JPEG with metadata removed; cover selection and property gallery.
- Storage failures keep the form open instead of falsely claiming the draft was saved.
- Proposed seller/business pricing, lender placeholders, and an independent contract-help section explaining attorneys, brokers, and title companies.
- Safety resources with official Bexar appraisal/deed links, plus clearly labeled interactive demos of approval, private messages, blocking, and reports.

Local drafts and favorites are stored in this browser. They are not uploaded or published. Clearing browser data removes them. JSON backups are available; automatic import/restore is not implemented.

## Prepared, not activated

Email-code sign-in, invitation-only seller submissions, private ownership details/photo storage, moderator approval, owner editing/withdrawal, private conversations, blocking, and safety reports are implemented behind `config.js` (disabled by default). See [backend/SETUP.md](backend/SETUP.md) for the Supabase setup and required staging checks. No backend account was created and no live service integration has been verified.

Database policies restrict pending listings and photos to their owners and authorized moderators. Only an administrator can publish a listing. Account emails are not selectable by conversation partners. Messages and replies are restricted to the buyer and seller, with per-account rate limits and blocking enforced by the server. Moderators see reported content snapshots, with no access to unrelated chats. Moderator decisions are logged and reject stale listing revisions. Public records links assist manual review; automated identity/ownership verification is not implemented. Email notifications and browser-based membership administration are not included.

## Run and validate

Serve this folder with a static web server. No production build step is required. `vendor/supabase.js` is the pinned 2.57.4 UMD distribution of `@supabase/supabase-js`; its MIT license is included. It only connects to a service when configuration is enabled.

Development checks:

```sh
npm install
npm test
```

DOM interaction checks cover drafts, editing, deletion, escaped content, search, pricing, and quota failures. PGlite tests exercise the SQL with simulated Supabase auth/storage tables and two account roles plus an unrelated user. They verify private/published visibility, owner-only writes, pilot invitations, private property information, reviewer checks and stale revisions, storage policies, private messages, bidirectional blocks, report evidence, restricted moderator access, takedown, and throttling. DOM tests also cover the safety demos and private-state clearing. These checks do not replace end-to-end tests against a configured Supabase service. Browser visual QA was unavailable in this session.

## Business configuration

Proposed launch plans: free basic listings; $49/30-day featured homes; $99 marketing kits; $49/month ads for local home-service businesses. Checkout is not connected. Professional fees are independently agreed and paid directly. Contract-help profiles remain empty until real providers are selected. Founding contract/closing professionals are intended to begin with free profiles; any later paid settlement-service arrangement requires separate review.

Approved external lender links belong in `partners.js`. Do not add invented companies, prices, credentials, or partnerships. Sponsored profiles must be identified. The marketplace does not prepare contracts, provide legal advice, approve loans, or hold earnest money.
