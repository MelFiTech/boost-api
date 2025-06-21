# Deployment Guide

## Environment Variables Required

Your deployment platform needs these environment variables configured:

### Database Configuration
```
DATABASE_URL=postgresql://username:password@host:port/database_name
```

**Important**: Replace `host` with your actual database host (not `localhost`). For cloud deployments, use the provided database connection string from your cloud provider.

### JWT Configuration
```
JWT_SECRET=b7e3554499867f6ea545d34660c62b896d5d5137c06a0a0a84f6f8742c9988f3a78f04a133cca9b86e6550e789f4b1c0f8dd135037ec921b889cae53e9d66db8
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
RESEND_API_KEY=re_BxVhJmNm_NpzEzQruaSYu8XVronG3fvh9
FROM_EMAIL=noreply@melfitech.com
FROM_NAME=Boostlab
```

### Expo Push Notifications
```
EXPO_ACCESS_TOKEN=95FJk0wk-vbTrGOK5lpFBv9jZPXMNbjWXREUUcy3
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