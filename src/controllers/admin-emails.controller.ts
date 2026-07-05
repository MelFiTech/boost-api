import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EMAIL_TEMPLATES, getEmailTemplate } from '../emails/email-template.registry';
import { EmailService } from '../emails/email.service';

@ApiTags('admin')
@Controller('admin/emails')
@UseGuards(JwtAuthGuard)
export class AdminEmailsController {
  constructor(private readonly emailService: EmailService) {}

  @Get('status')
  @ApiOperation({ summary: 'Email provider status (ZeptoMail)' })
  getStatus() {
    return { success: true, data: this.emailService.getStatus() };
  }

  @Get('templates')
  @ApiOperation({ summary: 'List email templates available for preview' })
  listTemplates() {
    return {
      success: true,
      data: EMAIL_TEMPLATES.map((t) => ({
        slug: t.slug,
        name: t.name,
        description: t.description,
        subject: t.subject(),
      })),
    };
  }

  @Get('preview/:slug')
  @ApiOperation({ summary: 'Render an email template as HTML for admin preview' })
  previewTemplate(@Param('slug') slug: string, @Res() res: Response) {
    const template = getEmailTemplate(slug);
    if (!template) {
      res.status(404).send('Template not found');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(template.render());
  }
}
