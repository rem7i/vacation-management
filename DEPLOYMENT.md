# Deployment Guide - Employee Vacation Management System

## Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **Neon Database** - Create a PostgreSQL database at [console.neon.tech](https://console.neon.tech)
3. **GitHub/GitLab/Bitbucket** - For repository hosting

---

## Step 1: Set Up Neon Database

1. Go to [console.neon.tech](https://console.neon.tech) and create a new project
2. Create a database named `vacation_management`
3. Copy the connection string (it will look like: `postgresql://user:password@ep-xxx.region.aws.neon.tech/vacation_management?sslmode=require`)
4. Save this for Step 3

---

## Step 2: Push Code to Git Repository

```bash
cd vacation-management
git init
git add .
git commit -m "Initial commit: Employee Vacation Management System"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vacation-management.git
git push -u origin main
```

---

## Step 3: Deploy to Vercel

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

4. **Environment Variables** - Add these in Vercel project settings:

| Variable | Value | Description |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://user:password@ep-xxx.region.aws.neon.tech/vacation_management?sslmode=require` | Your Neon connection string |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | Your Vercel deployment URL |
| `NEXTAUTH_SECRET` | `your-super-secret-key-min-32-chars` | Generate with: `openssl rand -base64 32` |
| `EMAIL_SERVER_HOST` | `smtp.example.com` | Optional: SMTP host |
| `EMAIL_SERVER_PORT` | `587` | Optional: SMTP port |
| `EMAIL_SERVER_USER` | `your-email@example.com` | Optional: SMTP user |
| `EMAIL_SERVER_PASSWORD` | `your-email-password` | Optional: SMTP password |
| `EMAIL_FROM` | `noreply@yourdomain.com` | Optional: From email |

5. Click **Deploy**

### Option B: Via Vercel CLI

```bash
npm i -g vercel
cd vacation-management
vercel
# Follow prompts, then:
vercel env add DATABASE_URL
vercel env add NEXTAUTH_URL
vercel env add NEXTAUTH_SECRET
# Add other env vars as needed
vercel --prod
```

---

## Step 4: Initialize Database Schema

After first deployment, run the database migration:

### Option A: Via Vercel CLI (Recommended)

```bash
vercel env pull .env.local
npx prisma db push
npx prisma db seed  # If you have a seed script
```

### Option B: Locally with Production Database

```bash
# Copy production DATABASE_URL to local .env
cp .env.example .env
# Edit .env with your Neon connection string
npx prisma db push
```

### Option C: Via Prisma Studio (Visual)

```bash
npx prisma studio
# Opens browser UI to manage data
```

---

## Step 5: Create Initial Admin User

After database is initialized, create an admin user:

### Option A: Via Prisma Studio
1. Run `npx prisma studio`
2. Go to User table → Add record
3. Set `role` to `ADMIN`
4. Set `email` and `password` (hashed)

### Option B: Via Seed Script (Recommended)

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 12)
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      email: 'admin@company.com',
      name: 'Admin User',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })

  // Create default vacation types
  const vacationTypes = [
    { name: 'Annual Leave', code: 'ANNUAL', defaultDays: 20, color: '#3B82F6', requiresApproval: true },
    { name: 'Sick Leave', code: 'SICK', defaultDays: 10, color: '#EF4444', requiresApproval: true },
    { name: 'Unpaid Leave', code: 'UNPAID', defaultDays: 0, color: '#6B7280', requiresApproval: true },
    { name: 'Parental Leave', code: 'PARENTAL', defaultDays: 0, color: '#8B5CF6', requiresApproval: true },
  ]

  for (const vt of vacationTypes) {
    await prisma.vacationType.upsert({
      where: { code: vt.code },
      update: {},
      create: vt,
    })
  }

  console.log('Database seeded!')
  console.log('Admin user:', admin.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

Add to `package.json`:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

Run:
```bash
npm install -D ts-node
npx prisma db seed
```

---

## Step 6: Verify Deployment

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Log in with admin credentials
3. Test:
   - [ ] Admin dashboard loads with stats
   - [ ] Can add/edit/deactivate employees
   - [ ] Can approve/reject vacation requests
   - [ ] Employee dashboard shows vacation balance
   - [ ] Employees can submit vacation requests
   - [ ] Responsive on mobile

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | Neon PostgreSQL connection string |
| `NEXTAUTH_URL` | ✅ Yes | Your app URL (e.g., `https://app.vercel.app`) |
| `NEXTAUTH_SECRET` | ✅ Yes | 32+ char secret (`openssl rand -base64 32`) |
| `EMAIL_SERVER_HOST` | No | SMTP host for email auth |
| `EMAIL_SERVER_PORT` | No | SMTP port (usually 587) |
| `EMAIL_SERVER_USER` | No | SMTP username |
| `EMAIL_SERVER_PASSWORD` | No | SMTP password |
| `EMAIL_FROM` | No | From email address |

---

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` includes `?sslmode=require`
- Check Neon dashboard: project must be "Active" (not suspended)
- Ensure IP allowlist in Neon allows Vercel IPs (or use 0.0.0.0/0)

### Build Failures
- Check `vercel logs` for detailed errors
- Ensure all environment variables are set in Vercel
- Run `npm run build` locally first

### Auth Issues
- `NEXTAUTH_URL` must match your deployment URL exactly
- `NEXTAUTH_SECRET` must be set and consistent
- Clear browser cookies if session issues persist

### Prisma Issues
- Run `npx prisma generate` after schema changes
- Run `npx prisma db push` to sync schema
- Check `prisma/schema.prisma` for relation errors

---

## Production Checklist

- [ ] `NEXTAUTH_SECRET` is strong (32+ chars)
- [ ] `NEXTAUTH_URL` matches production domain
- [ ] `DATABASE_URL` uses Neon pooled connection for serverless
- [ ] Email configured for password reset (optional)
- [ ] Custom domain configured in Vercel (optional)
- [ ] Analytics enabled in Vercel (optional)
- [ ] Error tracking configured (Sentry, etc.) (optional)

---

## Useful Commands

```bash
# Local development
npm run dev

# Build for production
npm run build

# Database commands
npx prisma generate
npx prisma db push
npx prisma db pull
npx prisma studio
npx prisma migrate dev

# Vercel
vercel dev          # Local dev with Vercel env
vercel env ls       # List env vars
vercel logs         # View deployment logs
vercel rollback     # Rollback deployment
```

---

## Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Neon Docs**: [neon.tech/docs](https://neon.tech/docs)
- **NextAuth.js**: [next-auth.js.org](https://next-auth.js.org)
- **Prisma**: [prisma.io/docs](https://prisma.io/docs)
- **Next.js**: [nextjs.org/docs](https://nextjs.org/docs)