# BudPay Integration Guide

## Overview
This SMM Panel now uses BudPay's Bank Transfer API for processing NGN payments. BudPay provides a simple and reliable bank transfer solution for Nigerian businesses.

## Environment Setup

Add your BudPay secret key to your `.env` file:

```env
BUDPAY_SECRET_KEY=your_budpay_secret_key_here
USDT_EXCHANGE_RATE=1500
```

## API Endpoints

### 1. Initiate Payment
**POST** `/api/v1/payments/initiate`

```json
{
  "orderId": "cmbulftog00011g7xl0j09ba2",
  "provider": "budpay",
  "email": "customer@example.com",
  "customerName": "John Doe",
  "phone": "+2348123456789"
}
```

**Response:**
```json
{
  "success": true,
  "paymentType": "bank_transfer",
  "data": {
    "reference": "boost_cmbulftog00011g7xl0j09ba2_1749813896001",
    "amount": "2515.50",
    "currency": "NGN",
    "accountNumber": "1014692362",
    "bankName": "BudPay Bank",
    "accountName": "Business Name / Firstname lastname",
    "instructions": [
      "Transfer exactly ₦2515.50 to the account details above",
      "Use the exact amount - any difference will cause payment failure",
      "Payment will be confirmed automatically once received",
      "Contact support if you need assistance"
    ]
  }
}
```

### 2. Verify Payment
**POST** `/api/v1/payments/verify`

```json
{
  "reference": "boost_cmbulftog00011g7xl0j09ba2_1749813896001",
  "provider": "budpay"
}
```

### 3. Get Payment Status
**GET** `/api/v1/payments/status/{orderId}`

### 4. Webhook Endpoint
**POST** `/api/v1/payments/webhook/budpay`

Configure this URL in your BudPay dashboard to receive payment notifications.

## How It Works

1. **Order Creation**: Customer creates an order through the orders endpoint
2. **Payment Initiation**: Frontend calls the payment initiate endpoint with BudPay as provider
3. **Bank Account Generation**: BudPay generates a temporary bank account for the exact amount
4. **Customer Transfer**: Customer transfers the exact amount to the provided account details
5. **Webhook Notification**: BudPay sends a webhook notification when payment is received
6. **Order Processing**: Payment status is updated and order processing begins

## Key Features

- **Exact Amount Matching**: BudPay ensures only the exact amount is accepted
- **Automatic Confirmation**: Payments are confirmed automatically via webhooks
- **Real-time Status**: Payment status is updated in real-time
- **Error Handling**: Comprehensive error handling for failed payments

## Testing

To test the integration:

1. Create a test order using the orders endpoint
2. Initiate payment with BudPay provider
3. Use the provided bank account details to make a test transfer
4. Monitor the webhook endpoint for payment confirmation
5. Verify the order status changes to "PROCESSING" after payment

## Error Handling

The system handles various error scenarios:

- **Invalid Order**: Returns 404 if order doesn't exist
- **Already Paid**: Returns 400 if payment already completed
- **API Errors**: Logs BudPay API errors and returns appropriate messages
- **Webhook Failures**: Logs webhook processing errors for debugging

## Security Considerations

- All API calls to BudPay are authenticated with your secret key
- Webhook signature verification can be added for enhanced security
- Payment references are unique and time-stamped
- All sensitive data is logged securely

## Migration from Paystack

The migration from Paystack to BudPay includes:

- Updated payment provider enum from `paystack` to `budpay`
- Simplified bank transfer flow (no fallback to checkout needed)
- Updated webhook handling for BudPay's format
- Maintained all existing order and payment status logic

## Support

For BudPay-specific issues:
- Check BudPay documentation: https://budpay.com/docs
- Contact BudPay support for API-related issues
- Monitor application logs for integration debugging 