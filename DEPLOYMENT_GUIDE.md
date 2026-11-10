# NEW SC — fixed admin and local run guide

## Run locally (Windows PowerShell)
1. Install Node.js 20 or 22 LTS.
2. Open this folder in VS Code.
3. Copy `.env.example` to `.env`.
4. Set a long random `SESSION_SECRET`, and your own `ADMIN_USERNAME` and strong `ADMIN_PASSWORD` in `.env`.
5. In the terminal run:
   ```powershell
   npm install
   npm start
   ```
6. Storefront: http://localhost:3000/  |  Admin: http://localhost:3000/admin

## Admin features implemented
- Login/logout with server-side session and login throttling.
- Product create, read, update, delete; image upload (5 MB max; JPG/PNG/WEBP/GIF).
- Live order list, order detail view and status updates.
- Customer list derived from actual orders.
- Event create/delete.
- Dashboard stock/revenue/order metrics and notifications.
- Public product API for storefront; internal SKU is only returned to admin.
- Checkout creates a pending manual-payment order. Razorpay is intentionally disabled for now.

## Important free-hosting limitation
This build currently uses SQLite and stores uploaded images in `public/uploads`. These are suitable for local testing, but Render Free has an ephemeral filesystem: SQLite changes and uploaded files can be lost on restart/redeploy. Do NOT accept real customer orders on a Render Free deployment until the database has been migrated to managed PostgreSQL and image uploads have been moved to persistent object storage. Render's free web service can also sleep when idle. Add the hosting environment variables from `.env` in the Render dashboard; never upload `.env` to GitHub.

## Deploy outline (after persistent storage migration)
- Push this folder to a private GitHub repository (exclude `.env`, `node_modules`).
- Create a Render Web Service from that repository.
- Build command: `npm install`; start command: `npm start`.
- Add `NODE_ENV=production`, a strong `SESSION_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in Render Environment.
- Before public production launch, migrate SQLite to managed PostgreSQL and images to persistent object storage; this package does not claim that migration is complete.

## Payment
Razorpay is intentionally not enabled. Orders are recorded as `pending`; payment needs to be arranged manually until Razorpay is implemented and tested with real credentials.
