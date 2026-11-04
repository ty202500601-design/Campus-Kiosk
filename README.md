# SchoolBites – Smart School Canteen Kiosk
Run: `node server.js` (Node 18+, no install) → http://localhost:3000
Demo logins (password `demo`): `student`, `vendor` (Canteen A), `vendorb` (Canteen B), `admin`.
- Customize canteens, menu, school name and fee at the top of `server.js`; colors in `public/index.html` (`:root`).
- Server validates prices, availability, open status, roles, and duplicate submissions. Data is in memory (resets on restart).
- GCash is a labeled demo placeholder and is never marked paid. `supabase/schema.sql` is the PostgreSQL/RLS schema for production.
