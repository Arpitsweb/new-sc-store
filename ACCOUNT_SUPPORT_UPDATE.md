# Customer account and support update

Added customer registration/sign-in, account-linked order history, and customer-care conversations. Customer passwords use salted scrypt hashes. Admin replies are visible to the customer in My Account.

Existing order tracking by order number + checkout phone remains available for orders that are not associated with a customer account. Older orders are not automatically claimed by new accounts.

For an existing deployment, preserve `.env` and `data/store.db`; the application creates the new customer/support tables and adds `orders.customer_id` automatically. Back up the database before deploying.
