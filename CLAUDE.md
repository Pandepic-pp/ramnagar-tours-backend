# Tours Website Backend — CLAUDE.md

## What This Is
REST API for the Uttarakhand tours & cab booking website (base: Ramnagar, Uttarakhand).
Mobile-number login via OTP (2Factor.in SMS). Data in MongoDB. Session via httpOnly JWT cookie.
Modelled on `../../backend` (ChargeOnGo) — same layering and response shape.

## Stack
| Layer | Choice |
|-------|--------|
| Runtime | Node.js 18+ (TypeScript, ES modules, `tsx` for dev) |
| Framework | Express 4 |
| Database | MongoDB + Mongoose 8 |
| Auth | 2Factor.in OTP → JWT in httpOnly cookie |
| Validation | Joi |
| Security | Helmet, CORS allowlist, express-rate-limit |

## Folder Layout
```
server.ts       Entry — connect DB, then listen
src/
  config/       env.ts (validated env — import this, never read process.env elsewhere), db.ts, catalog.ts (places, vehicles, rate card, pricing rules)
  controllers/  Thin — call service, return ApiResponse. No business logic here.
  middleware/   auth.ts (verifyToken + cookie options), errorHandler.ts, validate.ts
  models/       User, OtpSession, OtpAttempt, Booking
  routes/       index.ts → auth, bookings, admin
  services/     auth.service.ts (OTP + session logic), sms.service.ts (2Factor client), booking.service.ts, pricing.service.ts (fare engine, has unit tests: npm test)
  utils/        ApiError, ApiResponse, asyncHandler
  validators/   Joi schemas
```

## Auth Flow
1. `POST /api/auth/send-otp { phone }` → backend generates a 6-digit OTP (`crypto.randomInt`), stores an HMAC of it in `OtpSession` (TTL 5 min), sends it via 2Factor.
2. `POST /api/auth/verify-otp { phone, otp }` → compare-and-delete in one DB op (single-use). On success finds-or-creates the `User` and sets the `tours_session` cookie.
3. Browser sends the cookie automatically (`fetch(..., { credentials: 'include' })`). `verifyToken` decodes it and loads the User into `req.user`.

## Rate Limiting & Abuse Protection
- `send-otp`: 5 requests / 15 min / IP (each call costs an SMS), plus a 30 s per-phone resend cooldown
- `verify-otp`: 20 requests / 15 min / IP
- 5 wrong OTPs → phone blocked 15 min (`OtpAttempt`); the attempt is counted *before* comparing so parallel guesses can't exceed the limit
- Global: 100 requests / 15 min / IP. `trust proxy` is on in production (behind nginx) so IP limits see real client IPs.

## Response Shape
```json
{ "success": true|false, "message": "...", "data": { ... } }
```

## APIs
```
POST /api/auth/send-otp     Public — { phone } → { expiresAt }
POST /api/auth/verify-otp   Public — { phone, otp } → { userId, phone, name, isNewUser } + Set-Cookie
GET  /api/auth/me           Auth   — { userId, phone, name, email, role }
GET  /api/auth/session      Public — same as /me, or `data: null` (still 200) when signed out. The site calls this on load.
POST /api/auth/logout       Public — clears the cookie
GET   /api/catalog                  Public — places (with distance/starting fare from Ramnagar), vehicles, pricing rules
POST  /api/quotes                   Public — { pickupId, destinationId, tripType, pickupAt, returnDate?, passengers } → fares for all 4 vehicles (60 / 15 min / IP)
POST  /api/bookings                 Auth — catalogue: { pickupId, destinationId, vehicle, tripType, pickupAt (ISO, +05:30), returnDate?, passengers?, name?, notes?, quotedTotal? }
                                          (server prices it, stores a fare snapshot; 409 if quotedTotal differs) OR legacy free text { pickup, destination, pickupAt, ... } (no fare) → booking (201)
GET   /api/bookings                 Auth — my bookings, newest pickup first
PATCH /api/bookings/:id/cancel      Auth — cancel my open booking
GET   /api/admin/bookings           Admin — open bookings (?status=requested|assigned|completed|cancelled|all), open work soonest first, history newest first
PATCH /api/admin/bookings/:id/complete Admin — assigned → completed
PATCH /api/admin/bookings/:id/assign Admin — { driverName, driverPhone, vehicleModel, vehicleNumber } → status "assigned"
GET  /health, /api/health   → { status: "ok"|"degraded", db, uptimeSec, timestamp } (503 if the DB does not answer). Registered before the rate limiter so host probes are never throttled.
```

## Key Decisions
- **OTP self-generated, 2Factor is only the SMS carrier** (same as the ChargeOnGo backend). OTPs are stored HMAC-hashed (keyed with `JWT_SECRET`), never in plaintext.
- **Cookie, not Bearer token** — this is a browser site; an httpOnly cookie keeps the JWT away from page scripts. Cookie is `SameSite=Lax`, so the site and API must share a registrable domain (e.g. `www.x.com` + `api.x.com`). If they ever don't, switch to `SameSite=None; Secure` or proxy `/api` through the frontend.
- **Demo OTP is opt-in and dev-only** — `DEMO_OTP=123456` makes every sign-in accept that code and skips the SMS (credit saver). `env.ts` refuses to start if it is set in production, and logs a warning when it is on. Blank it to get real OTPs. Separately, with `TWO_FACTOR_API_KEY` blank (non-production) the OTP is printed to the console. Wrong-guess limits still apply.
- **India-only phones** — `+91` + 10 digits starting 6–9. Widen `normalizePhone` and the validator if international tourists need to sign in.
- **Bookings** — reference `RT-YYYYMMDD-XXXX` (unique, look-alike characters removed). Pickup must be 30 min to 1 year ahead. A user can hold at most 5 open (requested/assigned) bookings. The first booking saves the name to the profile. Contact name/phone are snapshotted on the booking.
- **Admins are made by hand** — set `role: 'admin'` on the user document in MongoDB. There is deliberately no endpoint to become admin. The dispatch UI is in `../client` (/admin).
- **Soft deletes** — `isActive: false`; disabled users are refused at login and by `verifyToken`.
- **2Factor URL contains the API key** — never log the request URL or fetch errors (see `sms.service.ts`).

## Health monitor
`healthMonitor.service.ts` calls our own public `/health` on start and every 10 minutes and logs `[health] <India time> | OK | HTTP 200 | db: connected | N ms` (errors go to stderr). Hitting the public URL keeps a free Render instance from idling out while it is awake. It cannot wake an instance that has already spun down.

## Pricing (pricing.service.ts, rates in config/catalog.ts)
Whole rupees, every line rounded as created so lines sum to the total. One way: max(distance, 80 km; 30 km if within 40 km) × one-way rate, vehicle minimum fare.
Round trip: max(2 × distance, daily minimum × days) × round-trip rate; daily minimum 250 km outstation, 80 km local (≤ 40 km). Plus driver night stay per night,
night pickup (11 pm to 4 am IST) flat, peak season 10% of base (windows in catalog). Passed through without GST: estimated tolls (both ways on a round trip) and inter-state permit.
GST 5% on fare + extras, then round to the nearest ₹10. Road distance is curated from Ramnagar; other pairs are estimated and bounded by the triangle inequality.
**All rates, distances, drive times and tolls are placeholders: TODO(client).** To use a maps API later, replace `roadKmBetween` only.

## Env Vars
| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string, with the database name |
| `TWO_FACTOR_API_KEY` | 2Factor.in API key — required in production |
| `TWO_FACTOR_TEMPLATE` | Optional DLT-approved OTP template name; blank = 2Factor default |
| `JWT_SECRET` | 32+ char random string (also keys the OTP hash — rotating it invalidates pending OTPs, which is fine) |
| `JWT_EXPIRES_IN_DAYS` | Session lifetime, default 30 |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins (no `*` — credentials are on) |
| `DEMO_OTP` | Dev only: fixed 6-digit OTP, no SMS sent. Blank = real OTPs. Refused in production. |
| `TRUST_PROXY_HOPS` | Proxies in front of the app (production). 1 = Render only, 2 = Vercel proxying /api to Render. Wrong value = everyone shares one IP for rate limits. |
| `HEALTH_CHECK_URL` | Public URL the 10-minute health monitor pings. Falls back to Render's `RENDER_EXTERNAL_URL`, then localhost. |
| `PORT` | Default 5100 (Render sets its own) |

## Running
```bash
npm install
cp .env.example .env   # fill in MONGODB_URI and TWO_FACTOR_API_KEY
npm run dev
```

## Adding New Phases
Follow the same pattern: model → validator → service → controller → route → update this file.
Planned next: admin UI for the booking board, SMS/WhatsApp confirmation when a driver is assigned, booking status `completed`.
