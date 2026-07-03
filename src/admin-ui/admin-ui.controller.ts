import { Controller, Get, Redirect, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { getAdminDashboardHtml } from './admin-dashboard.template';

@ApiExcludeController()
@Controller()
export class AdminUiController {
  private resolveAsset(filename: string): string | null {
    const candidates = [
      join(__dirname, 'assets', filename),
      join(process.cwd(), 'src', 'admin-ui', 'assets', filename),
      join(process.cwd(), 'dist', 'admin-ui', 'assets', filename),
    ];
    return candidates.find((path) => existsSync(path)) ?? null;
  }

  @Get()
  @Redirect('/admin', 302)
  root() {
    return;
  }

  @Get('admin')
  serveAdmin(@Req() req: Request, @Res() res: Response) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') || 'localhost';
    const baseUrl = `${protocol}://${host}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(getAdminDashboardHtml(baseUrl));
  }

  @Get('admin/assets/logo.png')
  serveLogo(@Res() res: Response) {
    const logoPath = this.resolveAsset('lime-logo.png');
    if (!logoPath) {
      res.status(404).send('Logo not found');
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    createReadStream(logoPath).pipe(res);
  }
}
