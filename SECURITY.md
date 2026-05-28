# Security Policy

## Reporting

Report security issues to info@makepay.io.

## Secrets

- Store Xero OAuth credentials, refresh tokens, webhook signing keys, and MakePay keys in a secret manager or encrypted database.
- Verify MakePay webhook signatures before creating Xero Payments.
- Verify Xero webhook signatures before trusting Xero webhook payloads.
- Do not log OAuth tokens, MakePay key secrets, invoice payloads, or raw production webhook bodies.
