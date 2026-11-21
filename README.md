# EventFlow Pro

**Hire verified event staff in minutes, and see your labour budget change live.**

EventFlow Pro is a web app for event managers in Pakistan (weddings, mehndis, walimas, corporate dinners, expos):

* **Managers** create an event, plan how many waiters, security and other staff they need, and hire them from a marketplace. A budget meter updates with every hire and drop.
* **Admins** check workers' CNIC and certificates. Approved workers get a **Verified Pro** badge, and only they can be hired.
* The whole app works in **English and Urdu** (right-to-left).

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

After the password the app asks for a **6-digit code**. No SMS service is connected, so the code is **shown on the screen** in a blue box. Type it in.

### Things to try (about 3 minutes)

1. **Manager:** on the Dashboard press **Fill now** → you land on the Aslam Wedding roster.
2. Press **Hire** on someone in the left list, or **drag their card onto an empty slot**. Watch the budget meter move.
3. Press **Drop** on someone, then **Undo** in the black message at the bottom (you have 10 seconds).
4. Saeed Akhtar is **booked elsewhere** (orange row). Press **Replace** next to one of the suggested people.
5. Open **Analytics** to see the savings charts, and **Export CSV**.
6. Switch to **اردو** at the top right.
7. **Admin:** log out, log in as admin, open a document in the **Audit Queue**, then mark every field **Matches** and **Approve**, or **Reject** with a reason.

---

## 💻 Run it on your own computer

**You need:** [Node.js](https://nodejs.org) version **22.13 or newer**. Check with `node -v`.

```bash
git clone https://github.com/<your-username>/eventflow-pro.git
cd eventflow-pro
npm run setup      # install packages (about 1 minute)
npm run build      # build the website
npm start          # start the app
```

Open **http://localhost:4000** and log in with a test account above.

| Command | What it does |
|---|---|
| `npm run setup` | Installs packages for the server and the website |
| `npm run build` | Builds the website into `client/dist` |
| `npm start` | Starts the app on port 4000 (creates demo data on the first run) |
| `npm run seed` | Wipes the database and fills it with fresh demo data |
| `npm run dev` | For developers: the page reloads on save (website on http://localhost:5173) |

**Problems?**
* `node:sqlite` error → your Node.js is too old. Install version 22.13 or newer.
* Port 4000 already in use → `PORT=5000 npm start` (Windows PowerShell: `$env:PORT=5000; npm start`).
* Want clean data → `npm run seed`, then start again.

---

## 🚀 Put it online (Render, free)

1. Push this code to GitHub.
2. Go to **https://render.com** and sign up with your GitHub account.
3. Click **New + → Blueprint** and pick the `eventflow-pro` repository.
4. Render reads `render.yaml` and fills in everything. Click **Apply**.
5. Wait about 3–5 minutes for the first build. Your link appears at the top (for example `https://eventflow-pro.onrender.com`).
6. Put that link in this README and in Section 1 of the report.

`render.yaml` creates a random `JWT_SECRET` for you, so no password is ever stored in the code. Every new push to GitHub redeploys the app by itself.

---

## 🗂️ Project structure

```
eventflow-pro/
├── client/                 Website (React + Vite)
│   └── src/
│       ├── pages/          One file per screen group (Dashboard, Roster, Admin…)
│       ├── components/     Shared parts: layout, buttons, charts, dialogs
│       ├── i18n-ur.js      Urdu translations
│       └── styles.css      Colours, fonts, spacing (from the Phase 3 style guide)
├── server/                 API + database (Node.js + Express + SQLite)
│   ├── index.js            All API routes and the rules they check
│   ├── db.js               Database tables
│   ├── seed.js             Demo data
│   └── lib.js              Rank formula, time-clash and staff-ratio rules
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

The field-staff mobile screens from Phase 3 (S12–S15) are not part of this build.

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
| /api/health | GET | Used by Render to check the app is up | — |

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
* Generative AI: Claude (Anthropic) was used to help write the code, as declared in the Phase 4 report.
