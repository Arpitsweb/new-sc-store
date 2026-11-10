const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "store.db");
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        public_sku TEXT NOT NULL UNIQUE,
        internal_sku TEXT NOT NULL UNIQUE,
        price REAL NOT NULL,
        old_price REAL DEFAULT 0,
        offer_text TEXT DEFAULT '',
        status TEXT DEFAULT 'In stock',
        badge TEXT DEFAULT 'New',
        rating REAL DEFAULT 4.8,
        description TEXT,
        image TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        customer_name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        total_amount REAL NOT NULL,
        items_json TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        note TEXT DEFAULT '',
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        subtitle TEXT,
        description TEXT,
        image TEXT,
        date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.get("SELECT COUNT(*) AS count FROM products", (err, row) => {
      if (err) return console.error(err);

      if (row.count === 0) {
        const seedProducts = [
          {
            name: "Aster Silk Shirt",
            category: "women",
            public_sku: "UT-WS-204",
            internal_sku: "INT-WS-204",
            price: 2499,
            old_price: 3499,
            offer_text: "Save 29%",
            status: "In stock",
            badge: "Best seller",
            rating: 4.9,
            description: "Soft satin finish, everyday elegance, all-day comfort.",
            image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=80"
          },
          {
            name: "Monarch Overshirt",
            category: "men",
            public_sku: "UT-MS-118",
            internal_sku: "INT-MS-118",
            price: 2899,
            old_price: 3999,
            offer_text: "Save 28%",
            status: "In stock",
            badge: "New",
            rating: 4.8,
            description: "Structured layering piece for sharp, elevated looks.",
            image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=80"
          },
          {
            name: "Velvet Accent Tote",
            category: "accessories",
            public_sku: "UT-AC-331",
            internal_sku: "INT-AC-331",
            price: 1799,
            old_price: 2499,
            offer_text: "Limited Offer",
            status: "Low stock",
            badge: "Limited",
            rating: 5.0,
            description: "Statement tote with premium finish and daily utility.",
            image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&q=80"
          }
        ];

        const stmt = db.prepare(`
          INSERT INTO products
          (name, category, public_sku, internal_sku, price, old_price, offer_text, status, badge, rating, description, image)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        seedProducts.forEach((p) => {
          stmt.run([
            p.name,
            p.category,
            p.public_sku,
            p.internal_sku,
            p.price,
            p.old_price,
            p.offer_text,
            p.status,
            p.badge,
            p.rating,
            p.description,
            p.image
          ]);
        });

        stmt.finalize();
      }
    });

    db.get("SELECT COUNT(*) AS count FROM events", (err, row) => {
      if (err) return console.error(err);

      if (row.count === 0) {
        const seedEvents = [
          {
            title: "Summer Drop",
            subtitle: "Streetwear Reloaded",
            description: "New summer essentials now live.",
            image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=80",
            date: "2026-11-15"
          },
          {
            title: "Weekend Sale",
            subtitle: "Up to 40% Off",
            description: "Limited-time fashion sale for this weekend.",
            image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=80",
            date: "2026-11-22"
          }
        ];

        const stmt = db.prepare(`
          INSERT INTO events (title, subtitle, description, image, date)
          VALUES (?, ?, ?, ?, ?)
        `);

        seedEvents.forEach((e) => {
          stmt.run([e.title, e.subtitle, e.description, e.image, e.date]);
        });

        stmt.finalize();
      }
    });

    db.get("SELECT COUNT(*) AS count FROM orders", (err, row) => {
      if (err) return console.error(err);

      if (row.count === 0) {
        const orders = [
          {
            order_number: "UT241001",
            customer_name: "Riya Sharma",
            email: "riya@test.com",
            phone: "+91 98765 43210",
            address: "Pune, Maharashtra",
            total_amount: 4999,
            items_json: JSON.stringify([{ name: "Aster Silk Shirt", qty: 1, price: 2499 }]),
            status: "paid"
          },
          {
            order_number: "UT241002",
            customer_name: "Arjun Mehta",
            email: "arjun@test.com",
            phone: "+91 99887 66554",
            address: "Mumbai, Maharashtra",
            total_amount: 2899,
            items_json: JSON.stringify([{ name: "Monarch Overshirt", qty: 1, price: 2899 }]),
            status: "shipped"
          }
        ];

        const stmt = db.prepare(`
          INSERT INTO orders
          (order_number, customer_name, email, phone, address, total_amount, items_json, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        orders.forEach((o) => {
          stmt.run([
            o.order_number,
            o.customer_name,
            o.email,
            o.phone,
            o.address,
            o.total_amount,
            o.items_json,
            o.status
          ]);
        });

        stmt.finalize();
      }
    });
  });
}

module.exports = { db, initDatabase };