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

const buildOrderReceiptHtml = ({ order, organisation }) => {
  const itemsMarkup = order.items
    .map(
      (item, index) => `
        <tr>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111827;">${index + 1}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111827; font-weight: 600;">${escapeHtml(item.productName)}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #4b5563; text-align: center;">${escapeHtml(item.quantity)}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #4b5563; text-align: right;">${formatCurrency(item.price)}</td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #111827; text-align: right; font-weight: 600;">${formatCurrency(item.price * item.quantity)}</td>
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
      </head>
      <body style="margin: 0; padding: 32px; background: #f3f4f6; font-family: Arial, sans-serif; color: #111827;">
        <div style="max-width: 900px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 24px; overflow: hidden; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);">
          <div style="padding: 32px 36px; background: linear-gradient(135deg, #111827 0%, #1f2937 100%); color: #ffffff;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;">
              <div>
                <div style="font-size: 13px; letter-spacing: 1.8px; text-transform: uppercase; opacity: 0.72;">Order Receipt</div>
                <h1 style="margin: 12px 0 8px; font-size: 32px; line-height: 1.15;">${escapeHtml(organisation?.name || "Your Shop")}</h1>
                <div style="font-size: 14px; line-height: 1.6; opacity: 0.9;">
                  <div>${escapeHtml(organisation?.address || "Address unavailable")}</div>
                  <div>Phone: ${escapeHtml(organisation?.phone || "N/A")}</div>
                  <div>GST: ${escapeHtml(organisation?.gst || "N/A")}</div>
                </div>
              </div>
              <div style="min-width: 220px; padding: 18px 20px; border-radius: 18px; background: rgba(255, 255, 255, 0.1); text-align: right;">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.4px; opacity: 0.7;">Receipt No.</div>
                <div style="margin-top: 6px; font-size: 18px; font-weight: 700;">${escapeHtml(String(order._id))}</div>
                <div style="margin-top: 14px; font-size: 12px; text-transform: uppercase; letter-spacing: 1.4px; opacity: 0.7;">Issued On</div>
                <div style="margin-top: 6px; font-size: 15px; font-weight: 600;">${escapeHtml(formatDateTime(order.createdAt || new Date()))}</div>
              </div>
            </div>
          </div>

          <div style="padding: 28px 36px 12px;">
            <div style="display: flex; gap: 18px; flex-wrap: wrap;">
              <div style="flex: 1 1 280px; padding: 18px 20px; border: 1px solid #e5e7eb; border-radius: 18px; background: #f9fafb;">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.4px; color: #6b7280;">Customer</div>
                <div style="margin-top: 10px; font-size: 16px; font-weight: 700;">${escapeHtml(order.customerNumber)}</div>
                <div style="margin-top: 10px; font-size: 14px; line-height: 1.6; color: #4b5563;">
                  <div>Payment intent: ${escapeHtml(String(order.paymentMethod || "unknown").toUpperCase())}</div>
                  <div>Status: ${escapeHtml(order.status || "pending")}</div>
                </div>
              </div>
              <div style="flex: 1 1 280px; padding: 18px 20px; border: 1px solid #e5e7eb; border-radius: 18px; background: #f9fafb;">
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.4px; color: #6b7280;">Fulfilment</div>
                <div style="margin-top: 10px; font-size: 14px; line-height: 1.7; color: #111827;">
                  <div><span style="font-weight: 700;">Delivery Address:</span> ${escapeHtml(order.deliveryAddress || "Pickup order")}</div>
                  <div><span style="font-weight: 700;">Notes:</span> ${escapeHtml(order.notes || "No special instructions")}</div>
                </div>
              </div>
            </div>
          </div>

          <div style="padding: 12px 36px 36px;">
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 18px; overflow: hidden;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 14px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; color: #6b7280;">#</th>
                  <th style="padding: 14px 16px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; color: #6b7280;">Item</th>
                  <th style="padding: 14px 16px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; color: #6b7280;">Qty</th>
                  <th style="padding: 14px 16px; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; color: #6b7280;">Unit Price</th>
                  <th style="padding: 14px 16px; text-align: right; font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; color: #6b7280;">Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsMarkup}
              </tbody>
            </table>

            <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
              <div style="width: 320px; border: 1px solid #e5e7eb; border-radius: 18px; background: #fcfcfd; padding: 22px 24px;">
                <div style="display: flex; justify-content: space-between; font-size: 14px; color: #4b5563; margin-bottom: 14px;">
                  <span>Total Items</span>
                  <span>${escapeHtml(order.items.length)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 14px; color: #4b5563; margin-bottom: 14px;">
                  <span>Total Units</span>
                  <span>${escapeHtml(
                    order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
                  )}</span>
                </div>
                <div style="height: 1px; background: #e5e7eb; margin: 14px 0 18px;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 15px; font-weight: 700; color: #111827;">Grand Total</span>
                  <span style="font-size: 28px; font-weight: 800; color: #111827;">${formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

const renderReceiptImage = async (html, outputPath) => {
  const browser = await puppeteer.launch({
    headless: true,
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
  const order = orderDocument.toObject ? orderDocument.toObject() : orderDocument;
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
