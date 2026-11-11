# NEW SC customer order tracking update

This update adds customer self-service order tracking using the order number shown after checkout and the phone number entered at checkout.

## Included
- A Track Order section in the storefront.
- A customer tracking API that verifies order number + checkout phone before returning order details.
- A persistent `order_status_history` table created automatically on startup.
- Automatic initial `pending` history entry when an order is placed.
- Admin status changes are saved to the order and appended to the status history.
- Admin can select `out_for_delivery` as a status.
- The customer timeline displays placed, confirmed, processing, shipped, out-for-delivery and delivered stages.

## Deploy the update
1. Back up your current project folder.
2. Replace the project files with the files in this ZIP's `NEW-SC` folder, or copy the changed files into your existing project:
   - `server.js`
   - `database.js`
   - `public/admin.html`
   - `public/index.html`
   - `public/script.js`
   - `public/style.css`
3. Do not replace your production `.env` or overwrite your current database file with a sample database from a ZIP.
4. From the project folder run:
   ```powershell
   node --check server.js
   node --check public/script.js
   git add server.js database.js public/admin.html public/index.html public/script.js public/style.css
   git commit -m "Add customer order tracking"
   git push
   ```
5. Render should deploy the new commit automatically.
6. Place a test order. Save the order number shown in the confirmation alert.
7. Open the Track Order section on the storefront and enter that order number and the same phone number used at checkout.
8. In Admin > Orders, change the order status and click Save. Refresh the customer tracking lookup to see the updated status.

## Important limitations
- This is self-service tracking on the website. It does not send email, SMS or WhatsApp notifications.
- The store's current database uses SQLite in the app's local `data` folder. On Render's free instance, local filesystem data may not be durable. Configure persistent storage or migrate to a managed database before relying on order history for real customers.
- The checkout currently records orders for manual/COD-style payment handling; it does not confirm an online payment.
