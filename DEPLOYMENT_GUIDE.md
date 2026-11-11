# NEW SC — customer accounts, order history & customer care

## Run locally (Windows PowerShell)
1. Install Node.js 20 or 22 LTS.
2. Open this folder in VS Code.
3. Copy `.env.example` to `.env` and set your own `SESSION_SECRET`, `ADMIN_USERNAME`, and strong `ADMIN_PASSWORD`.
4. In the terminal run `npm install` and then `npm start`.
5. Storefront: `http://localhost:3000/` | Admin: `http://localhost:3000/admin`.

## Customer features
- Customer registration and email/password sign-in.
- Passwords are stored as salted scrypt hashes, not plain text.
- Checkout prompts customers to sign in; orders placed while signed in are linked to that account.
- My Account shows only that customer's linked orders and current status.
- Customer care form creates private support tickets, optionally linked to an order owned by that account.
- Customers can read admin replies and ticket status from My Account.
- The legacy order-number + checkout-phone tracking lookup remains available for older/guest orders.

## Admin features
- Existing admin login, product management, orders, customers, inventory, delivery settings and events remain.
- New Customer Care inbox lists support tickets, customer contact details and optional order number.
- Admin can reply and set ticket status to Open, In progress, Replied or Closed.
- Saved replies appear in the customer's My Account support conversation.

## Database and existing data
- SQLite tables for customers and support tickets are created automatically.
- A `customer_id` column is added to the existing `orders` table automatically.
- Existing orders are not deleted. Older orders are not automatically assigned to a newly registered account; they remain accessible through the existing order-number + phone tracking section.
- Keep your production `data/store.db` when deploying an update. Back it up first. Do not replace it with a demo database from an archive.

## Update an existing deployment
1. Back up the existing project folder and production database.
2. Replace application source files with this package, but preserve your production `.env` and `data/store.db`.
3. Run `npm install` if dependencies changed, then `node --check server.js` and `npm start` locally.
4. Commit and push the updated source. Set the existing Render environment variables; the admin credentials do not need to change just because of this code update.
5. Open the storefront, create a test customer account, place a test order, and confirm it appears in My Account.
6. Submit a customer-care message, sign in to `/admin`, reply from Customer Care, and verify the reply appears in the customer's account.

## Required hosting environment variables
Set `NODE_ENV=production`, `SESSION_SECRET` (long random value), `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in the hosting dashboard. Never commit `.env`.

## Production warning
This project still uses SQLite in `data/` and local `public/uploads/`. On Render Free, local filesystem data may be ephemeral. Before taking real customer orders, attach persistent storage or migrate to managed PostgreSQL and move uploads to persistent object storage. This ZIP does not perform that infrastructure migration.

## Payments
Razorpay is not enabled in this build. Orders are recorded as pending/manual-payment orders; do not advertise online payment as active until payment integration is configured and tested.


## Render persistent admin/customer sessions

This build uses `connect-sqlite3` instead of express-session's default in-memory store.

1. In the Render Dashboard, open your NEW SC Web Service and open its **Disks** page.
2. Add a persistent disk with mount path `/var/data` (choose a small size to start).
3. In **Environment**, set `SESSION_STORE_DIR=/var/data/sessions`.
4. Keep `NODE_ENV=production`, `SESSION_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` set.
5. Deploy the updated code. The app creates `/var/data/sessions` automatically.

The session database is stored at `/var/data/sessions/sessions.sqlite`. Keep the same
`SESSION_SECRET` between deploys; changing it invalidates existing login cookies.

**Plan note:** Render persistent disks are available only to paid web services. Free
services have an ephemeral filesystem, so this SQLite session store cannot survive a
restart/deploy there. Use an external persistent session store (for example managed
Postgres/Redis) if you need to remain on a free Render service.

**Separate data warning:** This change persists login sessions only. The store's
`data/store.db` and `public/uploads` are still stored in the app directory in this build.
They need their own persistent-storage migration before relying on Render for permanent
orders, customer accounts, products, or uploaded images. Do not delete or replace your
current production database during this session-only update.
