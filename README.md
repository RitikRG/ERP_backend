# Backend

Express and MongoDB backend for the ERP application.

## Stack

- Node.js with ES modules
- Express 5
- MongoDB with Mongoose
- JWT-based authentication
- HTTPS local server using checked-in development certificates
- Multer for file uploads

## Project Structure

```text
backend/
  config/
  controllers/
  middleware/
  models/
  public/uploads/
  routes/
  utils/
  server.js
```

## Main API Areas

All routes are mounted under `/api`.

- `/api/auth` - user registration and login
- `/api/org` - organisation registration
- `/api/products` - product CRUD and image upload
- `/api/supplier` - supplier CRUD
- `/api/purchase` - purchase creation, listing, status updates, payments
- `/api/sale` - sales, payment entries, delete flow
- `/api/customers` - customer CRUD, dues, customer sales details
- `/api/settings` - user and organisation settings
- `/api/dashboard` - summary and projection endpoints
- `/api/agent` - AI agent / WhatsApp webhook endpoints

## Requirements

- Node.js
- MongoDB running locally or a reachable MongoDB URI
- Local certificate files already expected by the server:
  - `localhost+1-key.pem`
  - `localhost+1.pem`

## Environment Variables

Create `backend/.env` with the values your environment needs:

```env
PORT=4000
MONGO_URI=mongodb://localhost:27017/erp
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
GEMINI_API_KEY=optional_for_dashboard_features
NODE_ENV=development
```

## Install

```bash
cd backend
npm install
```

## Run

No `start` or `dev` script is defined in `package.json`, so run the server directly:

```bash
node server.js
```

For auto-reload during development:

```bash
npx nodemon server.js
```

The server starts in HTTPS mode.

Default URL:

```text
https://localhost:3000
```

## Important Notes

- `server.js` currently defaults to port `3000` when `PORT` is not set.
- `config/config.js` defaults to port `4000`.
- The frontend environment file points to `https://localhost:4000/api`.

In practice, set `PORT=4000` in `backend/.env` if you want the backend to match the frontend configuration without further changes.

- Uploaded files are served from `/uploads`.
- CORS is currently configured for local Angular development origins.
- The AI agent webhook stores incoming payloads in `MessageRecievedLogs`.

## Current Data Models

- `User`
- `Organization`
- `Product`
- `Supplier`
- `Purchase`
- `PurchasePayment`
- `Sale`
- `SalePayment`
- `Customer`
- `MessageRecievedLogs`
- `ChatSessions`
