# Security Specification for BrightLedger UK

## Data Invariants
1. An organization must have at least one admin (the owner).
2. Access to any organizational data (clients, invoices, expenses, transactions) requires membership in that organization.
3. Users can only see their own profile.
4. Invoices and Expenses must belong to the organization they are under.
5. Invoices can only be deleted if they are in 'draft' status (business logic enforced at rule level).
6. Timestamps (createdAt, updatedAt) must be server-validated.

## Identifiers
- `userId`: Google Auth UID
- `orgId`: Secure randomly generated ID
- `clientId`, `invoiceId`, `expenseId`: Secure IDs

## The "Dirty Dozen" Payloads (Expect PERMISSION_DENIED)

1. **Identity Spoofing**: User A trying to create an organization with User B as `ownerId`.
2. **Privilege Escalation**: User A (Staff) trying to update their own role to 'admin' in an organization.
3. **Cross-Tenant Access**: User A trying to read invoices of Organization B which they are not a member of.
4. **Invalid Status Transition**: Trying to update a 'paid' invoice back to 'draft'.
5. **Timestamp Sabotage**: Providing a client-side `createdAt` date in the past during creation.
6. **Orphaned Write**: Creating an invoice for a client that doesn't exist (requires exists/get check).
7. **Resource Poisoning**: Injecting a 1MB string into an invoice's `invoiceNumber` field.
8. **Shadow Field Injection**: Adding an `isAdmin: true` field to a user profile.
9. **Bulk Scrape**: Authenticated user trying to list all organizations in the system without membership.
10. **Immutable Field Change**: Trying to change the `orgId` of an invoice after creation.
11. **PII Leak**: Non-member trying to 'get' a user profile by UID.
12. **Status Shortcutting**: Directly setting an invoice to 'paid' without a payment record (if enforced).

## Role-Based Access Control
- `admin`: Full access to org data.
- `accountant`: Read access to all, write to invoices/expenses/transactions, but cannot manage members.
- `staff`: Read access to clients, write to expenses, read-only invoices.
