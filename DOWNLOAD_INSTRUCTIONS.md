# High Bred Bullies - Download Instructions

## Project Size Issue
The complete project is 672MB due to node_modules and attached assets. Replit has download limits that may prevent downloading the full project.

## Solutions for Downloading

### Option 1: Git Clone (Recommended)
If you need the complete project with history:
```bash
git clone <your-replit-git-url>
cd high-bred-bullies
npm install
```

### Option 2: Download Source Only
The actual source code is much smaller (~50MB without node_modules). After downloading:
```bash
npm install
```

### Option 3: Manual Recreation
If download fails completely, you can recreate the project:

1. Create new Node.js project
2. Copy `package.json` and run `npm install`
3. Copy source files from these key directories:
   - `client/src/` - React frontend
   - `server/` - Express backend
   - `shared/` - Database schema
   - Root config files: `vite.config.ts`, `tailwind.config.ts`, etc.

## Essential Files for Recreation
If you can only download parts, prioritize these:
- `package.json` - Dependencies
- `replit.md` - Project documentation
- `shared/schema.ts` - Database schema
- `server/` directory - Backend code
- `client/src/` directory - Frontend code
- `.env` file (create manually with your credentials)

## Environment Variables Needed
```
DATABASE_URL=postgresql://rtownsend@50.193.77.237:5432/high_bred
JWT_SECRET=your_jwt_secret
SMTP_HOST=mail.firsttolaunch.com
SMTP_USER=admin@firsttolaunch.com
SMTP_PASS=your_smtp_password
OPENAI_API_KEY=your_openai_key
STRIPE_SECRET_KEY=your_stripe_key
```

## After Setup
1. Run `npm install`
2. Create `.env` file with above variables
3. Run `npm run dev`
4. Visit http://localhost:5000

## Database
The project uses PostgreSQL at 50.193.77.237:5432/high_bred
Schema is defined in `shared/schema.ts` using Drizzle ORM