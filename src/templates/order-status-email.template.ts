export interface OrderStatusData {
  orderId: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'partial';
  serviceName: string;
  platform: string;
  quantity: number;
  targetUrl: string;
  userName: string;
  orderDate: Date;
  completedDate?: Date;
  progress?: number;
  notes?: string;
}

export const orderStatusEmailTemplate = (orderData: OrderStatusData) => {
  const statusColors = {
    pending: '#f59e0b',
    processing: '#3b82f6',
    completed: '#10b981',
    cancelled: '#ef4444',
    partial: '#f59e0b'
  };

  const statusMessages = {
    pending: 'Your order has been received and is waiting to be processed.',
    processing: 'Your order is currently being processed and delivered.',
    completed: 'Great news! Your order has been completed successfully.',
    cancelled: 'Your order has been cancelled.',
    partial: 'Your order has been partially completed.'
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Update - ${orderData.orderId}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: white; padding: 30px; border-radius: 10px; border: 1px solid #ddd;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">🚀 Boostlab</h1>
            <p style="color: #666; margin: 5px 0;">Order Status Update</p>
        </div>
        
        <div style="background: ${statusColors[orderData.status]}; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h2 style="margin: 0;">Order #${orderData.orderId}</h2>
            <p style="margin: 10px 0 0 0; font-size: 18px; text-transform: uppercase; font-weight: bold;">${orderData.status}</p>
        </div>

        <div style="margin: 20px 0;">
            <p>Hi <strong>${orderData.userName}</strong>,</p>
            <p>${statusMessages[orderData.status]}</p>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">📋 Order Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Service:</td>
                    <td style="padding: 8px 0;">${orderData.serviceName}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Platform:</td>
                    <td style="padding: 8px 0;">${orderData.platform}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Quantity:</td>
                    <td style="padding: 8px 0;">${orderData.quantity.toLocaleString()}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Target URL:</td>
                    <td style="padding: 8px 0; word-break: break-all;">${orderData.targetUrl}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Order Date:</td>
                    <td style="padding: 8px 0;">${orderData.orderDate.toLocaleDateString()}</td>
                </tr>
                ${orderData.completedDate ? `
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Completed Date:</td>
                    <td style="padding: 8px 0;">${orderData.completedDate.toLocaleDateString()}</td>
                </tr>
                ` : ''}
                ${orderData.progress !== undefined ? `
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Progress:</td>
                    <td style="padding: 8px 0;">${orderData.progress}%</td>
                </tr>
                ` : ''}
            </table>
        </div>

        ${orderData.notes ? `
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="margin: 0 0 10px 0;">📝 Notes:</h4>
            <p style="margin: 0;">${orderData.notes}</p>
        </div>
        ` : ''}

        <div style="margin: 20px 0;">
            <h3>💡 Need Help?</h3>
            <p>If you have any questions about your order, our support team is here to help 24/7.</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            <p>Thank you for choosing Boostlab!</p>
            <p>&copy; ${new Date().getFullYear()} Boostlab. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;
}; 