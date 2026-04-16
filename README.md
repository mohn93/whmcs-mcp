# WHMCS MCP Server

[![CI](https://github.com/scarecr0w12/whmcs-mcp-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/scarecr0w12/whmcs-mcp-tool/actions/workflows/ci.yml)
[![Docker](https://github.com/scarecr0w12/whmcs-mcp-tool/actions/workflows/docker.yml/badge.svg)](https://github.com/scarecr0w12/whmcs-mcp-tool/actions/workflows/docker.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.0-green.svg)](https://modelcontextprotocol.io/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)

A Model Context Protocol (MCP) server for managing WHMCS (Web Host Manager Complete Solution) installations. This server provides comprehensive tools for managing clients, products, billing, support tickets, domains, and more through the WHMCS API.

<a href="https://glama.ai/mcp/servers/@scarecr0w12/whmcs-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@scarecr0w12/whmcs-mcp-server/badge" />
</a>

## 📚 Documentation

- [Configuration Guide](docs/CONFIGURATION.md) - Detailed setup and configuration instructions
- [API Reference](docs/API_REFERENCE.md) - Complete tool documentation with parameters
- [Docker Guide](docs/DOCKER.md) - Container deployment instructions
- [Changelog](CHANGELOG.md) - Version history and release notes
- [Contributing](CONTRIBUTING.md) - Guidelines for contributors

## ✨ Features

### 🤖 AI-Powered Prompts
Pre-built prompt templates for common WHMCS workflows:
- **Client Onboarding** - Guided new client setup
- **Ticket Response** - Generate professional support responses
- **Revenue Report** - Comprehensive financial analysis
- **Client Health Check** - Account status assessment
- **Bulk Invoice Reminder** - Automated payment follow-up
- **Domain Expiry Audit** - Proactive domain management
- **New Product Setup** - Product configuration guidance
- **Fraud Investigation** - Security analysis workflow

### 📊 Live Resources
Real-time data endpoints for instant access:
- System statistics (`whmcs://stats`)
- Products catalog (`whmcs://products`)
- Support departments (`whmcs://support/departments`)
- Payment methods (`whmcs://payment-methods`)
- Currencies (`whmcs://currencies`)
- Servers (`whmcs://servers`)
- TLD pricing (`whmcs://tld-pricing`)
- Promotions (`whmcs://promotions`)
- Ticket statuses (`whmcs://support/statuses`)
- Admin to-do items (`whmcs://admin/todo`)

### Client Management
- List, search, and filter clients
- Get detailed client information
- Create, update, and delete clients
- View client products and services
- View client domains

### Product Management
- List available products
- Get product groups
- View product pricing

### Billing & Invoices
- List and filter invoices
- Create and update invoices
- Add payments to invoices
- Apply credits
- View transactions

### Support Tickets
- List and filter tickets
- View ticket details and replies
- Create new tickets
- Reply to tickets
- Update ticket status
- Get support departments and statuses

### Domain Management
- Register, transfer, and renew domains
- Manage nameservers
- Lock/unlock domains
- Get TLD pricing
- View WHOIS information

### Order Management
- List and filter orders
- Accept, cancel, or delete orders
- Mark orders as fraudulent
- Set orders to pending

### Server & Module Management
- List configured servers
- Create/provision services
- Suspend/unsuspend services
- Terminate services
- Change service passwords

### System Tools
- Get system statistics
- View admin users
- Get payment methods and currencies
- Activity logging
- Email templates
- To-do items

### Additional Features
- Affiliate management
- Promotion/coupon management
- Quote management

## 🔧 Installation

### Option 1: Docker (Recommended)

```bash
docker run -it --rm \
  -e WHMCS_API_URL="https://billing.example.com/" \
  -e WHMCS_API_IDENTIFIER="your-identifier" \
  -e WHMCS_API_SECRET="your-secret" \
  ghcr.io/scarecr0w12/whmcs-mcp-tool:latest
```

See [Docker Guide](docs/DOCKER.md) for detailed Docker deployment instructions.

### Option 2: From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/scarecr0w12/whmcs-mcp-tool.git
   cd whmcs-mcp-tool
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Configure your WHMCS credentials:
   ```bash
   cp .env.example .env
   # Edit .env with your WHMCS API credentials
   ```

## ⚙️ Configuration

For detailed configuration instructions, see the [Configuration Guide](docs/CONFIGURATION.md).

### Quick Start

1. Create API credentials in WHMCS: **Setup → Staff Management → API Credentials**
2. Copy the environment template: `cp .env.example .env`
3. Edit `.env` with your WHMCS credentials

### Environment Variables

Set the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `WHMCS_API_URL` | Yes | Your WHMCS installation URL (e.g., `https://billing.example.com/`) |
| `WHMCS_API_IDENTIFIER` | Yes | API credential identifier |
| `WHMCS_API_SECRET` | Yes | API credential secret |
| `WHMCS_ACCESS_KEY` | No | Optional API access key for additional security |
| `WHMCS_ALLOW_MUTATIONS` | No  | Set to `true` to enable mutating tools (`whmcs_resync_service`, …). Default: disabled. |

### API Access Key (Optional)

For additional security, you can configure an API Access Key:

1. In WHMCS admin, go to **Setup > General Settings > Security**
2. Set the **API Access Key** field
3. Add this key to your `WHMCS_ACCESS_KEY` environment variable

## 🚀 Usage

### With VS Code

The server can be used directly with VS Code's MCP support. The configuration is already set up in `.vscode/mcp.json`.

1. Set your environment variables
2. Build the project: `npm run build`
3. The MCP server will be available in VS Code

### Running Manually

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run build
npm start
```

### 🛠️ Available Tools

For complete parameter documentation, see the [API Reference](docs/API_REFERENCE.md).

#### Client Tools
- `whmcs_get_clients` - Get list of clients
- `whmcs_get_client_details` - Get detailed client information
- `whmcs_add_client` - Create a new client
- `whmcs_update_client` - Update an existing client
- `whmcs_delete_client` - Delete a client
- `whmcs_get_client_products` - Get client's products/services
- `whmcs_get_client_domains` - Get client's domains

#### Product Tools
- `whmcs_get_products` - Get available products
- `whmcs_get_product_groups` - Get product groups

#### Invoice Tools
- `whmcs_get_invoices` - Get invoices
- `whmcs_get_invoice` - Get invoice details
- `whmcs_create_invoice` - Create an invoice
- `whmcs_update_invoice` - Update an invoice
- `whmcs_add_payment` - Add payment to invoice
- `whmcs_apply_credit` - Apply credit to invoice
- `whmcs_get_transactions` - Get transactions

#### Ticket Tools
- `whmcs_get_tickets` - Get support tickets
- `whmcs_get_ticket` - Get ticket details
- `whmcs_open_ticket` - Create a new ticket
- `whmcs_add_ticket_reply` - Reply to a ticket
- `whmcs_update_ticket` - Update ticket properties
- `whmcs_delete_ticket` - Delete a ticket
- `whmcs_get_support_departments` - Get support departments
- `whmcs_get_support_statuses` - Get ticket statuses

#### Domain Tools
- `whmcs_register_domain` - Register a domain
- `whmcs_transfer_domain` - Transfer a domain
- `whmcs_renew_domain` - Renew a domain
- `whmcs_get_domain_whois` - Get WHOIS information
- `whmcs_get_domain_nameservers` - Get nameservers
- `whmcs_update_domain_nameservers` - Update nameservers
- `whmcs_get_domain_lock_status` - Get lock status
- `whmcs_update_domain_lock_status` - Update lock status
- `whmcs_get_tld_pricing` - Get TLD pricing

#### Order Tools
- `whmcs_get_orders` - Get orders
- `whmcs_accept_order` - Accept an order
- `whmcs_cancel_order` - Cancel an order
- `whmcs_delete_order` - Delete an order
- `whmcs_fraud_order` - Mark as fraudulent
- `whmcs_pending_order` - Set to pending

#### Server & Module Tools
- `whmcs_get_servers` - Get configured servers
- `whmcs_module_create` - Create/provision service
- `whmcs_module_suspend` - Suspend service
- `whmcs_module_unsuspend` - Unsuspend service
- `whmcs_module_terminate` - Terminate service
- `whmcs_module_change_password` - Change service password

#### System Tools
- `whmcs_get_stats` - Get system statistics
- `whmcs_get_admin_users` - Get admin users
- `whmcs_get_payment_methods` - Get payment methods
- `whmcs_get_currencies` - Get currencies
- `whmcs_get_activity_log` - Get activity log
- `whmcs_log_activity` - Log an activity
- `whmcs_get_email_templates` - Get email templates
- `whmcs_send_email` - Send an email
- `whmcs_get_todo_items` - Get to-do items

#### Affiliate Tools
- `whmcs_get_affiliates` - Get affiliates
- `whmcs_activate_affiliate` - Activate an affiliate

#### Promotion Tools
- `whmcs_get_promotions` - Get promotions/coupons

#### Quote Tools
- `whmcs_get_quotes` - Get quotes
- `whmcs_create_quote` - Create a quote
- `whmcs_accept_quote` - Accept a quote
- `whmcs_delete_quote` - Delete a quote

## 🔒 Security Considerations

1. **Never commit your `.env` file** - It contains sensitive API credentials
2. **Use API Access Keys** - For additional security layer
3. **IP Restrictions** - Configure IP restrictions in WHMCS for API access
4. **Minimal Permissions** - Only enable the API functions you need
5. **HTTPS Only** - Always use HTTPS for your WHMCS installation

## 🧪 Testing

Run the test script to verify your WHMCS connection:

```bash
npx tsx src/test.ts
```

## 💻 Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Watch mode for development
npm run watch
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [WHMCS API Documentation](https://developers.whmcs.com/api/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
