# My Letters (v1.60) and Optional Google Sign-In (Deferred)

**Date:** 2026-09-30
**Status:** Plan approved in principle. Nothing built yet.
**Current live version:** v1.50

This document records a decision and two plans:

1. **Build now (v1.60):** "My Letters", which saves letters on the user's device with **no sign-in**.
2. **Deferred:** optional "Sign in with Google" plus Google Drive sync. The full design is kept below so it can be picked up later without redoing the research.

---

## 1. The decision and why

We were asked to add optional Google sign-in so people could save letters and track appeals, while keeping all health information on the user's side.

After reviewing the code, we decided **not to build sign-in yet**. We'll build the no-sign-in "My Letters" version first.

**Reasons:**

- **Trust is the product.** The privacy page promises *"No Accounts. No Tracking. No Database."* For older, stressed users uploading medical papers, that promise matters. Sign-in would require giving it up.
- **Too many moving parts for a volunteer project:**
  - a Google Cloud project, a consent screen and brand verification
  - a D1 database and Worker routes
  - session cookies, a privacy rewrite and Drive permissions

  Each one is something that can break, and someone has to maintain it.
- **Login code is high-risk code.** A mistake there is a security problem, not just a bug.
- **Sign-in alone doesn't protect letters.** In the proposed Phase 1, letters were still stored only on the device. Users might believe "I signed in, so it's saved" when it isn't.
- **What users actually need doesn't require an account:** keeping their letters, tracking status and not missing the deadline.
- **User counting has an anonymous alternative:** the Cloudflare dashboard already shows daily Worker requests, which approximates letters written without collecting emails.

**When to revisit sign-in:** when users ask to get their letters on another device. By then My Letters will exist, and Drive sync can be added on top (see section 4).

---

## 2. Facts found during the review (still true as of v1.50)

1. **The Worker does not log letter content.** `cloudflare/worker.js` has no `console.log` and writes to no database, KV, R2 or D1. It adds the API key and forwards the request to Anthropic.
   - *To confirm:* check that the code deployed in the Cloudflare dashboard matches the repo file.
2. **The privacy page (`public/privacy.html`) makes promises that any saving feature must update:**
   - "No Accounts. No Tracking. No Database."
   - "No Analytics. No Ad Networks. No Cookies From Us."
   - "Nothing Saved in Your Browser Either". It says *"We do not save anything to localStorage, IndexedDB, or browser cookies."*
   - `docs/hipaa-compliance-analysis.html` makes the same claim ("Nothing is written to localStorage, IndexedDB…").
3. **Calendar reminders already exist.** `src/lib/calendar.js` (`downloadAppealReminder`) creates an `.ics` file with reminders 14, 7 and 3 days before the deadline, plus one on the day. It's used on the letter screen when an appeal deadline is known.
4. **iPhone storage limit.** Safari deletes a website's stored data (IndexedDB, localStorage) after about **7 days without a visit**, unless the site was added to the Home Screen. Anything "saved on this device" can disappear on iPhones. We can ask the browser to keep the data (`navigator.storage.persist()`), but that isn't guaranteed.
5. **Cross-site cookies.** The Worker runs at `icy-silence-e717.rob-3ea.workers.dev`, a different site from `healthcareadvocate.org`. Browsers block login cookies set by a different site. Any future sign-in must run the auth endpoints on the same site, at `healthcareadvocate.org/api/*`, using a Cloudflare Worker route.
6. **No analytics scripts** are loaded on the site today.

---

## 3. Plan to build now: "My Letters" (v1.60), no sign-in

### What users get

- A **"💾 Save this letter"** button on the letter screens: the denial appeal letters and the bill dispute letters.
- A **My Letters** screen, reachable from the header, the home screen and after saving. For each saved letter it shows:
  - date saved, insurer, plan type (or "Medical bill")
  - status: **Draft / Sent / Waiting / Won / Lost**, changeable
  - denial date and deadline, with **days left**
  - buttons to open, copy, download (.txt) and delete
- **"Download all my letters"**: one file backup of everything saved.
- **"Add to my calendar"**: reuses `calendar.js` to make the `.ics` deadline reminder.
- **Deadline help:** a date field for the deadline, with the hint *"Most job-based and ACA plans give you 180 days. Check your denial letter for your exact deadline."* (Medicare Advantage is usually 65 days, and Medicaid varies by state. The hint must not state one number as fact.)
- A clear note on the My Letters page:
  > Your letters are saved only on this device. We never see them. Clearing your browser will erase them. On iPhone, letters can be erased if you don't visit for about a week, unless you add this app to your Home Screen. Use "Download all my letters" to keep a backup.
- English and Spanish (tú) through the existing toggle and `src/i18n/es.js`.
- Works with the Back button (from v1.50): My Letters is its own screen in the history.

### What is stored where

| Data | Where | Server sees it? |
|---|---|---|
| Saved letters and their details (insurer, plan type, status, dates, extra details) | The browser's IndexedDB, on this device only | **No** |
| Letter generation (unchanged) | Browser → Worker → Anthropic | Passes through, never stored |
| Anything else | Nothing new | — |

No accounts, no cookies, no database and no Worker changes.

### Files

| File | Change |
|---|---|
| `src/lib/letterStore.js` (new) | IndexedDB wrapper: save, list, update status and dates, delete, delete all, export all. No new libraries. |
| `src/lib/letterStore.test.js` (new) | Tests, using an in-memory IndexedDB stand-in. |
| `src/components/MyLetters.jsx` (new) | The My Letters screen. |
| `src/components/MyLetters.test.jsx` (new) | Tests: list, status change, delete, download, Spanish. |
| `src/lib/calendar.js` | Small additions if needed (e.g. days-left helper). |
| `src/App.jsx` | Save buttons, header link, new `my_letters` screen, back-button support. |
| `src/i18n/es.js` | Spanish strings (tú). |
| `public/privacy.html` | **Small update, drafted first for owner review:** replace "Nothing Saved in Your Browser Either" with "Letters you choose to save stay in your browser. We never see them." |
| `docs/hipaa-compliance-analysis.html` | Same correction to the "nothing written to IndexedDB" claim. |
| `package.json` | Version `1.60.0` (footer shows v1.60). |

### Testing

- Automated tests for storage, the My Letters screen, status changes, deletion, the download file and the Spanish text.
- A **network-request test**: run save, list, edit and delete while recording every `fetch` call, and fail if letter text goes anywhere. Saving must make **zero** network requests.
- **Manual checks by the owner:**
  - save a letter, reload, and it's still there
  - delete one, then "delete all"
  - "Download all" opens correctly
  - the calendar file opens on iPhone and Android
  - everything works in English and Spanish

### Deployment

The usual steps: `npm run build`, then upload the changed files from `dist/` with FileZilla (the new `assets/index-*.js` first, then `sw.js`, then `index.html`), plus the updated `privacy.html`. There are no Worker or Cloudflare changes.

---

## 4. Deferred plan: optional Google sign-in and Drive sync

Keep this for when users ask for their letters on other devices. Build it **on top of** My Letters.

### Rules from the original request

- Sign-in stays optional, and anyone can write a letter without it.
- The server stores **only**: Google account ID (`sub`), email, date joined and last sign-in.
- Health data (uploads, extracted facts, extra details, letters, appeal status) never goes to our database, logs or analytics.
- English and Spanish.

### Architecture

| Data | Where | Server sees it? |
|---|---|---|
| Google `sub`, email, joined date, last sign-in | Cloudflare **D1** table `users` | Yes, only these 4 fields |
| Session | Signed cookie (HMAC with `SESSION_SECRET`), HttpOnly, Secure, SameSite=Lax, Path=/api, about 30 days. No session table. | Only the `sub` inside the cookie |
| Letters and status | IndexedDB (from v1.60) | No |
| Drive copy | The user's own Google Drive, hidden app-data folder, synced **directly from the browser** | No |

D1 was chosen over KV because counting users and deleting a user are simple SQL.

### Worker endpoints to add (`cloudflare/worker.js`)

These run on the route `healthcareadvocate.org/api/*`, and the existing AI proxy stays unchanged.

| Endpoint | What it does |
|---|---|
| `POST /api/auth/google` | Receives the Google ID token. Verifies the signature against Google's public keys (JWKS, RS256 via WebCrypto) and checks `aud` = our client ID, `iss` = accounts.google.com, `exp`, and `email_verified`. Then creates or updates the user row and sets the session cookie. |
| `GET /api/me` | Returns `{ email }` if signed in. |
| `POST /api/logout` | Clears the cookie. |
| `DELETE /api/account` | Deletes the user row and clears the cookie. |

- **Cross-site request protection:** SameSite=Lax cookies, and every write request must come from our site (checked with the `Origin` header).
- **Table (`cloudflare/schema.sql`):**
  ```sql
  CREATE TABLE users (
    sub TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_login_at TEXT NOT NULL
  );
  ```

### Front end

- `src/lib/auth.js`: loads Google Identity Services (`accounts.google.com/gsi/client`) **only when the user taps Sign in**, so Google doesn't see every visitor.
- `src/components/SignInButton.jsx`: small header button, plus a "Sign in with Google to save your letters" box after a letter is made. Google's button supports a `locale` setting for Spanish.
- `src/lib/driveSync.js`: Drive sync done entirely in the browser (see below).
- **Delete my account:**
  - removes the D1 row and clears the session
  - offers to erase this device's letters
  - if Drive is connected, deletes the app-data files and revokes the Drive permission (`google.accounts.oauth2.revoke`)

### Drive scope

- **Scope:** `https://www.googleapis.com/auth/drive.appdata`, a hidden folder private to this app. It **cannot** see the user's other Drive files.
- **Google's classification:** Google's Drive API scope guide lists `drive.appdata` (and `drive.file`) as **non-sensitive and recommended**. Sign-in scopes (`openid`, `email`, `profile`) are also non-sensitive.
- **Verification:**
  - Non-sensitive scopes need only **basic brand verification**: a homepage on a verified domain, a privacy policy on the same domain, domain ownership proven in Google Search Console, and following Google's button branding rules.
  - There's **no security assessment**.
  - Confirm the exact status on the consent screen at setup time.
- **When to ask for it:** request the Drive permission **only when the user turns on "Also save to my Google Drive"**, not at sign-in. Use the GIS token client (`initTokenClient`) for a short-lived access token in the browser.
- **User visibility:** users can't see app-data files in Drive. They can remove them under Drive → Settings → Manage apps.

### Owner setup checklist

**Google Cloud (about 20 minutes):**
1. Create a project.
2. Set up the OAuth consent screen:
   - type: External
   - app name, support email, homepage and privacy policy URL
   - authorized domain `healthcareadvocate.org`
3. Create an OAuth Client ID of type **Web application**:
   - authorized JavaScript origins: `https://healthcareadvocate.org`, `https://www.healthcareadvocate.org` and `http://localhost:5173`
   - no client secret is needed
   - the client ID is public
4. For Drive sync, enable the **Google Drive API** and add the `drive.appdata` scope.
5. Verify the domain in **Google Search Console**, then set the app to "In production."

**Cloudflare:**
1. Create a D1 database and run `schema.sql` in its console.
2. Bind the database to the Worker as `DB`.
3. Add a Worker **secret** `SESSION_SECRET` (a long random value) and a variable `GOOGLE_CLIENT_ID`.
4. Add the Worker route `healthcareadvocate.org/api/*` (and `www.` if used).
5. Paste in the updated `worker.js`.

### Privacy page

This must be rewritten **before** sign-in goes live:
- what we store: email and dates only
- what stays with the user: everything else
- that Google is used for sign-in
- that the Drive copy lives in the user's own Google account

Draft it in `docs/`, which isn't deployed, and publish only after the owner approves.

### Testing checklist

- Not signed in: everything still works.
- Sign in, save, reload, delete, sign out, then delete account.
- Drive sync across two browsers.
- The calendar file opens on iPhone and Android.
- English and Spanish.
- A network-request test proves no letter content reaches our server except the existing AI letter-generation request.

### Suggested staging

1. Sign-in plus the user record.
2. Drive sync.
3. Account controls and the privacy page.

Release each stage separately.
