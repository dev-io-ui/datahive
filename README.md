# DataHive — Dataset Creation & Labeling Platform

A production-ready, scalable SaaS platform for crowdsourced dataset creation, validation, and management. Built for teams that need to collect, label, and validate data at scale.

---

## Architecture Overview

```
datahive/
├── backend/                    # Node.js + Express API
│   ├── config/
│   │   ├── database.js         # MongoDB connection
│   │   ├── queues.js           # Bull/Redis queue factory
│   │   └── storage.js          # AWS S3 / multer config
│   ├── controllers/            # Request handlers (thin layer)
│   │   ├── authController.js
│   │   ├── taskController.js
│   │   ├── submissionController.js
│   │   └── adminController.js
│   ├── middleware/
│   │   ├── auth.js             # JWT verify + RBAC
│   │   ├── errorHandler.js     # Global error handler + asyncHandler
│   │   ├── rateLimiter.js      # Per-route rate limits
│   │   └── validators.js       # express-validator chains
│   ├── models/
│   │   ├── User.js             # Roles, wallet, stats
│   │   ├── Task.js             # Tasks with slots + pricing
│   │   ├── Submission.js       # Submitted work + multi-validation
│   │   ├── TaskAssignment.js   # Contributor ↔ Task lock
│   │   ├── ValidationAssignment.js  # Validator ↔ Submission lock
│   │   └── WalletTransaction.js     # Double-entry ledger
│   ├── queues/
│   │   └── workers.js          # Bull job processors
│   ├── routes/
│   │   └── index.js            # All routes in one place
│   ├── services/               # Business logic layer
│   │   ├── authService.js
│   │   ├── assignmentService.js  # Race-condition-safe assignment
│   │   ├── submissionService.js  # Submit + multi-validation logic
│   │   ├── walletService.js      # Atomic credit/debit
│   │   └── analyticsService.js   # Dashboard stats + export
│   ├── utils/
│   │   ├── logger.js           # Winston structured logging
│   │   ├── jwt.js              # Token helpers
│   │   └── apiResponse.js      # Standardized response helpers
│   └── server.js               # Express app entry point
│
└── frontend/                   # React SPA
    └── src/
        ├── context/AuthContext.jsx   # Global auth state
        ├── services/api.js           # Axios + auto token refresh
        ├── components/shared/Layout.jsx
        └── pages/
            ├── LoginPage.jsx / RegisterPage.jsx
            ├── ContributorDashboard.jsx
            ├── ValidatorDashboard.jsx
            ├── AdminDashboard.jsx
            ├── AdminTasks.jsx
            ├── AdminUsers.jsx
            ├── AdminSubmissions.jsx
            ├── TaskDetail.jsx
            ├── SubmissionHistory.jsx
            └── WalletPage.jsx
```

---

## Key Design Decisions

### 1. Race-Condition-Safe Task Assignment

The assignment system prevents two contributors from claiming the same task slot using **atomic MongoDB operations**:

```js
// In assignmentService.js — atomically claims a slot
const task = await Task.findOneAndUpdate(
  {
    status: 'active',
    _id: { $nin: doneTaskIds },
    $expr: { $lt: ['$assignedCount', '$totalSlots'] }, // slot check is IN the query
  },
  { $inc: { assignedCount: 1 } },  // atomic increment
  { new: true, sort: { assignedCount: 1 } }
);
```

If the subsequent `TaskAssignment.create()` fails (duplicate key), the slot is rolled back atomically.

### 2. Multi-Validation with Majority Vote

Each submission can require N validator reviews (`task.validationsRequired`). Final decision uses majority vote:

```
acceptCount > rejectCount → accepted
rejectCount >= acceptCount → rejected
```

Validators cannot review their own submissions or review the same submission twice.

### 3. Lock Expiry

Both task assignments and validation assignments have a `lockExpiry` timestamp. Locks are released automatically by a periodic Bull job (`*/5 * * * *`). This prevents abandoned tasks from blocking the pool indefinitely.

### 4. Wallet Atomicity

All wallet operations use MongoDB sessions (transactions) to guarantee balance integrity. Debit operations include a balance check in the query filter — if balance is insufficient, the `findOneAndUpdate` returns `null` and the transaction is rolled back without touching the ledger.

---

## Prerequisites

- Node.js 18+
- MongoDB 6+ (local or Atlas)
- Redis 7+ (optional, required for Bull queues)
- AWS account with S3 bucket (optional, falls back to local disk)

---

## Setup Instructions

### Backend

```bash
cd backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env — minimum required:
# MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET

# Create logs directory
mkdir -p logs uploads

# Start development server
npm run dev

# Production
NODE_ENV=production npm start
```

### Frontend

```bash
cd frontend
npm install

# Create .env.local
echo "REACT_APP_API_URL=http://localhost:5000/api/v1" > .env.local

npm start          # Development
npm run build      # Production build
```

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | — | Register contributor or validator |
| POST | `/auth/login` | — | Login, returns access + refresh tokens |
| POST | `/auth/refresh` | — | Rotate tokens |
| POST | `/auth/logout` | ✓ | Invalidate refresh token |
| GET | `/auth/me` | ✓ | Get current user profile |

### Tasks

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tasks` | ✓ | List tasks (paginated, filterable) |
| GET | `/tasks/:id` | ✓ | Get task details |
| GET | `/tasks/assign/next` | contributor | Auto-assign next available task |
| POST | `/tasks` | admin | Create task |
| PUT | `/tasks/:id` | admin | Update task |
| DELETE | `/tasks/:id` | admin | Archive task |

### Submissions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/submissions` | contributor | Submit (multipart/form-data) |
| GET | `/submissions/my` | contributor | My submission history |
| GET | `/submissions/assign` | validator | Get next submission to review |
| POST | `/submissions/validate` | validator | Submit validation decision |
| GET | `/submissions/validations/my` | validator | My validation history |
| GET | `/submissions` | admin | All submissions |
| GET | `/submissions/:id` | admin | Single submission with validations |

### Wallet

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/wallet` | ✓ | Balance and summary |
| GET | `/wallet/transactions` | ✓ | Transaction history |
| POST | `/wallet/withdraw` | ✓ | Request withdrawal |

### Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/dashboard` | admin | Platform stats |
| GET | `/admin/users` | admin | All users (searchable) |
| PATCH | `/admin/users/:id/status` | admin | Suspend/activate user |
| PATCH | `/admin/users/:id/role` | admin | Change user role |
| GET | `/admin/tasks/:taskId/export` | admin | Export dataset (JSON or CSV) |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | ✓ | — | MongoDB connection string |
| `JWT_SECRET` | ✓ | — | Access token signing secret |
| `JWT_REFRESH_SECRET` | ✓ | — | Refresh token signing secret |
| `JWT_EXPIRES_IN` | | `7d` | Access token TTL |
| `REDIS_HOST` | | — | Redis host (disables queues if absent) |
| `AWS_ACCESS_KEY_ID` | | — | S3 credentials (uses disk if absent) |
| `AWS_SECRET_ACCESS_KEY` | | — | S3 credentials |
| `AWS_S3_BUCKET` | | — | S3 bucket name |
| `LOCK_EXPIRY_MINUTES` | | `30` | Task/validation lock TTL |
| `MAX_FILE_SIZE_MB` | | `50` | Upload size limit |
| `FRONTEND_URL` | | `http://localhost:3000` | CORS allowed origin |
| `LOG_LEVEL` | | `info` | Winston log level |

---

## Database Indexes

Critical indexes for performance at scale:

```js
// Task — assignment queries
{ status: 1, assignedCount: 1, totalSlots: 1 }

// TaskAssignment — prevents double-assignment
{ task: 1, contributor: 1 }  // UNIQUE
{ lockExpiry: 1 }             // cleanup queries

// ValidationAssignment — prevents double-review
{ submission: 1, validator: 1 }  // UNIQUE
{ lockExpiry: 1 }

// Submission — contributor + status
{ task: 1, contributor: 1 }  // UNIQUE
{ status: 1, task: 1 }
{ contributor: 1, status: 1 }

// WalletTransaction
{ user: 1, createdAt: -1 }
```

---

## Production Checklist

- [ ] Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (32+ random characters)
- [ ] Enable MongoDB authentication and use Atlas or dedicated server
- [ ] Configure Redis with password
- [ ] Set `AWS_S3_BUCKET` with server-side encryption enabled
- [ ] Set `NODE_ENV=production`
- [ ] Configure reverse proxy (nginx) with SSL termination
- [ ] Set up log rotation for `logs/`
- [ ] Configure MongoDB Atlas backups or `mongodump` cron
- [ ] Set `FRONTEND_URL` to your actual domain
- [ ] Rate limit tuning per environment
- [ ] Set up monitoring (e.g., Datadog, New Relic, or self-hosted Prometheus)

---

## Extending the Platform

### Add a new task type (e.g., video)
1. Add `'video'` to `Task.type` enum
2. Add `video/*` to `ALLOWED_TYPES` in `config/storage.js`
3. Add video player component to `ValidatorDashboard.jsx` and `TaskDetail.jsx`

### Add payment gateway integration
1. Implement in `walletService.js` → `requestWithdrawal()`
2. Add webhook handler to receive payment confirmations
3. Update `WalletTransaction.withdrawal.processorRef` with gateway reference

### Add email notifications
1. Add `nodemailer` or SendGrid SDK
2. Process `notificationQueue` jobs in `queues/workers.js`
3. Enqueue notifications from service layer on key events

### Horizontal scaling
- The backend is stateless — run multiple instances behind a load balancer
- Bull queues use Redis for coordination across instances
- MongoDB handles concurrent writes safely via the atomic update pattern
- Ensure session affinity is NOT required (no server-side sessions)
