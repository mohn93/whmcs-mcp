0# Changelog

All notable changes to the WHMCS MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added
- vitest test harness with in-process mock WHMCS server
- `WhmcsClient` base class under `src/whmcs/client.ts`
- Runtime WHMCS version probe + capability flags (`src/whmcs/version.ts`)
- Domain split pattern: `src/whmcs/domains/system.ts`, `src/mcp/tools/system.ts`
- PII-scrubbing fixture capture script (`npm run capture -- <Action>`)

## [1.2.0] - 2026-01-01

### Added

#### Docker Support
- Multi-stage Dockerfile for optimized production images
- Docker Compose configuration for easy deployment
- GitHub Actions workflow for automated Docker builds
- Multi-platform support (linux/amd64, linux/arm64)
- Container published to GitHub Container Registry (ghcr.io)
- Docker deployment documentation

## [1.1.0] - 2026-01-01

### Added

#### Prompts
- `client-onboarding` - Guided workflow for onboarding new clients
- `ticket-response` - Generate professional support ticket responses
- `revenue-report` - Comprehensive revenue analysis report generation
- `client-health-check` - Full account health assessment
- `bulk-invoice-reminder` - Bulk payment reminder workflow
- `domain-expiry-audit` - Proactive domain expiration management
- `new-product-setup` - Product configuration guidance
- `fraud-investigation` - Security and fraud analysis workflow

#### Resources
- `whmcs://stats` - Real-time WHMCS system statistics
- `whmcs://products` - Products catalog
- `whmcs://support/departments` - Support departments list
- `whmcs://payment-methods` - Available payment methods
- `whmcs://currencies` - Currency configuration
- `whmcs://servers` - Configured servers for provisioning
- `whmcs://admin-users` - Administrator users
- `whmcs://tld-pricing` - Domain TLD pricing
- `whmcs://promotions` - Active promotional codes
- `whmcs://support/statuses` - Ticket status configuration
- `whmcs://admin/todo` - Admin to-do items

## [1.0.0] - 2026-01-01

### Added

#### Client Management
- `whmcs_get_clients` - List clients with filtering and pagination
- `whmcs_get_client_details` - Get detailed client information
- `whmcs_add_client` - Create new clients
- `whmcs_update_client` - Update existing clients
- `whmcs_delete_client` - Delete clients
- `whmcs_get_client_products` - List client's products/services
- `whmcs_get_client_domains` - List client's domains

#### Product Management
- `whmcs_get_products` - List available products with pricing
- `whmcs_get_product_groups` - List product groups

#### Billing & Invoices
- `whmcs_get_invoices` - List invoices with filtering
- `whmcs_get_invoice` - Get detailed invoice information
- `whmcs_create_invoice` - Create new invoices
- `whmcs_update_invoice` - Update existing invoices
- `whmcs_add_payment` - Record payments on invoices
- `whmcs_apply_credit` - Apply credit to invoices
- `whmcs_get_transactions` - List payment transactions

#### Support Tickets
- `whmcs_get_tickets` - List support tickets with filtering
- `whmcs_get_ticket` - Get ticket details with replies
- `whmcs_open_ticket` - Create new support tickets
- `whmcs_add_ticket_reply` - Reply to tickets
- `whmcs_update_ticket` - Update ticket properties
- `whmcs_delete_ticket` - Delete tickets
- `whmcs_get_support_departments` - List support departments
- `whmcs_get_support_statuses` - Get ticket status counts

#### Domain Management
- `whmcs_register_domain` - Send domain registration command
- `whmcs_transfer_domain` - Initiate domain transfer
- `whmcs_renew_domain` - Renew domains
- `whmcs_get_domain_whois` - Get WHOIS information
- `whmcs_get_domain_nameservers` - Get domain nameservers
- `whmcs_update_domain_nameservers` - Update nameservers
- `whmcs_get_domain_lock_status` - Check domain lock status
- `whmcs_update_domain_lock_status` - Lock/unlock domains
- `whmcs_get_tld_pricing` - Get TLD pricing information

#### Order Management
- `whmcs_get_orders` - List orders with filtering
- `whmcs_accept_order` - Accept and process orders
- `whmcs_cancel_order` - Cancel orders
- `whmcs_delete_order` - Delete orders
- `whmcs_fraud_order` - Mark orders as fraudulent
- `whmcs_pending_order` - Set orders to pending status

#### Server & Module Management
- `whmcs_get_servers` - List configured servers
- `whmcs_module_create` - Provision service accounts
- `whmcs_module_suspend` - Suspend service accounts
- `whmcs_module_unsuspend` - Unsuspend service accounts
- `whmcs_module_terminate` - Terminate service accounts
- `whmcs_module_change_password` - Change service passwords

#### System Tools
- `whmcs_get_stats` - Get system statistics
- `whmcs_get_admin_users` - List admin users
- `whmcs_get_payment_methods` - List payment methods
- `whmcs_get_currencies` - List configured currencies
- `whmcs_get_activity_log` - View activity log
- `whmcs_log_activity` - Add activity log entries
- `whmcs_get_email_templates` - List email templates
- `whmcs_send_email` - Send emails to clients
- `whmcs_get_todo_items` - List admin to-do items

#### Affiliate Management
- `whmcs_get_affiliates` - List affiliates
- `whmcs_activate_affiliate` - Activate client as affiliate

#### Promotion Management
- `whmcs_get_promotions` - List promotions/coupons

#### Quote Management
- `whmcs_get_quotes` - List quotes
- `whmcs_create_quote` - Create new quotes
- `whmcs_accept_quote` - Accept quotes (convert to invoice)
- `whmcs_delete_quote` - Delete quotes

### Technical
- TypeScript implementation with full type safety
- Zod schema validation for all tool inputs
- WHMCS API client with comprehensive error handling
- Support for API credentials and optional access key authentication
- Environment variable configuration via dotenv
- VS Code MCP integration configuration

[Unreleased]: https://github.com/yourusername/whmcs-mcp-server/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/whmcs-mcp-server/releases/tag/v1.0.0
