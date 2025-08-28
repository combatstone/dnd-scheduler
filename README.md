# D&D Scheduler

This project is a collaborative scheduling tool for D&D campaigns,
built with Next.js, Firebase, and Tailwind CSS.

## Setup
1. Copy `.env.local.example` â†’ `.env.local`
2. Add your Firebase config.
3. Run `npm install`
4. Run `npm run dev`

---
## Quick start
1. Create Firebase project, enable **Authentication â†’ Google** and **Firestore**.
2. Copy `.env.local.example` to `.env.local` and fill with Firebase web config.
3. Deploy `firestore.rules` to secure reads/writes.
4. `npm i && npm run dev`.

## Notes
- Invite link is the campaign URL; any signed-in user can open it to join via UI once you add a simple "Join" action (future).
- Availability buckets are stored in the session document for simplicity.
- Time inputs use native `datetime-local` for low dependency.
