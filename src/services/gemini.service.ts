import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'gemini-2.0-flash';
  }

  async generateUsername(email: string): Promise<string> {
    try {
      this.logger.debug(`Generating username for email: ${email}`);

      if (!this.apiKey) {
        this.logger.warn('GEMINI_API_KEY not found, falling back to email-based username');
        return this.fallbackUsername(email);
      }

      const prompt = `Generate a creative, unique and dope username based on the aura of this email address: ${email}

Requirements:
- Must be 3-20 characters long
- Use only letters
- Just a 1 word catchy username
- Should be creative and funny
- Based on the email
- Make it memorable and unique
- Avoid offensive or inappropriate words

Return ONLY the username, nothing else.`;

      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 50,
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid response from Gemini API');
      }

      const generatedUsername = data.candidates[0].content.parts[0].text.trim();
      
      // Validate the generated username
      const cleanUsername = this.validateAndCleanUsername(generatedUsername);
      
      this.logger.log(`Generated username: ${cleanUsername} for email: ${email}`);
      return cleanUsername;

    } catch (error) {
      this.logger.error(`Error generating username for ${email}:`, error);
      // Fallback to email-based username if Gemini fails
      return this.fallbackUsername(email);
    }
  }

  private validateAndCleanUsername(username: string): string {
    // Remove any quotes, spaces, and invalid characters
    let cleaned = username.replace(/[^a-zA-Z0-9_]/g, '');
    
    // Ensure it's within length limits
    if (cleaned.length < 3) {
      cleaned = cleaned + Math.random().toString(36).substring(2, 5);
    }
    if (cleaned.length > 20) {
      cleaned = cleaned.substring(0, 20);
    }
    
    // Ensure it doesn't start with a number
    if (/^[0-9]/.test(cleaned)) {
      cleaned = 'user_' + cleaned;
    }
    
    return cleaned.toLowerCase();
  }

  private fallbackUsername(email: string): string {
    // Extract username part from email
    const emailPrefix = email.split('@')[0];
    
    // Clean the prefix
    let username = emailPrefix.replace(/[^a-zA-Z0-9_]/g, '');
    
    // Add random suffix to make it unique
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    username = `${username}_${randomSuffix}`;
    
    // Ensure length limits
    if (username.length > 20) {
      username = username.substring(0, 16) + randomSuffix.substring(0, 4);
    }
    
    return username.toLowerCase();
  }
} 