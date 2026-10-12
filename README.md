# OpenHome Market

**Your home. Your buyer. Your move.**

A responsive first-stage prototype for an owner-to-owner real estate marketplace in San Antonio, Texas. Clean rebuild for the existing repository `sharonballi49/Openhome-market-`.

## Run

Open `index.html` in a modern browser, or serve the folder with `python3 -m http.server 8000` and open `http://localhost:8000`. No packages, build step, or external assets are required.

## Included

- Responsive home search by neighborhood, ZIP, maximum price, bedrooms, and property type.
- Price sorting, property details, saved homes, and empty states.
- Demo seller form with input validation, local draft persistence, and deletion.
- Original SVG home illustrations, explicitly labeled as illustrations.
- Native accessible dialogs, labeled inputs, keyboard focus indicators, reduced-motion support.

All six sample homes, prices, and descriptions are fictional. Local drafts and saved homes use browser localStorage. There is no backend and no data is submitted anywhere. Private browsing or blocked browser storage can prevent persistence.

## Before public launch

Implement authentication, a shared database, photo storage, owner verification, listing moderation, buyer inquiries, showing requests, reporting, and spam controls. Add privacy terms and marketplace terms after review of the operating model. Decide on the hosting provider and backend before collecting personal information. No payment, messaging, professional-service integration, verification claim, or actual seller account is implemented.

The name, domain, and trademark availability have not been checked. This repository contains the clean prototype source. Hosting is separate from source storage. GitHub Pages can serve the root directory as a static site.

## Validation

JavaScript syntax and static asset references checked locally. Browser visual and interaction testing remains to be done. This is a prototype, not a production-ready transaction platform.
