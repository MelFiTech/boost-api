import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PinController } from './pin.controller';
import { PinService } from './pin.service';

@Module({
  imports: [PrismaModule],
  controllers: [PinController],
  providers: [PinService],
  exports: [PinService],
})
export class PinModule {}
