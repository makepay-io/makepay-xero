# MakePay Xero Connector

Xero connector for creating MakePay payment links from Xero invoices and reconciling paid MakePay events back as Xero Payments.

## Features

- Xero OAuth 2.0 connect and callback endpoints
- Tenant discovery through the Xero connections endpoint
- In-memory token, tenant, and payment mapping store for local development
- Admin endpoint to create a MakePay payment link for a Xero invoice
- Signed MakePay webhook verification
- Xero Payment creation against the linked invoice after MakePay payment confirmation
- Optional Xero webhook endpoint for acknowledging invoice events

## Environment

Copy `.env.example` to `.env` and configure:

- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`
- `PUBLIC_APP_URL`
- `XERO_PAYMENT_ACCOUNT_CODE`
- `MAKEPAY_KEY_ID`
- `MAKEPAY_KEY_SECRET`
- `MAKEPAY_WEBHOOK_SECRET`
- `ADMIN_TOKEN`

Use a clearing or bank account code for `XERO_PAYMENT_ACCOUNT_CODE`; Xero payments must be applied to both an invoice and an account.

## Development

```sh
npm ci
npm run validate
npm run dev
```

Register this redirect URI in the Xero developer app:

```text
https://your-app.example/oauth/callback
```

Configure MakePay webhooks to:

```text
https://your-app.example/webhooks/makepay
```

## Storage

`MemoryRepository` is for local development only. Replace it with durable encrypted token storage before production use.
