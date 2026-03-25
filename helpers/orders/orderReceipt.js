import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import Organisation from "../../models/organisation.js";
import { resolveImageMediaUrl } from "../media/mediaAssets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const RECEIPT_DIRECTORY = path.join(
  BACKEND_ROOT,
  "public",
  "uploads",
  "order-receipts"
);

const getPuppeteerManagedExecutablePath = () => {
  try {
    return puppeteer.executablePath();
  } catch {
    return undefined;
  }
};

const BROWSER_EXECUTABLE_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  getPuppeteerManagedExecutablePath(),
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/snap/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const formatCurrency = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;

const formatDateTime = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const resolveBrowserExecutablePath = async () => {
  for (const candidate of BROWSER_EXECUTABLE_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep checking known Chromium-based browser locations.
    }
  }

  return undefined;
};

const buildOrderReceiptHtml = ({ order, organisation }) => {
  const itemsMarkup = order.items
    .map(
      (item, index) => `
        <tr>
          <td style="padding: 13px 16px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #9ca3af; font-variant-numeric: tabular-nums;">${String(index + 1).padStart(2, "0")}</td>
          <td style="padding: 13px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #111827; font-weight: 600; letter-spacing: -0.01em;">${escapeHtml(item.productName)}</td>
          <td style="padding: 13px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #374151; text-align: center; font-variant-numeric: tabular-nums;">${escapeHtml(item.quantity)}</td>
          <td style="padding: 13px 16px; border-bottom: 1px solid #f0f0f0; font-size: 13px; color: #6b7280; text-align: right; font-variant-numeric: tabular-nums;">${formatCurrency(item.price)}</td>
          <td style="padding: 13px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #111827; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums;">${formatCurrency(item.price * item.quantity)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Order Receipt</title>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body style="margin: 0; padding: 40px 24px; background: #edecea; font-family: 'DM Sans', sans-serif; color: #111827; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 760px; margin: 0 auto; background: #ffffff; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.06), 0 20px 60px rgba(0,0,0,0.10);">

          <!-- ACCENT BAR -->
          <div style="height: 4px; background: linear-gradient(90deg, #c8a96e 0%, #e8c98a 50%, #c8a96e 100%);"></div>

          <!-- HEADER -->
          <div style="padding: 36px 44px 32px; background: #0f1117; color: #ffffff; position: relative; overflow: hidden;">
            <!-- subtle diagonal texture lines -->
            <div style="position: absolute; inset: 0; background: repeating-linear-gradient(135deg, transparent, transparent 40px, rgba(255,255,255,0.015) 40px, rgba(255,255,255,0.015) 41px); pointer-events: none;"></div>

            <div style="position: relative; display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; flex-wrap: wrap;">
              <!-- Left: Brand -->
              <div style="flex: 1 1 300px;">
                <div style="display: inline-block; font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #c8a96e; font-weight: 500; margin-bottom: 10px; border: 1px solid rgba(200,169,110,0.4); padding: 4px 10px; border-radius: 2px;">Order Receipt</div>
                <h1 style="margin: 0 0 14px; font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; color: #ffffff;">${escapeHtml(organisation?.name || "Your Shop")}</h1>
                <div style="font-size: 13px; line-height: 1.8; color: #9ca3af; font-weight: 300;">
                  <div>${escapeHtml(organisation?.address || "Address unavailable")}</div>
                  <div>Phone: ${escapeHtml(organisation?.phone || "N/A")}</div>
                  <div>GST: <span style="color: #d1d5db; font-weight: 500;">${escapeHtml(organisation?.gst || "N/A")}</span></div>
                </div>
              </div>

              <!-- Right: Receipt meta -->
              <div style="min-width: 200px; text-align: right; padding-top: 4px;">
                <div style="font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase; color: #6b7280; font-weight: 500;">Receipt No.</div>
                <div style="margin-top: 5px; font-size: 13px; font-weight: 600; color: #e5e7eb; letter-spacing: 0.03em; font-variant-numeric: tabular-nums;">${escapeHtml(String(order._id))}</div>
                <div style="margin-top: 18px; font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase; color: #6b7280; font-weight: 500;">Issued On</div>
                <div style="margin-top: 5px; font-size: 15px; font-weight: 600; color: #ffffff;">${escapeHtml(formatDateTime(order.createdAt || new Date()))}</div>
              </div>
            </div>
          </div>

          <!-- DIVIDER STRIP -->
          <div style="height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb 20%, #e5e7eb 80%, transparent);"></div>

          <!-- INFO CARDS -->
          <div style="padding: 28px 44px 8px; display: flex; gap: 16px; flex-wrap: wrap;">
            <!-- Customer -->
            <div style="flex: 1 1 260px; padding: 20px 22px; border: 1px solid #f0f0f0; border-radius: 4px; background: #fafafa; border-left: 3px solid #c8a96e;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 2.5px; color: #9ca3af; font-weight: 500; margin-bottom: 12px;">Customer</div>
              <div style="font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 10px; word-break: break-all;">${escapeHtml(order.customerNumber)}</div>
              <div style="font-size: 12.5px; line-height: 1.7; color: #6b7280;">
                <div style="display: flex; gap: 8px; align-items: center;">
                  <span style="width: 6px; height: 6px; background: ${order.paymentMethod === "COD" ? "#f59e0b" : "#10b981"}; border-radius: 50%; display: inline-block; flex-shrink: 0;"></span>
                  <span>Payment: <strong style="color: #374151;">${escapeHtml(String(order.paymentMethod || "unknown").toUpperCase())}</strong></span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                  <span style="width: 6px; height: 6px; background: ${order.status === "confirmed" ? "#10b981" : "#f59e0b"}; border-radius: 50%; display: inline-block; flex-shrink: 0;"></span>
                  <span>Status: <strong style="color: #374151; text-transform: capitalize;">${escapeHtml(order.status || "pending")}</strong></span>
                </div>
              </div>
            </div>

            <!-- Fulfilment -->
            <div style="flex: 1 1 260px; padding: 20px 22px; border: 1px solid #f0f0f0; border-radius: 4px; background: #fafafa; border-left: 3px solid #d1d5db;">
              <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 2.5px; color: #9ca3af; font-weight: 500; margin-bottom: 12px;">Fulfilment</div>
              <div style="font-size: 12.5px; line-height: 1.8; color: #6b7280;">
                <div><span style="color: #374151; font-weight: 600;">Delivery Address</span></div>
                <div style="margin-bottom: 8px; color: #111827;">${escapeHtml(order.deliveryAddress || "Pickup order")}</div>
                <div><span style="color: #374151; font-weight: 600;">Notes</span></div>
                <div style="color: #9ca3af; font-style: italic;">${escapeHtml(order.notes || "No special instructions")}</div>
              </div>
            </div>
          </div>

          <!-- ITEMS TABLE -->
          <div style="padding: 20px 44px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #111827;">
                  <th style="padding: 10px 16px 10px 0; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #9ca3af; font-weight: 500; width: 44px;">#</th>
                  <th style="padding: 10px 16px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #9ca3af; font-weight: 500;">Item</th>
                  <th style="padding: 10px 16px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #9ca3af; font-weight: 500; width: 70px;">Qty</th>
                  <th style="padding: 10px 16px; text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #9ca3af; font-weight: 500; width: 110px;">Unit Price</th>
                  <th style="padding: 10px 16px 10px 16px; text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: #9ca3af; font-weight: 500; width: 110px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsMarkup}
              </tbody>
            </table>
          </div>

          <!-- TOTALS + FOOTER -->
          <div style="padding: 20px 44px 40px; display: flex; justify-content: flex-end;">
            <div style="width: 300px;">
              <!-- Summary lines -->
              <div style="padding: 16px 0; border-top: 1px solid #f0f0f0;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #9ca3af; margin-bottom: 9px;">
                  <span>Total Items</span>
                  <span style="color: #374151; font-weight: 500;">${escapeHtml(order.items.length)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #9ca3af;">
                  <span>Total Units</span>
                  <span style="color: #374151; font-weight: 500;">${escapeHtml(
                    order.items.reduce(
                      (sum, item) => sum + Number(item.quantity || 0),
                      0
                    )
                  )}</span>
                </div>
              </div>

              <!-- Grand Total -->
              <div style="margin-top: 4px; padding: 18px 20px; background: #0f1117; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #9ca3af; font-weight: 500;">Grand Total</span>
                <span style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 700; color: #c8a96e; letter-spacing: -0.02em;">${formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          <!-- FOOTER NOTE -->
          <div style="padding: 18px 44px; background: #fafafa; border-top: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="font-size: 11px; color: #d1d5db; letter-spacing: 0.05em;">Thank you for your order.</div>
            <div style="font-size: 11px; color: #d1d5db; letter-spacing: 0.05em; font-style: italic;">${escapeHtml(organisation?.name || "Your Shop")}</div>
          </div>

          <!-- BOTTOM ACCENT BAR -->
          <div style="height: 4px; background: linear-gradient(90deg, #c8a96e 0%, #e8c98a 50%, #c8a96e 100%);"></div>

        </div>
      </body>
    </html>
  `;
};

const renderReceiptImage = async (html, outputPath) => {
  const executablePath = await resolveBrowserExecutablePath();

  if (!executablePath) {
    throw new Error(
      "No Chromium executable found for Puppeteer. Set PUPPETEER_EXECUTABLE_PATH or install one with `npx puppeteer browsers install chrome`."
    );
  }

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 980, height: 1400, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.screenshot({
      path: outputPath,
      type: "png",
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
};

export const generateOrderReceiptAssets = async (orderDocument) => {
  const order = orderDocument.toObject
    ? orderDocument.toObject()
    : orderDocument;
  const organisation = await Organisation.findById(order.organisationId).lean();

  await fs.mkdir(RECEIPT_DIRECTORY, { recursive: true });

  const fileName = `order-${order._id}-${Date.now()}.png`;
  const localFilePath = path.join(RECEIPT_DIRECTORY, fileName);
  const publicRelativePath = `/uploads/order-receipts/${fileName}`;
  const html = buildOrderReceiptHtml({ order, organisation });

  await renderReceiptImage(html, localFilePath);

  const mediaUrl = await resolveImageMediaUrl({
    localFilePath,
    publicRelativePath,
    folder: "order-receipts",
  });

  return {
    localFilePath,
    publicRelativePath,
    mediaUrl,
  };
};
