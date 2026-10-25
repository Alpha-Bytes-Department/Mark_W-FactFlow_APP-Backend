# 💳 Subscription API Documentation (RevenueCat)

This document covers the **RevenueCat In-App Subscription System** implemented in this backend. It is designed for frontend developers to easily connect mobile in-app purchases with backend user accounts and access control.

---

## 📌 Summary of Changes

1. **New Subscription Status Endpoint**: `GET /api/v1/subscriptions/status`
2. **New Client Sync Endpoint**: `POST /api/v1/subscriptions/revenuecat/sync`
3. **New Server Webhook Endpoint**: `POST /api/v1/subscriptions/revenuecat/webhook`
4. **Enhanced User Profile**: `GET /api/v1/profile` now includes `is_subscribed`, `subscription_name`, and `subscription_expires_at`.
5. **Automatic Access Protection**: Any route using `auth.user` automatically allows active subscribers and blocks expired users with `402 Payment Required`.

---

## 🚀 Frontend Developer Implementation Guide

Follow these 3 simple steps in your frontend app:

### Step 1: Associate User with RevenueCat
When the user logs in through the backend (`/api/v1/auth/login`), pass the user's `id` to the RevenueCat SDK:
```
RevenueCat.logIn(user.id);
```
*(This ensures RevenueCat and your backend use the exact same user ID)*

---

### Step 2: Sync Backend After Purchase or Restore
Whenever a user finishes purchasing a package or taps **Restore Purchases**, call the sync endpoint to unlock premium features immediately:

- **Endpoint**: `POST /api/v1/subscriptions/revenuecat/sync`
- **Headers**:
  ```http
  Authorization: Bearer <user_access_token>
  Content-Type: application/json
  ```
- **Body**:
  ```json
  {
    "entitlement_id": "premium",
    "product_id": "com.factflow.pro.monthly",
    "expiration_at_ms": 1731837257000
  }
  ```
*(Note: If the backend has `REVENUECAT_SECRET_KEY` configured, you can even send `{}` and the backend will verify directly with RevenueCat's servers).*

---

### Step 3: Check Subscription Status
You can check if the user is subscribed in two ways:

#### Option A: In the user profile (`GET /api/v1/profile`)
The profile object now includes subscription flags:
```json
{
  "id": "USR-000001",
  "name": "Alex",
  "email": "alex@example.com",
  "is_subscribed": true,
  "subscription_name": "premium",
  "subscription_expires_at": "2026-11-18T10:00:00.000Z"
}
```

#### Option B: Dedicated status endpoint (`GET /api/v1/subscriptions/status`)
Use this before showing paywalls or restricted screens.

---

## 📡 API Endpoint Reference

### 1. Check Subscription Status

Retrieve the current subscription state and remaining days for the authenticated user.

- **URL**: `/api/v1/subscriptions/status`
- **Method**: `GET`
- **Auth**: `Bearer <access_token>`

#### Response (`200 OK`) — Subscribed User
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Subscription status retrieved successfully",
  "data": {
    "is_subscribed": true,
    "subscription_name": "premium",
    "subscription_expires_at": "2026-11-18T10:00:00.000Z",
    "days_remaining": 30
  }
}
```

#### Response (`200 OK`) — Free / Expired User
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Subscription status retrieved successfully",
  "data": {
    "is_subscribed": false,
    "subscription_name": null,
    "subscription_expires_at": null,
    "days_remaining": 0
  }
}
```

---

### 2. Sync Subscription (Client-Side)

Called by the frontend immediately after a store purchase or restore succeeds. Instantly activates the subscription in the database.

- **URL**: `/api/v1/subscriptions/revenuecat/sync`
- **Method**: `POST`
- **Auth**: `Bearer <access_token>`
- **Headers**: `Content-Type: application/json`

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `entitlement_id` | string | Optional | Entitlement identifier from RevenueCat (e.g. `"premium"`, `"pro"`) |
| `product_id` | string | Optional | Store product identifier (e.g. `"com.app.monthly"`) |
| `expiration_at_ms` | number | Optional | Expiration epoch timestamp in milliseconds |

```json
{
  "entitlement_id": "premium",
  "product_id": "com.factflow.pro.monthly",
  "expiration_at_ms": 1731837257000
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Subscription synced successfully",
  "data": {
    "is_subscribed": true,
    "subscription_name": "premium",
    "subscription_expires_at": "2026-11-18T10:00:00.000Z",
    "days_remaining": 30
  }
}
```

---

### 3. User Profile (Updated)

Retrieve user profile. Now includes subscription fields directly so you don't need to make an extra network call.

- **URL**: `/api/v1/profile`
- **Method**: `GET`
- **Auth**: `Bearer <access_token>`

#### Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Profile retrieved successfully!",
  "data": {
    "id": "USR-000001",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "avatar": "/images/placeholder.png",
    "gender": "OTHER",
    "role": "user",
    "balance": 0,
    "is_subscribed": true,
    "subscription_name": "premium",
    "subscription_expires_at": "2026-11-18T10:00:00.000Z"
  }
}
```

---

### 4. RevenueCat Server Webhook

*This is called automatically by RevenueCat servers, not by the mobile app.*

- **URL**: `/api/v1/subscriptions/revenuecat/webhook`
- **Method**: `POST`
- **Auth**: Header configured in RevenueCat dashboard (e.g., `Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH_KEY>`)

#### Handled Events
| Event Type | Action Taken by Backend |
| :--- | :--- |
| `INITIAL_PURCHASE` | Sets `is_subscribed = true`, updates `subscription_name` and expiration date. |
| `RENEWAL` | Extends `subscription_expires_at` to the new period. |
| `PRODUCT_CHANGE` | Updates `subscription_name` and new expiration date. |
| `UNCANCELLATION` | Re-enables subscription if previously set to cancel. |
| `CANCELLATION` | If refund: expires immediately. If auto-renew turned off: keeps access until `expiration_at_ms`. |
| `EXPIRATION` | Resets `subscription_name = null` and marks user as expired. |
| `TRANSFER` | Moves subscription to new user ID when purchases are transferred. |
| `TEST` | Acknowledges RevenueCat test ping with `200 OK`. |

#### Response (`200 OK`)
```json
{
  "received": true,
  "message": "Webhook processed successfully"
}
```

---

## 🛑 Protected Routes Behavior

When a route uses subscriber protection (`auth.user`):
- **If `is_subscribed === true`**: The request continues normally.
- **If `is_subscribed === false` or expired**: The backend responds with:
  ```json
  {
    "success": false,
    "statusCode": 402,
    "message": "Your user subscription has expired. Please renew to continue accessing this feature."
  }
  ```
Frontend can intercept `402 Payment Required` and show the paywall screen.
