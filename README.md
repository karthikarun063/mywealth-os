# MyWealth OS v2.0

**Privacy-first personal finance dashboard — Node.js · Express · PostgreSQL · Vanilla JS · Chart.js**

---

## Tech Stack

| Layer     | Technology                  |
|-----------|-----------------------------|
| Backend   | Node.js 18+ · Express 4     |
| Database  | PostgreSQL 14+              |
| Frontend  | HTML5 · CSS3 · Vanilla JS   |
| Charts    | Chart.js 4.4 (CDN)          |

---

## Quick Start

### 1. Clone & install
```bash
git clone <repo>
cd mywealth-os
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — set DATABASE_URL to your PostgreSQL connection string
```

### 3. Set up the database
```bash
# Create the database (if it doesn't exist)
psql -U postgres -c "CREATE DATABASE mywealth;"

# Run schema migrations
node db/init.js

# (Optional) Seed with demo data
node db/seed.js
```

### 4. Start the server
```bash
npm start          # production
npm run dev        # development (nodemon auto-reload)
```

Open → **http://localhost:3000**

---

## API Reference

All endpoints return JSON. Base URL: `/api`

| Method | Endpoint                          | Description                    |
|--------|-----------------------------------|--------------------------------|
| GET    | `/api/health`                     | Server health check            |
| GET    | `/api/dashboard`                  | Aggregated dashboard summary   |
| GET    | `/api/assets`                     | All assets + portfolio summary |
| POST   | `/api/assets`                     | Create asset                   |
| PUT    | `/api/assets/:id`                 | Update asset                   |
| DELETE | `/api/assets/:id`                 | Delete asset                   |
| GET    | `/api/liabilities`                | All liabilities + summary      |
| POST   | `/api/liabilities`                | Create liability               |
| PUT    | `/api/liabilities/:id`            | Update liability               |
| DELETE | `/api/liabilities/:id`            | Delete liability               |
| GET    | `/api/transactions`               | Paginated transactions         |
| GET    | `/api/transactions/monthly-summary` | 6-month income/expense       |
| GET    | `/api/transactions/category-totals` | Top expense categories       |
| POST   | `/api/transactions`               | Create transaction             |
| DELETE | `/api/transactions/:id`           | Delete transaction             |
| GET    | `/api/budgets?month=YYYY-MM`      | Budgets + actual spend         |
| POST   | `/api/budgets`                    | Upsert budget                  |
| DELETE | `/api/budgets/:id`                | Delete budget                  |
| GET    | `/api/goals`                      | All goals                      |
| POST   | `/api/goals`                      | Create goal                    |
| PUT    | `/api/goals/:id`                  | Update goal                    |
| DELETE | `/api/goals/:id`                  | Delete goal                    |
| GET    | `/api/snapshots`                  | Monthly wealth snapshots       |
| POST   | `/api/snapshots/generate`         | Auto-generate current snapshot |
| GET    | `/api/insights`                   | Rule-based financial insights  |

---

## Project Structure

```
mywealth-os/
├── server.js                  # Express app entry point
├── .env.example               # Environment template
├── db/
│   ├── connection.js          # PostgreSQL pool
│   ├── schema.sql             # Full database schema + indexes + triggers
│   ├── init.js                # Schema runner
│   └── seed.js                # Demo data seeder
├── routes/
│   ├── dashboard.js           # Aggregated summary endpoint
│   ├── assets.js              # Assets CRUD
│   ├── liabilities.js         # Liabilities CRUD
│   ├── transactions.js        # Transactions + analytics
│   ├── budgets.js             # Budgets with upsert
│   ├── goals.js               # Goals CRUD
│   ├── snapshots.js           # Monthly snapshots
│   └── insights.js            # Rule-based insight engine
├── middleware/
│   └── errorHandler.js        # Centralised error + 404 handling
└── public/                    # Static frontend (SPA)
    ├── index.html             # App shell
    ├── css/
    │   └── main.css           # Complete dark theme
    └── js/
        ├── app.js             # Router init + sidebar update
        ├── lib/
        │   ├── utils.js       # inr(), sipFV(), ASSET_LABELS, DOM helpers
        │   ├── api.js         # Fetch wrapper for all endpoints
        │   ├── ui.js          # Toast, Modal, Router, Confirm
        │   └── charts.js      # Chart.js wrappers (area, bar, doughnut…)
        └── pages/
            ├── dashboard.js   # Net worth, allocation, cash flow charts
            ├── assets.js      # Asset CRUD with class filter + P&L table
            ├── liabilities.js # Liability CRUD + annual interest
            ├── transactions.js# Paginated cash flow + type/category filters
            ├── goals.js       # Goals with probability engine + SIP gap
            ├── budget.js      # Budget vs actual with progress bars
            ├── fire.js        # FIRE calculator with interactive projection
            ├── analytics.js   # 4 charts + wealth projection
            ├── insights.js    # Rule-based insight cards + metrics
            └── portfolio.js   # Portfolio optimizer + rebalancing plan
```

---

## Pages

| Page               | Features                                                    |
|--------------------|-------------------------------------------------------------|
| Dashboard          | Net worth KPIs, allocation doughnut, cash flow bars, snapshots |
| Assets             | CRUD, class filter, P&L per holding, allocation bars       |
| Liabilities        | CRUD, annual interest cost, EMI tracking                   |
| Cash Flow          | Paginated (25/page), type/category filters, running totals |
| Goals              | Probability engine, SIP gap analysis, progress bars        |
| Budget             | Budget vs actual, overspend alerts, progress bars          |
| FIRE Calc          | Interactive corpus projection, FIRE age, needle gauge      |
| Analytics          | CAGR, 6-month cash flow, asset class breakdown, projection |
| AI Insights        | 10+ rule-based insights: savings, debt, emergency fund, concentration |
| Portfolio Optimizer| 3 target profiles, gap analysis table, rebalancing plan    |

---

## Environment Variables

| Variable       | Description                              | Default    |
|----------------|------------------------------------------|------------|
| `PORT`         | HTTP server port                         | `3000`     |
| `DATABASE_URL` | PostgreSQL connection string             | (required) |
| `NODE_ENV`     | `development` or `production`            | `development` |

---

## Database Schema

Six tables with proper indexes and auto-updated `updated_at` triggers:

- **assets** — holdings with asset class, purchase/current value
- **liabilities** — loans with outstanding amount, interest rate, EMI
- **transactions** — income/expense ledger with recurring flag
- **budgets** — monthly category limits (upsert on conflict)
- **goals** — financial goals with SIP and expected return
- **snapshots** — monthly wealth history (net worth, savings rate)
