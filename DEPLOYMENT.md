# Deployment Guide

## Environment Variables Required

Your deployment platform needs these environment variables configured:

### Database Configuration

#### For Production:
```
DATABASE_URL=postgresql://doadmin:YOUR_DB_PASSWORD@boostlab-db-do-user-22918702-0.d.db.ondigitalocean.com:25060/defaultdb?sslmode=require
```

**Note**: Replace `YOUR_DB_PASSWORD` with your actual database password when setting up the environment variable in your deployment platform.

#### For Development/Other Environments:
```
DATABASE_URL=postgresql://username:password@host:port/database_name
```

**Important**: 
- Replace `YOUR_DB_PASSWORD` with your actual DigitalOcean database password
- For development, replace `host` with your local database host (usually `localhost`)
- Always ensure the database is accessible from your deployment environment
- When `NODE_ENV=production`, use the production DATABASE_URL
- The application will automatically use the `DATABASE_URL` environment variable set in your deployment platform
- **Never commit actual database passwords to version control**

### JWT Configuration
```
JWT_SECRET=
JWT_EXPIRES_IN=7d
```

### SMM Stone API Configuration
```
SMMSTONE_API_URL=https://smmstone.com/api/v2
SMMSTONE_API_KEY=your_smmstone_api_key
```

### BudPay Configuration
```
BUDPAY_PUBLIC_KEY=pk_test_your_public_key
BUDPAY_SECRET_KEY=sk_test_your_secret_key
BUDPAY_WEBHOOK_SECRET=your_webhook_secret
```

### Resend Email Configuration
```
RESEND_API_KEY=
FROM_EMAIL=noreply@melfitech.com
FROM_NAME=Boostlab
```

### Expo Push Notifications
```
EXPO_ACCESS_TOKEN=
```

### Application Configuration
```
NODE_ENV=production
PORT=8080
APP_NAME=Boost API
APP_VERSION=1.0.0
```

### Admin Configuration
```
ADMIN_EMAIL=admin@melfitech.com
DEFAULT_CURRENCY=NGN
DEFAULT_EXCHANGE_RATE=1600
```

### Security Configuration
```
BCRYPT_SALT_ROUNDS=12
OTP_EXPIRY_MINUTES=5
SESSION_SECRET=your_session_secret_here
```

### Logging
```
LOG_LEVEL=info
```

## Deployment Steps

1. **Set Environment Variables**: Configure all the above environment variables in your deployment platform
2. **Database Setup**: Ensure your PostgreSQL database is accessible from the deployment environment
3. **Run Migrations**: The app will automatically run Prisma migrations on startup
4. **Build Process**: The deployment will run `yarn build` to compile TypeScript
5. **Start Application**: The app will start with `yarn start:prod`

## Database Management

### Production Database Operations

To run migrations against the production database, ensure you have the production `DATABASE_URL` environment variable set, then use:

```bash
# Deploy pending migrations to production
yarn db:migrate:prod

# Push schema changes directly to production (use with caution)
yarn db:push:prod

# Open Prisma Studio for production database
yarn db:studio:prod
```

### Development Database Operations

For local development, use the standard commands:

```bash
# Generate Prisma client
yarn db:generate

# Deploy migrations to development database
yarn db:migrate

# Seed the database
yarn db:seed
```

## Health Check

Once deployed, you can check if the application is running:
- Health endpoint: `GET /health`
- API documentation: `GET /docs` (Swagger UI)

## Common Issues

1. **DATABASE_URL not found**: Ensure the DATABASE_URL environment variable is set correctly
2. **Database connection failure**: Make sure DATABASE_URL points to accessible database host (not localhost)
3. **Port binding issues**: Application listens on PORT environment variable (default: 8080)
4. **Health check failure**: Ensure health endpoint `/health` is accessible on the configured port
5. **Yarn version conflicts**: Remove `packageManager` field from package.json if conflicts occur
6. **Prisma Client errors**: Run `yarn prisma generate` if needed
7. **Build failures**: Check that all dependencies are installed with `yarn install`

## Production Checklist

- [ ] All environment variables configured
- [ ] Database accessible and migrations applied
- [ ] Domain verified in Resend dashboard
- [ ] BudPay webhook endpoints configured
- [ ] Health check endpoint responding
- [ ] API documentation accessible
- [ ] Email notifications working
- [ ] Push notifications configured 