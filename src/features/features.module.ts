import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FeaturesGateway } from './features.gateway';
import { FeaturesService } from './features.service';
import { AdminFeaturesController, FeaturesController } from './features.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FeaturesController, AdminFeaturesController],
  providers: [FeaturesGateway, FeaturesService],
  exports: [FeaturesService],
})
export class FeaturesModule {}
