import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";
import config from "./config/config.js";
import fs from "fs";
import https from "https";

// SSL certificate paths
const key = fs.readFileSync("./localhost+1-key.pem");
const cert = fs.readFileSync("./localhost+1.pem");

// Database connection string
// NOTE: For production, use environment variables for this!
const DB_URL = config.MONGO_URI || "mongodb://localhost:27017/erp";
const PORT = config.PORT;

// Initialize Express App
const app = express();

// --- 1. Middleware Setup ---

// Enable CORS for all routes/origins (crucial for Angular dev server communication)
app.use(
  cors({
    origin: [
      "http://localhost:4200",
      "https://localhost:4200",
      "http://192.168.46.16:4200",
      "https://192.168.46.16:4200",
      "http://192.168.191.16:4200",
      "https://192.168.191.16:4200",
      "http://192.168.194.16:4200",
      "https://192.168.194.16:4200",
      "https://192.168.194.16:57815",
      "https://db14-2409-40d0-3103-b7ee-e1c6-3d9e-b49f-9cd5.ngrok-free.app",
      "https://rnr-erp.netlify.app"
    ],
    credentials: true,
  })
);

app.use("/api/agent", cors());
app.use(
  "/api/payments/razorpay/webhook",
  bodyParser.raw({ type: "application/json" })
);

// Body Parser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Cookie Parser Middleware
app.use(cookieParser());

// --- 2. Route Configuration ---

// Import routes
import productRoutes from "./routes/products.js";
import authRoutes from "./routes/auth.js";
import organisationRoutes from "./routes/organisation.js";
import supplierRoutes from "./routes/supplier.js";
import purchaseRoutes from "./routes/purchase.js";
import saleRoutes from "./routes/sales.js";
import onlineOrderRoutes from "./routes/onlineOrders.js";
import customerRoutes from "./routes/customers.js";
import settingsRoutes from "./routes/settings.js";
import dashboardRoutes from "./routes/dashboard.js";
import agentRoutes from "./routes/aiAgentRoutes.js";
import paymentRoutes from "./routes/payments.js";
import deliveryAgentRoutes from "./routes/deliveryAgents.js";
import notificationRoutes from "./routes/notifications.js";
import deliveryRoutes from "./routes/delivery.js";
import { startCronJobs } from "./helpers/cronJobs.js";

// Use the auth routes for all requests starting with '/api/auth'
app.use("/api/auth", authRoutes);

// Use the product routes for all requests starting with '/api/products'
app.use("/api/products", productRoutes);

// Use the org routes for all requests starting with '/api/org'
app.use("/api/org", organisationRoutes);

// Use the sales routes for all requests starting with '/api/sale'
app.use("/api/sale", saleRoutes);

// Use the online order routes for all requests starting with '/api/online-orders'
app.use("/api/online-orders", onlineOrderRoutes);

// Use the delivery agent routes
app.use("/api/delivery-agents", deliveryAgentRoutes);

// Use the delivery routes
app.use("/api/delivery", deliveryRoutes);

// Use the supplier routes for all requests starting with '/api/supplier'
app.use("/api/supplier", supplierRoutes);

// Use the purchase routes for all requests starting with '/api/purchase'
app.use("/api/purchase", purchaseRoutes);

// Use the customers routes for all requests starting with '/api/customers'
app.use("/api/customers", customerRoutes);

// Use the settigs routes
app.use("/api/settings", settingsRoutes);

// Use the dashboard routes
app.use("/api/dashboard", dashboardRoutes);

// Payment/webhook routes
app.use("/api/payments", paymentRoutes);

// Ai Agent Routes
app.use("/api/agent", agentRoutes);

// Notifications Routes
app.use("/api/notifications", notificationRoutes);

// public images
app.use("/uploads", express.static("public/uploads"));

// Optional: Basic root route for testing if the server is up
app.get("/", (req, res) => {
  console.log("Root route accessed");
  res.send("ERP Backend API is running!");
});

app.get("/test-db-connection", async (req,res)=>{
  if(mongoose.connection.readyState === 1){
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const counts = await Promise.all(
        collections.map(async c => {
          const count = await mongoose.connection.db.collection(c.name).countDocuments();
          return `${c.name}: ${count}`;
        })
      );
      res.send(`Database connection is successful!<br><br>Collections & Counts:<br>${counts.join('<br>')}`);
    } catch (err) {
      res.send(`Database connected, but error fetching collections: ${err.message}`);
    }
  }else{
    res.send("Database connection is not successful!");
  }
})

// --- 3. Database Connection ---

mongoose
  .connect(DB_URL)
  .then(() => {
    console.log("Connected to MongoDB!");
    startCronJobs();
    // Start the server ONLY after the database connection is successful
    // https.createServer({ key, cert }, app).listen(PORT, () => {
    //   console.log(`✅ Secure server running at https://localhost:${PORT}`);
    //   console.log(`🌐 Accessible over LAN at https://192.168.46.16:${PORT}`);
    // });
    app.listen(PORT, () => {
      console.log(`✅ Secure server running at https://localhost:${PORT}`);
      console.log(`🌐 Accessible over LAN at https://192.168.46.16:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Could not connect to MongoDB:", err);
    process.exit(1);
  });
