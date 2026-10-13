# OpenHome Market

**Your home. Your buyer. Your move.**

San Antonio owner-to-owner marketplace, hosted on GitHub Pages. The public site currently runs in **demo/private-draft mode**. No real listings, buyer messages, accounts, or payments are live yet.

## Working now

- Home search, price sorting, saved homes, and fictional sample listings.
- My listings dashboard: create, edit, delete, and download backups of private local drafts.
- Up to six home photos per draft, resized to JPEG with metadata removed; cover selection and property gallery.
- Storage failures keep the form open instead of falsely claiming the draft was saved.
- Proposed seller/business pricing, lender placeholders, and an independent contract-help section explaining attorneys, brokers, and title companies.

Local drafts and favorites are stored in this browser. They are not uploaded or published. Clearing browser data removes them. JSON backups are available; automatic import/restore is not implemented.

## Prepared, not activated

Email-code sign-in, shared listing submissions, private photo storage, manual listing approval, owner editing/withdrawal, and authenticated buyer inquiries are implemented behind `config.js` (disabled by default). See [backend/SETUP.md](backend/SETUP.md) for the Supabase setup and required staging checks. No backend account was created and no live service integration has been verified.

Database policies restrict pending listings and photos to their owners. Only an administrator can publish a listing. Inquiries use the buyer's verified account email, with per-account rate limits and access restricted to the buyer and seller. Sellers see received messages in My listings; reply opens their email app. Email notifications, a custom moderation interface, and in-app reply threads are not included.

## Run and validate

Serve this folder with a static web server. No production build step is required. `vendor/supabase.js` is the pinned 2.57.4 UMD distribution of `@supabase/supabase-js`; its MIT license is included. It only connects to a service when configuration is enabled.

Development checks:

```sh
npm install
npm test
```

DOM interaction checks cover drafts, editing, deletion, escaped content, search, pricing, and quota failures. PGlite tests exercise the SQL with simulated Supabase auth/storage tables and two account roles plus an unrelated user. They verify private/published visibility, owner-only writes, approval restrictions, storage policies, inquiry identity/access, and throttling. These checks do not replace end-to-end tests against a configured Supabase service. Browser visual QA was unavailable in this session.

## Business configuration

Proposed launch plans: free basic listings; $49/30-day featured homes; $99 marketing kits; $49/month ads for local home-service businesses. Checkout is not connected. Professional fees are independently agreed and paid directly. Contract-help profiles remain empty until real providers are selected. Founding contract/closing professionals are intended to begin with free profiles; any later paid settlement-service arrangement requires separate review.

Approved external lender links belong in `partners.js`. Do not add invented companies, prices, credentials, or partnerships. Sponsored profiles must be identified. The marketplace does not prepare contracts, provide legal advice, approve loans, or hold earnest money.
