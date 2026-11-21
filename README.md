# EventFlow Pro

**Hire verified event staff in minutes, and see your labour budget change live.**

EventFlow Pro is a web app for event managers in Pakistan (weddings, mehndis, walimas, corporate dinners, expos):

* **Managers** create an event, plan how many waiters, security and other staff they need, and hire them from a marketplace. A budget meter updates with every hire and drop.
* **Field staff** (waiters, security, ushers…) sign up, upload their CNIC and certificates, accept shift invites and check what uniform to wear. Their screens are made for phones.
* **Admins** check workers' CNIC and certificates. Approved workers get a **Verified Pro** badge, and only they can be hired.
* The whole app works in **English and Urdu** (right-to-left).

One link serves everyone: managers and admins get the desktop layout, field staff get the phone layout. On a computer the staff screens open in a phone-sized window in the middle of the page.

Course project for **CS3014 Applied Human-Computer Interaction, FAST NUCES, Fall 2026 (Phase 4)**.

---

## 🔗 Live demo

**https://eventflow-pro.onrender.com** ← replace with your Render link after deploying

> The app runs on Render's free plan. If nobody has used it for 15 minutes it goes to sleep, so **the first visit can take about 50 seconds**. After that it is fast.
> The demo data resets every time the server restarts, so feel free to try anything.

### Log in with a test account

| Role | Mobile number | Password |
|---|---|---|
| Event manager (Tariq Mehmood) | `03001234567` | `Manager@123` |
| Admin (Farah Naz) | `03111234567` | `Admin@123` |
| Field staff, verified (Bilal Khan) | `03211234567` | `Staff@123` |
| Field staff, CNIC rejected (Asif Mehmood) | `03219876543` | `Staff@123` |

You can also press **Create account → Field Staff** to sign up as a new worker.

After the password the app asks for a **6-digit code**. No SMS service is connected, so the code is **shown on the screen** in a blue box. Type it in.

### Things to try (about 3 minutes)

1. **Manager:** on the Dashboard press **Fill now** → you land on the Aslam Wedding roster.
2. Press **Hire** on someone in the left list, or **drag their card onto an empty slot**. Watch the budget meter move.
3. Press **Drop** on someone, then **Undo** in the black message at the bottom (you have 10 seconds).
4. Saeed Akhtar is **booked elsewhere** (orange row). Press **Replace** next to one of the suggested people.
5. Open **Analytics** to see the savings charts, and **Export CSV**.
6. Switch to **اردو** at the top right.
7. **Field staff (best on a phone):** log in as Bilal. **Accept** the Nishat Annual Dinner invite, open the **Uniform Guide**, tick the checklist and press **I'm Uniform Ready**. Then log in as the manager again: Bilal shows **Uniform Ready** on the Aslam Wedding roster.
8. **New worker:** create a Field Staff account, open **Verify**, type your CNIC details and add photos of the front and back. Photos over 5 MB get a **Compress and use** button.
9. **Admin:** log in as admin, open the new document in the **Audit Queue** (you will see the uploaded photos), mark every field **Matches** and **Approve**, or **Reject** with a reason. The worker sees the reason on their Verify screen.

---

## 💻 Run it on your own computer

**You need:** [Node.js](https://nodejs.org) version **22.13 or newer**. Check with `node -v`.

```bash
git clone https://github.com/usmanaliclouds/eventflow-pro.git
cd eventflow-pro
npm run build      # installs packages and builds the website (about 1 minute)
npm start          # starts the app
```

Open **http://localhost:4000** and log in with a test account above.

| Command | What it does |
|---|---|
| `npm run build` | Installs packages and builds the website into `client/dist` |
| `npm start` | Starts the app on port 4000 (creates demo data on the first run) |
| `npm run seed` | Wipes the database and fills it with fresh demo data |
| `npm run dev` | For developers: the page reloads on save (website on http://localhost:5173) |

**Problems?**
* `node:sqlite` error → your Node.js is too old. Install version 22.13 or newer.
* Port 4000 already in use → `PORT=5000 npm start` (Windows PowerShell: `$env:PORT=5000; npm start`).
* Want clean data → `npm run seed`, then start again.

---

## 🚀 Put it online

The app is a single Node.js service: the server also serves the website. Any host that runs Node.js 22.13+ or a Dockerfile works. You don't need to change any settings:

* **Build command:** `npm run build`
* **Start command:** `npm start`
* **Port:** the host's `PORT` variable is used automatically

### Option A: Render (free, no card)

1. Sign up at **https://render.com** with GitHub.
2. **New + → Blueprint** → pick `eventflow-pro` → **Apply**. `render.yaml` sets everything, including a random `JWT_SECRET`.
3. After 3–5 minutes the link appears at the top of the service page.

If you made a normal **Web Service** instead of a Blueprint, set Build Command `npm run build`, Start Command `npm start`, and add an environment variable `NODE_VERSION` = `22.14.0`.

### Option B: Railway (trial credit, then paid)

1. Sign up at **https://railway.com** with GitHub.
2. **New Project → Deploy from GitHub repo** → pick `eventflow-pro`. Railway finds the `Dockerfile` and builds it.
3. Open the service → **Variables** → add `JWT_SECRET` = any long random text.
4. **Settings → Networking → Generate Domain** gives you the public link.

### Notes for any host

* `JWT_SECRET` keeps people logged in across restarts. Without it everyone is logged out when the server restarts, but nothing breaks.
* On free plans the database file is not kept between restarts, so the app starts again with fresh demo data. That is fine for a demo.
* Free Render services sleep after 15 minutes without visitors. The first visit after that takes about 50 seconds.

---

## 🗂️ Project structure

```
eventflow-pro/
├── client/                 Website (React + Vite)
│   └── src/
│       ├── pages/          One file per screen group (Dashboard, Roster, Admin, Staff…)
│       ├── components/     Shared parts: layout, buttons, charts, dialogs
│       ├── i18n-ur.js      Urdu translations
│       └── styles.css      Colours, fonts, spacing (from the Phase 3 style guide)
├── server/                 API + database (Node.js + Express + SQLite)
│   ├── index.js            All API routes and the rules they check
│   ├── db.js               Database tables
│   ├── seed.js             Demo data
│   └── lib.js              Rank formula, time-clash and staff-ratio rules
├── Dockerfile              Build recipe for Railway, Koyeb, Fly.io…
├── render.yaml             Settings for hosting on Render
└── package.json            The commands listed above
```

---

## 📱 Screens

Screen IDs match the Phase 2 sitemap.

| Screen | What you can do |
|---|---|
| S1 Language | Pick Urdu or English on the first visit |
| S3 Register | Choose a role and fill in your details. Every field is checked. |
| S4 Login + code | Phone, password and a 6-digit code. Shows how many tries are left. Locks for 15 minutes after too many wrong tries. |
| S5 Dashboard | Unfilled-slot alert, summary numbers, upcoming events, events waiting for a review |
| S6 Create Event | 3 steps: details → staffing plan → review. Live cost estimate. Asks "Leave without saving?" if you navigate away. |
| S7 Talent Marketplace | Removable filters, sort, grid or list view. People booked at that time are hidden. |
| S8 Staff profile | How the rank is made, credentials, reviews, Hire |
| S9 Live Roster & Budget | Hire by button or drag-and-drop, budget meter with a 90% alert, Drop + 10-second Undo, conflict suggestions, edit plan, confirm roster |
| S10 Post-event review | Stars, tags and a comment for each person |
| S11 Savings Analytics | Charts, filters, Export CSV and PDF |
| S16 Audit Queue | Pending documents, filters, keyboard shortcuts (J, K, Enter) |
| S17 Document review | Zoom and rotate, check each field, approve or reject with a reason |
| S18 Notifications | Bell panel, unread tab, mark all as read |
| S19 Settings & Help | Language, text size up to 200%, high contrast, notifications |
| S20 System states | Loading, empty, error with "Try again", offline bar, session expired, page not found |

**Field staff (phone layout)**

| Screen | What you can do |
|---|---|
| S12 My Shifts | Verification prompt, next shift highlighted, accept or decline invites, past shifts. Still opens offline with the last saved shifts. |
| Shift details | Venue with a Maps link, call the manager, open the uniform guide |
| S13 Verify | Status tracker (Not submitted → Pending audit → Verified Pro), CNIC details, step-by-step photo upload with tips. Warns about wrong file types and photos over 5 MB, and offers to compress them. Shows the admin's reason after a rejection, with Re-upload. |
| S14 Uniform Guide | Correct and incorrect outfit pictures, a text version when pictures can't be seen, a checklist, and "I'm Uniform Ready" (the manager sees it). Works offline. |
| S15 Profile & Availability | Rank, rating and jobs, edit work type, rate and city, weekly availability grid (tap or drag), unsaved-changes warning |

---

## 🛠️ Tech stack

| Part | Used |
|---|---|
| Website | React 18, Vite 5, React Router 6 |
| Icons and fonts | Lucide icons; Inter and Noto Nastaliq Urdu (Google Fonts) |
| Charts | Hand-drawn SVG (no chart library) |
| Server | Node.js, Express 4 |
| Database | SQLite (built into Node.js), file `server/data/eventflow.db` |
| Login | Passwords hashed with bcrypt, 6-digit code, session cookie that expires after 8 hours |
| Checks | Every request is validated on the server (zod), not only in the browser |

### Security

* No passwords, keys or database files are in this repository.
* The server checks every rule itself: budget limit, number of slots, double booking, Verified-only hiring, the undo time limit, the reject reason, and who is allowed to open what.
* Managers never see another company's event names, only "booked elsewhere".
* CNIC images are never shown to managers.

<details>
<summary><b>API endpoints</b></summary>

| Endpoint | Method | Purpose | Screen |
|---|---|---|---|
| /api/auth/register | POST | Create account, send code | S3 |
| /api/auth/login | POST | Check phone + password, send code | S4 |
| /api/auth/verify-otp | POST | Check code, start session | S4 |
| /api/auth/resend-otp | POST | New code after 45 s | S4 |
| /api/auth/me, /api/auth/logout | GET, POST | Current user / log out | all |
| /api/me/settings | PATCH | Language, text size, contrast, notifications | S19 |
| /api/dashboard | GET | Alert, summary, upcoming, needs review | S5 |
| /api/events | GET, POST | List upcoming / create event | S6, S7 |
| /api/events/:id | GET | Roster, budget, conflicts | S9 |
| /api/events/:id/plan | PUT | Edit staffing plan and budget | S9 |
| /api/events/:id/confirm | POST | Confirm roster | S9 |
| /api/staff | GET | Marketplace search with filters | S7, S9 |
| /api/staff/:id | GET | Profile and rank breakdown | S8 |
| /api/events/:id/bookings | POST | Hire | S7–S9 |
| /api/bookings/:id/drop | POST | Drop (warns if too few staff for the guests) | S9 |
| /api/bookings/:id/undo | POST | Undo a drop within 10 s | S9 |
| /api/events/:id/review, /reviews | GET, POST | Post-event ratings | S10 |
| /api/analytics | GET | Savings numbers and charts | S11 |
| /api/notifications | GET, POST, DELETE | List, read, dismiss | S18 |
| /api/admin/queue | GET | Pending documents | S16 |
| /api/admin/documents/:id | GET | One document with profile data | S17 |
| /api/admin/documents/:id/approve, /reject | POST | Decision | S17 |
| /api/admin/reviewed | GET | Past decisions | Reviewed |
| /api/staff-app/home | GET | Shifts, verification status, rank | S12 |
| /api/staff-app/shifts/:id | GET | One shift with its uniform guide | S12, S14 |
| /api/staff-app/shifts/:id/accept, /decline | POST | Answer an invite | S12 |
| /api/staff-app/shifts/:id/uniform | POST | Save checklist, mark Uniform Ready | S14 |
| /api/staff-app/verification | GET | Document status and rejection reasons | S13 |
| /api/staff-app/documents | POST | Upload CNIC or certificate photos (max 5 MB each) | S13 |
| /api/staff-app/profile | GET, PUT | Profile and weekly availability | S15 |
| /api/health | GET | Lets the host check the app is up | — |

</details>

<details>
<summary><b>Database tables</b></summary>

| Table | Main fields | Purpose |
|---|---|---|
| users | role, full_name, phone, password_hash, language, text_size | Accounts and settings |
| otp_codes | user_id, code_hash, expires_at, attempts | Login codes |
| staff_profiles | primary_role, rate, rating_avg, jobs_completed | Worker details used for the rank |
| documents | doc_type, status, reject_reasons, reject_message | CNIC and certificates for audit |
| events | name, date, times, venue, guests, budget_cap, status, actual_spend | Events |
| event_roles | role, count, rate range, uniform | Staffing plan |
| bookings | event_id, staff_id, rate, status, dropped_at | Who is on which roster |
| reviews | stars, tags, comment | Post-event ratings |
| notifications | title, body, link, is_read | Bell panel |
| audit_log | actor, action, target, detail | Record of drops, undos, approvals, rejections |
| availability | staff_id, day, slot | Weekly times a worker is free |

</details>

---

## 👥 Team

| Member | Roll no. | Built |
|---|---|---|
| Usman Ali Shahid (group leader) | 24F-0512 | _fill in_ |
| Abdul Hayee Kamran | 24F-0596 | _fill in_ |
| Taheer Bin Hussain | 24F-0567 | _fill in_ |

Instructor: Mughees Ismail

## 🙏 Credits

* Icons: [Lucide](https://lucide.dev) (ISC licence)
* Fonts: [Inter](https://fonts.google.com/specimen/Inter) and [Noto Nastaliq Urdu](https://fonts.google.com/noto/specimen/Noto+Nastaliq+Urdu) (SIL Open Font Licence)
* All people, companies and events in the demo data are made up.
