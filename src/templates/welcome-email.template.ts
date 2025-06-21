export const welcomeEmailTemplate = (userName: string, userEmail: string) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Boostlab</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: white; padding: 30px; border-radius: 10px; border: 1px solid #ddd;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">🚀 Boostlab</h1>
            <p style="color: #666; margin: 5px 0;">Social Media Marketing Made Easy</p>
        </div>
        
        <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h2 style="margin: 0; font-size: 24px;">Welcome, ${userName}! 🎉</h2>
            <p style="margin: 10px 0 0 0;">Your journey to social media success starts here</p>
        </div>

        <div style="margin: 20px 0;">
            <p>Hi <strong>${userName}</strong>,</p>
            <p>Thank you for joining Boostlab! We're excited to help you grow your social media presence.</p>
            <p>Your account (<strong>${userEmail}</strong>) is now active and ready to use.</p>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">🎯 What You Can Do:</h3>
            <ul>
                <li><strong>Instagram:</strong> Followers, Likes, Views, Comments</li>
                <li><strong>TikTok:</strong> Followers, Likes, Views, Shares</li>
                <li><strong>YouTube:</strong> Subscribers, Views, Likes</li>
                <li><strong>Facebook:</strong> Page Likes, Post Likes, Followers</li>
                <li><strong>Twitter:</strong> Followers, Likes, Retweets</li>
            </ul>
        </div>

        <div style="margin: 20px 0;">
            <h3>💡 Need Help?</h3>
            <p>Our support team is here to assist you 24/7</p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            <p>Welcome to the Boostlab family!</p>
            <p>&copy; ${new Date().getFullYear()} Boostlab. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
  `;
}; 