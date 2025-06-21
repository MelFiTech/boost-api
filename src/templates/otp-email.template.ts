export const otpEmailTemplate = (otp: string, userName?: string) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your OTP Code - Boost API</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .otp-container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            margin: 30px 0;
        }
        .otp-code {
            font-size: 36px;
            font-weight: bold;
            letter-spacing: 8px;
            margin: 20px 0;
            font-family: 'Courier New', monospace;
        }
        .message {
            font-size: 16px;
            margin-bottom: 20px;
        }
        .warning {
            background: #fef3cd;
            border: 1px solid #fecb2e;
            color: #8a6d3b;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 14px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🚀 Boost API</div>
            <p>Secure Login Verification</p>
        </div>
        
        <div class="message">
            ${userName ? `<p>Hello <strong>${userName}</strong>,</p>` : '<p>Hello,</p>'}
            <p>You requested a one-time password (OTP) to access your account. Use the code below to complete your login:</p>
        </div>

        <div class="otp-container">
            <p style="margin: 0; font-size: 18px;">Your verification code is:</p>
            <div class="otp-code">${otp}</div>
            <p style="margin: 0; font-size: 14px;">This code expires in 10 minutes</p>
        </div>

        <div class="warning">
            <strong>Security Notice:</strong> Never share this code with anyone. Our team will never ask for your OTP code via email, phone, or any other method.
        </div>

        <div class="message">
            <p>If you didn't request this code, please ignore this email or contact our support team if you have concerns about your account security.</p>
        </div>

        <div class="footer">
            <p>This email was sent from Boost API</p>
            <p>© ${new Date().getFullYear()} Boost API. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;
}; 