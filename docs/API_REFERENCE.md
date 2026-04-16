# WHMCS MCP Server - API Reference

Complete reference documentation for all tools provided by the WHMCS MCP Server.

## Table of Contents

- [Client Management](#client-management)
- [Product Management](#product-management)
- [Billing & Invoices](#billing--invoices)
- [Support Tickets](#support-tickets)
- [Domain Management](#domain-management)
- [Order Management](#order-management)
- [Server & Module Management](#server--module-management)
- [System Tools](#system-tools)
- [Affiliate Management](#affiliate-management)
- [Promotion Management](#promotion-management)
- [Quote Management](#quote-management)
- [Provisioning Forensics](#provisioning-forensics)
- [Invoice & Payment Forensics](#invoice--payment-forensics)
- [Client Timeline](#client-timeline)

---

## Client Management

### whmcs_get_clients

Get a list of clients from WHMCS with optional filtering and pagination.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limitstart` | number | No | Starting offset for results (default 0) |
| `limitnum` | number | No | Number of results to return (default 25) |
| `sorting` | string | No | Sort order: `ASC` or `DESC` |
| `status` | string | No | Filter by status: `Active`, `Inactive`, `Closed` |
| `search` | string | No | Search term to filter clients |
| `orderby` | string | No | Field to order by |

**Example Response:**
```json
{
  "result": "success",
  "totalresults": 13,
  "startnumber": 0,
  "numreturned": 5,
  "clients": {
    "client": [
      {
        "id": 1,
        "firstname": "John",
        "lastname": "Doe",
        "companyname": "Acme Inc",
        "email": "john@example.com",
        "datecreated": "2025-01-15",
        "groupid": 0,
        "status": "Active"
      }
    ]
  }
}
```

---

### whmcs_get_client_details

Get detailed information about a specific client.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clientid` | number | No* | The client ID to retrieve |
| `email` | string | No* | The email address to search for |
| `stats` | boolean | No | Include client statistics |

*At least one of `clientid` or `email` is required.

---

### whmcs_add_client

Create a new client in WHMCS.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `firstname` | string | Yes | Client first name |
| `lastname` | string | Yes | Client last name |
| `email` | string | Yes | Client email address |
| `address1` | string | Yes | Street address |
| `city` | string | Yes | City |
| `state` | string | Yes | State/Province |
| `postcode` | string | Yes | Postal/ZIP code |
| `country` | string | Yes | Country (2-letter ISO code) |
| `phonenumber` | string | Yes | Phone number |
| `password2` | string | Yes | Password for the client account |
| `companyname` | string | No | Company name |
| `address2` | string | No | Address line 2 |
| `currency` | number | No | Currency ID |
| `language` | string | No | Client language |
| `groupid` | number | No | Client group ID |
| `notes` | string | No | Admin notes |
| `noemail` | boolean | No | Do not send welcome email |

---

### whmcs_update_client

Update an existing client in WHMCS.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clientid` | number | Yes | The client ID to update |
| `firstname` | string | No | Client first name |
| `lastname` | string | No | Client last name |
| `email` | string | No | Client email address |
| `companyname` | string | No | Company name |
| `address1` | string | No | Street address |
| `address2` | string | No | Address line 2 |
| `city` | string | No | City |
| `state` | string | No | State/Province |
| `postcode` | string | No | Postal/ZIP code |
| `country` | string | No | Country (2-letter ISO code) |
| `phonenumber` | string | No | Phone number |
| `password2` | string | No | New password |
| `status` | string | No | Client status: `Active`, `Inactive`, `Closed` |
| `credit` | string | No | Credit balance |
| `notes` | string | No | Admin notes |
| `language` | string | No | Client language |

---

### whmcs_delete_client

Delete a client from WHMCS. **Use with caution.**

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clientid` | number | Yes | The client ID to delete |

---

### whmcs_get_client_products

Get products/services owned by a client.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clientid` | number | No | The client ID |
| `serviceid` | number | No | Specific service ID |
| `domain` | string | No | Filter by domain |
| `pid` | number | No | Filter by product ID |
| `limitstart` | number | No | Starting offset |
| `limitnum` | number | No | Number of results |

---

### whmcs_get_client_domains

Get domains owned by a client.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clientid` | number | No | The client ID |
| `domainid` | number | No | Specific domain ID |
| `domain` | string | No | Filter by domain name |
| `limitstart` | number | No | Starting offset |
| `limitnum` | number | No | Number of results |

---

## Product Management

### whmcs_get_products

Get available products/services from WHMCS.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pid` | number | No | Specific product ID |
| `gid` | number | No | Filter by product group ID |
| `module` | string | No | Filter by server module |

---

### whmcs_get_product_groups

Get all product groups from WHMCS.

**Parameters:** None

---

## Billing & Invoices

### whmcs_get_invoices

Get invoices with optional filtering.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limitstart` | number | No | Starting offset |
| `limitnum` | number | No | Number of results |
| `userid` | number | No | Filter by client ID |
| `status` | string | No | Filter by status: `Paid`, `Unpaid`, `Cancelled`, `Refunded`, `Collections`, `Draft` |
| `orderby` | string | No | Field to order by |
| `order` | string | No | Sort order: `asc` or `desc` |

---

### whmcs_get_invoice

Get detailed information about a specific invoice.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `invoiceid` | number | Yes | The invoice ID |

---

### whmcs_create_invoice

Create a new invoice for a client.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `userid` | number | Yes | Client ID |
| `status` | string | No | Invoice status: `Draft`, `Unpaid`, `Paid`, `Cancelled`, `Refunded`, `Collections` |
| `sendinvoice` | boolean | No | Send invoice email |
| `paymentmethod` | string | No | Payment method |
| `taxrate` | number | No | Tax rate percentage |
| `taxrate2` | number | No | Second tax rate percentage |
| `date` | string | No | Invoice date (YYYY-MM-DD) |
| `duedate` | string | No | Due date (YYYY-MM-DD) |
| `notes` | string | No | Invoice notes |
| `itemdescription` | array | No | Line item descriptions |
| `itemamount` | array | No | Line item amounts |
| `itemtaxed` | array | No | Line items taxed flags |

---

### whmcs_update_invoice

Update an existing invoice.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `invoiceid` | number | Yes | Invoice ID to update |
| `status` | string | No | New status |
| `paymentmethod` | string | No | Payment method |
| `date` | string | No | Invoice date (YYYY-MM-DD) |
| `duedate` | string | No | Due date (YYYY-MM-DD) |
| `notes` | string | No | Invoice notes |
| `publish` | boolean | No | Publish draft invoice |
| `publishandsendemail` | boolean | No | Publish and send email |

---

### whmcs_add_payment

Record a payment on an invoice.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `invoiceid` | number | Yes | Invoice ID |
| `transid` | string | Yes | Transaction ID |
| `gateway` | string | Yes | Payment gateway name |
| `amount` | number | No | Payment amount |
| `fees` | number | No | Transaction fees |
| `noemail` | boolean | No | Do not send email |
| `date` | string | No | Payment date (YYYY-MM-DD) |

---

### whmcs_apply_credit

Apply credit to an invoice.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `invoiceid` | number | Yes | Invoice ID |
| `amount` | number | Yes | Amount of credit to apply |
| `noemail` | boolean | No | Do not send email |

---

### whmcs_get_transactions

Get payment transactions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `invoiceid` | number | No | Filter by invoice ID |
| `clientid` | number | No | Filter by client ID |
| `transid` | string | No | Filter by transaction ID |

---

## Support Tickets

### whmcs_get_tickets

Get support tickets with optional filtering.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limitstart` | number | No | Starting offset |
| `limitnum` | number | No | Number of results |
| `deptid` | number | No | Filter by department ID |
| `clientid` | number | No | Filter by client ID |
| `email` | string | No | Filter by email |
| `status` | string | No | Filter by status |
| `subject` | string | No | Filter by subject |

---

### whmcs_get_ticket

Get detailed information about a specific ticket including replies.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ticketid` | number | Yes | Ticket ID |

---

### whmcs_open_ticket

Create a new support ticket.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `deptid` | number | Yes | Department ID |
| `subject` | string | Yes | Ticket subject |
| `message` | string | Yes | Ticket message/description |
| `clientid` | number | No | Client ID |
| `contactid` | number | No | Contact ID |
| `name` | string | No | Name (if not a client) |
| `email` | string | No | Email (if not a client) |
| `priority` | string | No | Ticket priority: `Low`, `Medium`, `High` |
| `serviceid` | number | No | Related service ID |
| `domainid` | number | No | Related domain ID |
| `admin` | boolean | No | Opened by admin |
| `markdown` | boolean | No | Message contains markdown |

---

### whmcs_add_ticket_reply

Reply to an existing support ticket.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ticketid` | number | Yes | Ticket ID |
| `message` | string | Yes | Reply message |
| `clientid` | number | No | Client ID |
| `contactid` | number | No | Contact ID |
| `name` | string | No | Name |
| `email` | string | No | Email |
| `adminusername` | string | No | Admin username |
| `status` | string | No | New ticket status |
| `noemail` | boolean | No | Do not send email |
| `markdown` | boolean | No | Message contains markdown |

---

### whmcs_update_ticket

Update ticket properties.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ticketid` | number | Yes | Ticket ID |
| `deptid` | number | No | Department ID |
| `subject` | string | No | Subject |
| `userid` | number | No | Assign to client ID |
| `name` | string | No | Name |
| `email` | string | No | Email |
| `priority` | string | No | Priority: `Low`, `Medium`, `High` |
| `status` | string | No | Status |
| `flag` | number | No | Flag to admin ID |

---

### whmcs_delete_ticket

Delete a support ticket. **Use with caution.**

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ticketid` | number | Yes | Ticket ID to delete |

---

### whmcs_get_support_departments

Get list of support departments.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ignore_dept_assignments` | boolean | No | Ignore department assignments |

---

### whmcs_get_support_statuses

Get ticket statuses with counts.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `deptid` | number | No | Filter by department ID |

---

## Domain Management

### whmcs_register_domain

Send domain registration command to registrar.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `domainid` | number | No | Domain ID |
| `domain` | string | No | Domain name |

---

### whmcs_transfer_domain

Send domain transfer command to registrar.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `domainid` | number | Yes | Domain ID |

---

### whmcs_renew_domain

Send domain renewal command to registrar.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `domainid` | number | Yes | Domain ID |

---

### whmcs_get_domain_whois

Get WHOIS information for a domain.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `domainid` | number | Yes | Domain ID |

---

### whmcs_get_domain_nameservers

Get nameservers for a domain.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `domainid` | number | Yes | Domain ID |

---

### whmcs_update_domain_nameservers

Update nameservers for a domain.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `domainid` | number | Yes | Domain ID |
| `ns1` | string | No | Nameserver 1 |
| `ns2` | string | No | Nameserver 2 |
| `ns3` | string | No | Nameserver 3 |
| `ns4` | string | No | Nameserver 4 |
| `ns5` | string | No | Nameserver 5 |

---

### whmcs_get_domain_lock_status

Get lock/unlock status for a domain.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `domainid` | number | Yes | Domain ID |

---

### whmcs_update_domain_lock_status

Lock or unlock a domain.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `domainid` | number | Yes | Domain ID |
| `lockstatus` | boolean | No | Lock status (true to lock) |

---

### whmcs_get_tld_pricing

Get domain TLD pricing information.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `currencyid` | number | No | Currency ID |

---

## Order Management

### whmcs_get_orders

Get orders with optional filtering.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limitstart` | number | No | Starting offset |
| `limitnum` | number | No | Number of results |
| `id` | number | No | Specific order ID |
| `userid` | number | No | Filter by client ID |
| `status` | string | No | Filter by status |

---

### whmcs_accept_order

Accept and process a pending order.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `orderid` | number | Yes | Order ID |
| `serverid` | number | No | Server to provision on |
| `serviceusername` | string | No | Username for service |
| `servicepassword` | string | No | Password for service |
| `registrar` | string | No | Domain registrar module |
| `autosetup` | boolean | No | Auto setup products |
| `sendemail` | boolean | No | Send setup email |

---

### whmcs_cancel_order

Cancel an order.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `orderid` | number | Yes | Order ID |
| `cancelsub` | boolean | No | Cancel subscription |
| `noemail` | boolean | No | Do not send email |

---

### whmcs_delete_order

Delete an order. **Use with caution.**

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `orderid` | number | Yes | Order ID |

---

### whmcs_fraud_order

Mark an order as fraudulent.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `orderid` | number | Yes | Order ID |
| `cancelsub` | boolean | No | Cancel subscription |

---

### whmcs_pending_order

Set an order status to pending.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `orderid` | number | Yes | Order ID |

---

## Server & Module Management

### whmcs_get_servers

Get list of configured servers.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fetchStatus` | boolean | No | Fetch server status |

---

### whmcs_module_create

Create/provision a service account.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountid` | number | Yes | Service ID |

---

### whmcs_module_suspend

Suspend a service account.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountid` | number | Yes | Service ID |
| `suspendreason` | string | No | Suspension reason |

---

### whmcs_module_unsuspend

Unsuspend a service account.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountid` | number | Yes | Service ID |

---

### whmcs_module_terminate

Terminate a service account.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountid` | number | Yes | Service ID |

---

### whmcs_module_change_password

Change password for a service account.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `accountid` | number | Yes | Service ID |
| `servicepassword` | string | No | New password |

---

## System Tools

### whmcs_get_stats

Get WHMCS system statistics including income and order counts.

**Parameters:** None

**Example Response:**
```json
{
  "result": "success",
  "income_today": "$0.00 USD",
  "income_thismonth": "$1,234.56 USD",
  "income_thisyear": "$12,345.67 USD",
  "orders_pending": 5,
  "tickets_allactive": 12,
  "tickets_awaitingreply": 3
}
```

---

### whmcs_get_admin_users

Get list of admin users.

**Parameters:** None

---

### whmcs_get_payment_methods

Get available payment methods.

**Parameters:** None

---

### whmcs_get_currencies

Get configured currencies.

**Parameters:** None

---

### whmcs_get_activity_log

Get system activity log.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limitstart` | number | No | Starting offset |
| `limitnum` | number | No | Number of results |
| `userid` | number | No | Filter by user ID |
| `date` | string | No | Filter by date |
| `user` | string | No | Filter by user |
| `description` | string | No | Filter by description |
| `ipaddress` | string | No | Filter by IP address |

---

### whmcs_log_activity

Add an entry to the activity log.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `description` | string | Yes | Activity description |
| `userid` | number | No | Associated user ID |

---

### whmcs_get_email_templates

Get list of email templates.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | string | No | Template type: `general`, `product`, `domain`, `invoice`, `support`, `affiliate` |
| `language` | string | No | Template language |

---

### whmcs_send_email

Send an email to a client.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `messagename` | string | No | Email template name |
| `id` | number | No | Related ID (client, invoice, etc.) |
| `customtype` | string | No | Custom type |
| `customsubject` | string | No | Custom subject |
| `custommessage` | string | No | Custom message |

---

### whmcs_get_todo_items

Get admin to-do items.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limitstart` | number | No | Starting offset |
| `limitnum` | number | No | Number of results |
| `status` | string | No | Filter by status: `Incomplete`, `Complete`, `Pending` |

---

## Affiliate Management

### whmcs_get_affiliates

Get list of affiliates.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limitstart` | number | No | Starting offset |
| `limitnum` | number | No | Number of results |

---

### whmcs_activate_affiliate

Activate a client as an affiliate.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `userid` | number | Yes | Client ID |

---

## Promotion Management

### whmcs_get_promotions

Get list of promotions/coupons.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | string | No | Specific promotion code |

---

## Quote Management

### whmcs_get_quotes

Get list of quotes.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limitstart` | number | No | Starting offset |
| `limitnum` | number | No | Number of results |
| `quoteid` | number | No | Specific quote ID |
| `userid` | number | No | Filter by client ID |
| `subject` | string | No | Filter by subject |
| `stage` | string | No | Filter by stage |

---

### whmcs_create_quote

Create a new quote.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `subject` | string | Yes | Quote subject |
| `stage` | string | Yes | Quote stage: `Draft`, `Delivered`, `On Hold`, `Accepted`, `Lost`, `Dead` |
| `validuntil` | string | Yes | Valid until date (YYYY-MM-DD) |
| `userid` | number | No | Client ID |
| `firstname` | string | No | First name |
| `lastname` | string | No | Last name |
| `companyname` | string | No | Company name |
| `email` | string | No | Email |
| `proposal` | string | No | Proposal text |
| `customernotes` | string | No | Customer notes |
| `adminnotes` | string | No | Admin notes |

---

### whmcs_accept_quote

Accept a quote and convert to invoice.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `quoteid` | number | Yes | Quote ID |

---

### whmcs_delete_quote

Delete a quote.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `quoteid` | number | Yes | Quote ID |

---

## Provisioning Forensics

Tools for diagnosing provisioning failures, inspecting service state, and reviewing server capacity.

> **Note:** `whmcs_get_module_queue` requires WHMCS 8.0+. On older versions it returns a structured `{ unsupported: true }` response instead of an error.
> `whmcs_resync_service` is a mutating tool and requires the environment variable `WHMCS_ALLOW_MUTATIONS=true`.

### whmcs_get_service_details

Get the full state of a single hosting/service account including status, server assignment, billing cycle, and domain.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `serviceId` | number | Yes | The service (hosting account) ID to retrieve |

**Example Response:**
```json
{
  "result": "success",
  "serviceid": 42,
  "status": "Active",
  "server": "web-server-01",
  "product": "Shared Hosting - Basic",
  "domain": "example.com",
  "billingcycle": "Monthly",
  "nextduedate": "2026-05-01",
  "username": "examp1",
  "dedicatedip": "203.0.113.10"
}
```

---

### whmcs_get_module_log

Get activity-log entries for module commands executed against a specific service. Useful for diagnosing provisioning or suspension failures.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `serviceId` | number | Yes | The service ID to filter log entries for |
| `limit` | number | No | Maximum number of log entries to return (default 50) |

**Example Response:**
```json
{
  "result": "success",
  "entries": [
    {
      "date": "2026-04-14 09:32:11",
      "action": "CreateAccount",
      "request": "...",
      "response": "...",
      "completed": true
    }
  ]
}
```

---

### whmcs_get_module_queue

Get pending and failed module operations from the WHMCS module queue. Requires WHMCS 8.0+; returns `{ unsupported: true, minimumVersion: "8.0" }` on older versions.

**Parameters:** None

**Example Response:**
```json
{
  "result": "success",
  "queue": [
    {
      "id": 101,
      "serviceId": 42,
      "module": "cpanel",
      "action": "CreateAccount",
      "status": "Failed",
      "lastAttempt": "2026-04-14 10:00:00",
      "numRetries": 3
    }
  ]
}
```

---

### whmcs_get_server_usage

Get per-server capacity, current utilization, and headroom. Useful for identifying overloaded servers or planning migrations.

**Parameters:** None

**Example Response:**
```json
{
  "result": "success",
  "servers": [
    {
      "id": 1,
      "name": "web-server-01",
      "type": "cpanel",
      "maxAccounts": 500,
      "activeAccounts": 347,
      "headroom": 153
    }
  ]
}
```

---

### whmcs_resync_service

Re-run a module command on a service. **This is a mutating operation** and requires:
1. The environment variable `WHMCS_ALLOW_MUTATIONS=true`
2. The `confirm` parameter set to `true`

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `serviceId` | number | Yes | The service ID to act on |
| `action` | string | No | Module action to execute: `Create`, `Suspend`, `Unsuspend`, `Terminate`, `ChangePackage`, `ChangePassword` (default `Create`) |
| `confirm` | boolean | Yes | Must be `true` to proceed. Safety gate to prevent accidental execution. |

**Example Response:**
```json
{
  "result": "success",
  "serviceId": 42,
  "action": "Create",
  "message": "Module command Create executed successfully"
}
```

---

## Invoice & Payment Forensics

Tools for investigating unpaid or incorrect invoices, tracing payment failures, finding orphan transactions, and reviewing dunning/reminder activity.

> **Note:** `whmcs_get_credit_history` requires WHMCS 7.1+. On older versions it returns a structured `{ supported: false, reason: "..." }` response instead of an error.

### whmcs_get_invoice_audit

Returns an invoice with enriched line items — each classified by origin (`service-renewal`, `domain-renewal`, `addon`, `manual`) and linked to service details where applicable.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `invoiceId` | number | Yes | The WHMCS invoice ID |

**Example Response:**
```json
{
  "invoiceid": 1042,
  "invoicenum": "1042",
  "userid": 1,
  "date": "2026-04-01",
  "duedate": "2026-04-15",
  "datepaid": "0000-00-00 00:00:00",
  "status": "Unpaid",
  "paymentmethod": "stripe",
  "subtotal": "49.95",
  "credit": "0.00",
  "tax": "0.00",
  "total": "49.95",
  "balance": "49.95",
  "currencycode": "USD",
  "items": [
    {
      "id": 1,
      "type": "Hosting",
      "relid": 42,
      "description": "Shared Hosting - Basic (01/04/2026 - 01/05/2026)",
      "amount": "29.95",
      "taxed": true,
      "origin": "service-renewal",
      "service": {
        "name": "Shared Hosting - Basic",
        "domain": "example.com",
        "status": "Active",
        "billingcycle": "Monthly"
      }
    },
    {
      "id": 2,
      "type": "Domain",
      "relid": 10,
      "description": "Domain Renewal - example.com",
      "amount": "15.00",
      "taxed": false,
      "origin": "domain-renewal"
    },
    {
      "id": 3,
      "type": "",
      "relid": 0,
      "description": "Late fee",
      "amount": "5.00",
      "taxed": false,
      "origin": "manual"
    }
  ]
}
```

---

### whmcs_get_payment_attempts

Returns all transactions (successful + failed) for an invoice, plus failed gateway attempts extracted from the activity log.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `invoiceId` | number | Yes | The WHMCS invoice ID |

**Example Response:**
```json
{
  "invoiceid": 1042,
  "transactions": [
    {
      "id": 501,
      "gateway": "stripe",
      "date": "2026-04-01",
      "description": "Invoice #1042 Payment",
      "amountin": "49.95",
      "amountout": "0.00",
      "transid": "ch_abc123",
      "refundid": 0
    }
  ],
  "failedAttempts": [
    {
      "date": "2026-03-31 14:22:05",
      "gateway": "stripe",
      "error": "Card declined — insufficient funds"
    }
  ]
}
```

---

### whmcs_get_orphan_transactions

Returns transactions with no invoice linkage (`invoiceid=0`). Optionally filter by client.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clientId` | number | No | Optional client ID filter |

**Example Response:**
```json
[
  {
    "id": 600,
    "gateway": "paypal",
    "date": "2026-03-20",
    "description": "PayPal deposit",
    "amountin": "100.00",
    "amountout": "0.00",
    "transid": "TXN-ORPHAN-001",
    "invoiceid": 0,
    "userid": 5
  }
]
```

---

### whmcs_get_credit_history

Returns credit applications and refunds for a client. Requires WHMCS 7.1+; on older versions returns `{ supported: false, reason: "..." }`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clientId` | number | Yes | The WHMCS client ID |

**Example Response (WHMCS 7.1+):**
```json
{
  "supported": true,
  "credits": [
    {
      "id": 1,
      "date": "2026-03-15",
      "description": "Credit Applied to Invoice #1040",
      "amount": "-10.00",
      "relid": 1040
    }
  ]
}
```

**Example Response (older WHMCS):**
```json
{
  "supported": false,
  "reason": "GetCredits API action requires WHMCS 7.1 or later."
}
```

---

### whmcs_get_dunning_log

Returns payment reminders, failed-attempt entries, and invoice lifecycle events from the activity log.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `invoiceId` | number | Yes | The WHMCS invoice ID |
| `limit` | number | No | Max entries to return (default 100) |

**Example Response:**
```json
[
  {
    "date": "2026-04-01 09:00:00",
    "user": "System",
    "description": "Invoice #1042 Payment Reminder Sent"
  },
  {
    "date": "2026-04-08 09:00:00",
    "user": "System",
    "description": "Invoice #1042 Second Overdue Notice Sent"
  }
]
```

---

## Client Timeline

Tools for building a unified chronological view of all activity for a single client, plus a one-click SSO login into the client's admin panel.

> **Note:** `whmcs_get_client_autoauth_url` requires WHMCS 7.7+. On older versions it returns a structured `{ supported: false, reason: "..." }` response instead of an error.

### whmcs_get_client_timeline

Returns a chronological timeline of all client events -- orders, invoices, services, tickets, and domains -- sorted newest-first.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clientId` | number | Yes | The WHMCS client ID |

**Example Response:**
```json
{
  "clientId": 42,
  "events": [
    {
      "type": "ticket",
      "id": 8001,
      "date": "2026-01-05 09:30:00",
      "summary": "[Open] Cannot access cPanel",
      "status": "Open"
    },
    {
      "type": "invoice",
      "id": 5001,
      "date": "2026-01-01",
      "summary": "Invoice #5001 — $30.00 (Unpaid)",
      "status": "Unpaid"
    },
    {
      "type": "order",
      "id": 2002,
      "date": "2025-06-01",
      "summary": "Order #2002 — $15.00 (Active)",
      "status": "Active"
    },
    {
      "type": "domain",
      "id": 301,
      "date": "2025-01-15",
      "summary": "example.test — expires 2026-01-15 (Active)",
      "status": "Active"
    },
    {
      "type": "service",
      "id": 1,
      "date": "2025-01-01",
      "summary": "Shared Hosting — example.com (Active)",
      "status": "Active"
    }
  ]
}
```

---

### whmcs_get_client_autoauth_url

Returns a single-sign-on URL to log into the client area as this client. Requires WHMCS 7.7+; on older versions returns `{ supported: false, reason: "..." }`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clientId` | number | Yes | The WHMCS client ID |

**Example Response (WHMCS 7.7+):**
```json
{
  "supported": true,
  "redirectUrl": "https://billing.example.com/admin/clientssummary.php?userid=42&token=sso_token_abc123",
  "accessToken": "sso_token_abc123"
}
```

**Example Response (older WHMCS):**
```json
{
  "supported": false,
  "reason": "CreateSsoToken API action requires WHMCS 7.7 or later."
}
```
