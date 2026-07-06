import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SmmpanelkingService } from './smmpanelking.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [SmmpanelkingService],
  exports: [SmmpanelkingService],
})
export class SmmpanelkingModule {}
