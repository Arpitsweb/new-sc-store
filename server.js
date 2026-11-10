const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const cors = require("cors");
const session = require("express-session");
const multer = require("multer");
require("dotenv").config();
const { db, initDatabase } = require("./database");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
if (isProduction && (!process.env.SESSION_SECRET || !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD)) {
  throw new Error("Set SESSION_SECRET, ADMIN_USERNAME and ADMIN_PASSWORD in hosting environment variables.");
}
app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const uploadDir = path.join(__dirname, "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) return cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed."));
    cb(null, true);
  }
});

app.use(session({
  name: "newsc_admin_sid",
  secret: process.env.SESSION_SECRET || "local-development-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: isProduction, sameSite: "lax", maxAge: 1000 * 60 * 60 * 8 }
}));
app.use(express.static(path.join(__dirname, "public")));

let loginAttempts = new Map();
function requireAdmin(req, res, next) {
  if (req.session?.isAdmin) return next();
  return res.status(401).json({ error: "Please log in as administrator." });
}
function asyncRoute(handler) { return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next); }
function run(sql, params=[]) { return new Promise((resolve,reject)=>db.run(sql,params,function(err){ if(err) reject(err); else resolve({lastID:this.lastID,changes:this.changes}); })); }
function all(sql, params=[]) { return new Promise((resolve,reject)=>db.all(sql,params,(err,rows)=>err?reject(err):resolve(rows))); }
function get(sql, params=[]) { return new Promise((resolve,reject)=>db.get(sql,params,(err,row)=>err?reject(err):resolve(row))); }
function productPayload(body) {
  const price = Number(body.price);
  const oldPrice = Number(body.oldPrice || 0);
  return {
    name: String(body.name || "").trim(), category: String(body.category || "essentials").trim().toLowerCase(),
    publicSku: String(body.publicSku || "").trim(), internalSku: String(body.internalSku || "").trim(),
    price, oldPrice, offerText: String(body.offerText || "").trim(), status: String(body.status || "In stock"),
    badge: String(body.badge || "New"), rating: Number(body.rating || 4.8),
    description: String(body.description || "").trim(), image: String(body.image || "")
  };
}

initDatabase();

app.get("/api/health", (_req,res)=>res.json({status:"ok", service:"NEW SC"}));
app.get("/api/admin/session", (req,res)=>res.json({isAdmin:!!req.session?.isAdmin, username:req.session?.adminUsername || null}));
app.post("/api/admin/login", (req,res)=>{
  const ip=req.ip || req.socket.remoteAddress || "unknown";
  const attempt=loginAttempts.get(ip) || {count:0,until:0};
  if(attempt.until>Date.now() && attempt.count>=8) return res.status(429).json({error:"Too many login attempts. Try again in 15 minutes."});
  const username=String(req.body.username || "");
  const password=String(req.body.password || "");
  const expectedUser=process.env.ADMIN_USERNAME || "admin";
  const expectedPass=process.env.ADMIN_PASSWORD || "";
  const userOk=crypto.timingSafeEqual(Buffer.from(username.padEnd(256).slice(0,256)),Buffer.from(expectedUser.padEnd(256).slice(0,256)));
  const passOk=expectedPass && crypto.timingSafeEqual(Buffer.from(password.padEnd(256).slice(0,256)),Buffer.from(expectedPass.padEnd(256).slice(0,256)));
  if(!expectedPass || !userOk || !passOk){
    attempt.count+=1; if(attempt.count>=8) attempt.until=Date.now()+15*60*1000; loginAttempts.set(ip,attempt);
    return res.status(401).json({error:"Invalid username or password."});
  }
  loginAttempts.delete(ip);
  req.session.regenerate(err=>{
    if(err) return res.status(500).json({error:"Could not create secure session."});
    req.session.isAdmin=true; req.session.adminUsername=username;
    req.session.save(saveErr=>saveErr?res.status(500).json({error:"Could not save login session."}):res.json({success:true}));
  });
});
app.post("/api/admin/logout",(req,res)=>req.session.destroy(()=>{res.clearCookie("newsc_admin_sid");res.json({success:true});}));

// Public storefront catalogue: never expose internal SKU to visitors.
app.get("/api/products",asyncRoute(async(_req,res)=>{
  const rows=await all("SELECT id,name,category,public_sku,price,old_price,offer_text,status,badge,rating,description,image FROM products WHERE lower(status) != 'out of stock' ORDER BY id DESC");
  res.json(rows);
}));
app.get("/api/admin/products",requireAdmin,asyncRoute(async(_req,res)=>res.json(await all("SELECT * FROM products ORDER BY id DESC"))));
app.get("/api/products/:id",requireAdmin,asyncRoute(async(req,res)=>{
  const row=await get("SELECT * FROM products WHERE id=?",[req.params.id]);
  if(!row) return res.status(404).json({error:"Product not found."}); res.json(row);
}));
app.post("/api/products",requireAdmin,upload.single("imageFile"),asyncRoute(async(req,res)=>{
  const p=productPayload(req.body); if(req.file) p.image=`/uploads/${req.file.filename}`;
  if(!p.name||!p.category||!p.publicSku||!p.internalSku||!Number.isFinite(p.price)||p.price<=0) return res.status(400).json({error:"Name, category, both SKUs and a valid price are required."});
  const result=await run(`INSERT INTO products(name,category,public_sku,internal_sku,price,old_price,offer_text,status,badge,rating,description,image) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[p.name,p.category,p.publicSku,p.internalSku,p.price,p.oldPrice,p.offerText,p.status,p.badge,p.rating,p.description,p.image]);
  res.status(201).json({id:result.lastID,message:"Product added."});
}));
app.put("/api/products/:id",requireAdmin,upload.single("imageFile"),asyncRoute(async(req,res)=>{
  const p=productPayload(req.body); if(req.file) p.image=`/uploads/${req.file.filename}`;
  if(!p.name||!p.category||!p.publicSku||!p.internalSku||!Number.isFinite(p.price)||p.price<=0) return res.status(400).json({error:"Name, category, both SKUs and a valid price are required."});
  const old=await get("SELECT image FROM products WHERE id=?",[req.params.id]); if(!old) return res.status(404).json({error:"Product not found."});
  if(!req.file && !p.image) p.image=old.image || "";
  const result=await run(`UPDATE products SET name=?,category=?,public_sku=?,internal_sku=?,price=?,old_price=?,offer_text=?,status=?,badge=?,rating=?,description=?,image=? WHERE id=?`,[p.name,p.category,p.publicSku,p.internalSku,p.price,p.oldPrice,p.offerText,p.status,p.badge,p.rating,p.description,p.image,req.params.id]);
  res.json({success:true,changes:result.changes});
}));
app.delete("/api/products/:id",requireAdmin,asyncRoute(async(req,res)=>{
  const result=await run("DELETE FROM products WHERE id=?",[req.params.id]); if(!result.changes) return res.status(404).json({error:"Product not found."}); res.json({success:true});
}));
app.post("/api/upload",requireAdmin,upload.single("image"),(req,res)=>{if(!req.file)return res.status(400).json({error:"Choose an image."});res.status(201).json({url:`/uploads/${req.file.filename}`});});

app.get("/api/orders",requireAdmin,asyncRoute(async(_req,res)=>res.json(await all("SELECT * FROM orders ORDER BY id DESC"))));
app.patch("/api/orders/:id/status",requireAdmin,asyncRoute(async(req,res)=>{
  const allowed=["pending","confirmed","processing","shipped","out_for_delivery","delivered","cancelled","paid","refunded"];
  const status=String(req.body.status||"").toLowerCase();
  if(!allowed.includes(status)) return res.status(400).json({error:"Invalid order status."});
  const order=await get("SELECT id,status FROM orders WHERE id=?",[req.params.id]);
  if(!order) return res.status(404).json({error:"Order not found."});
  if(String(order.status).toLowerCase()!==status){
    await run("UPDATE orders SET status=? WHERE id=?",[status,req.params.id]);
    const notes={pending:"Your order has been placed.",confirmed:"Your order has been confirmed.",processing:"Your order is being prepared.",shipped:"Your order has been shipped.",out_for_delivery:"Your order is out for delivery.",delivered:"Your order has been delivered.",cancelled:"Your order has been cancelled.",paid:"Payment has been marked as received.",refunded:"Your payment has been marked as refunded."};
    await run("INSERT INTO order_status_history(order_id,status,note) VALUES(?,?,?)",[req.params.id,status,notes[status]||"Order status updated."]);
  }
  res.json({success:true,status});
}));

// Customers can look up only an order when they provide its order number and matching phone number.
app.post("/api/orders/track",asyncRoute(async(req,res)=>{
  const orderNumber=String(req.body.orderNumber||"").trim().toUpperCase();
  const phone=String(req.body.phone||"").replace(/\D/g,"");
  if(!orderNumber||phone.length<10) return res.status(400).json({error:"Enter your order number and the phone number used at checkout."});
  const order=await get("SELECT id,order_number,customer_name,total_amount,items_json,status,created_at,phone FROM orders WHERE upper(order_number)=?",[orderNumber]);
  const storedPhone=String(order?.phone||"").replace(/\D/g,"");
  if(!order||storedPhone!==phone) return res.status(404).json({error:"We couldn't find an order with those details. Check the order number and phone number."});
  const history=await all("SELECT status,note,changed_at FROM order_status_history WHERE order_id=? ORDER BY id ASC",[order.id]);
  const items=(()=>{try{return JSON.parse(order.items_json||"[]").map(i=>({name:i.name,qty:i.qty,image:i.image,price:i.price}));}catch{return [];}})();
  const statusHistory=history.length?history:[{status:order.status,note:"Your order has been placed.",changed_at:order.created_at}];
  res.set("Cache-Control","no-store");
  res.json({orderNumber:order.order_number,customerName:order.customer_name,total:order.total_amount,status:order.status,createdAt:order.created_at,items,statusHistory});
}));
app.get("/api/customers",requireAdmin,asyncRoute(async(_req,res)=>res.json(await all(`SELECT customer_name AS name,email,phone,address,COUNT(*) AS orders,SUM(total_amount) AS total_spent,MAX(created_at) AS last_order FROM orders GROUP BY lower(email),phone,customer_name ORDER BY last_order DESC`))));
app.get("/api/events",requireAdmin,asyncRoute(async(_req,res)=>res.json(await all("SELECT * FROM events ORDER BY id DESC"))));
app.post("/api/events",requireAdmin,asyncRoute(async(req,res)=>{
  const {title,subtitle,description,image,date}=req.body; if(!title||!description||!date)return res.status(400).json({error:"Title, description and date are required."});
  const result=await run("INSERT INTO events(title,subtitle,description,image,date) VALUES(?,?,?,?,?)",[title,subtitle||"",description,image||"",date]);res.status(201).json({id:result.lastID});
}));
app.delete("/api/events/:id",requireAdmin,asyncRoute(async(req,res)=>{const r=await run("DELETE FROM events WHERE id=?",[req.params.id]);if(!r.changes)return res.status(404).json({error:"Event not found."});res.json({success:true});}));
app.get("/api/admin/summary",requireAdmin,asyncRoute(async(_req,res)=>{
  const [products,orders,events]=await Promise.all([all("SELECT id,status FROM products"),all("SELECT total_amount,status FROM orders"),all("SELECT id FROM events")]);
  res.json({totalProducts:products.length,lowStock:products.filter(p=>p.status==="Low stock").length,revenue:orders.filter(o=>["paid","shipped","delivered"].includes(String(o.status).toLowerCase())).reduce((s,o)=>s+Number(o.total_amount||0),0),totalOrders:orders.length,readyToShip:orders.filter(o=>["paid","confirmed","processing"].includes(String(o.status).toLowerCase())).length,totalEvents:events.length});
}));
app.get("/api/admin/notifications",requireAdmin,asyncRoute(async(_req,res)=>{
  const [orders,low]=await Promise.all([all("SELECT order_number,customer_name,created_at FROM orders ORDER BY id DESC LIMIT 5"),all("SELECT name,status FROM products WHERE status IN ('Low stock','Out of stock') ORDER BY id DESC LIMIT 5")]);
  res.json([...orders.map(o=>({text:`New order ${o.order_number} — ${o.customer_name||"Customer"}`,date:o.created_at})),...low.map(p=>({text:`${p.name}: ${p.status}`}))]);
}));

// Payment is intentionally postponed. This endpoint supports a manual/COD order workflow only.
app.post("/api/orders",asyncRoute(async(req,res)=>{
  const {customer,items}=req.body||{};
  if(!customer?.name||!customer?.email||!customer?.phone||!customer?.address||!Array.isArray(items)||!items.length) return res.status(400).json({error:"Complete customer details and cart items are required."});
  let total=0; const verified=[];
  for(const item of items){const p=await get("SELECT id,name,public_sku,price,image,status FROM products WHERE id=?",[Number(item.id)]);const qty=Math.max(1,Math.min(20,Number(item.qty)||1));if(!p||p.status==="Out of stock")return res.status(400).json({error:"One of the products is unavailable."});total+=Number(p.price)*qty;verified.push({id:p.id,name:p.name,public_sku:p.public_sku,price:p.price,qty,image:p.image});}
  const orderNumber=`NS${Date.now().toString().slice(-9)}`;
  const created=await run("INSERT INTO orders(order_number,customer_name,email,phone,address,total_amount,items_json,status) VALUES(?,?,?,?,?,?,?,?)",[orderNumber,customer.name,customer.email,customer.phone,customer.address,total,JSON.stringify(verified),"pending"]);
  await run("INSERT INTO order_status_history(order_id,status,note) VALUES(?,?,?)",[created.lastID,"pending","Your order has been placed successfully."]);
  res.status(201).json({success:true,orderNumber,total,status:"pending",paymentMode:"Pay on delivery / payment arranged separately"});
}));

app.get("/admin",(_req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("/admin.html",(_req,res)=>res.sendFile(path.join(__dirname,"public","admin.html")));
app.get("*",(req,res,next)=>{if(req.path.startsWith("/api/"))return res.status(404).json({error:"API route not found."});res.sendFile(path.join(__dirname,"public","index.html"),err=>err&&next(err));});
app.use((err,_req,res,_next)=>{console.error(err);if(err instanceof multer.MulterError)return res.status(400).json({error:err.code==="LIMIT_FILE_SIZE"?"Image must be 5 MB or smaller.":err.message});res.status(500).json({error:err.message||"Internal server error."});});
app.listen(PORT,()=>console.log(`NEW SC running on port ${PORT}`));
