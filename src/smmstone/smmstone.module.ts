import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmmstoneService } from './smmstone.service';

@Module({
  imports: [ConfigModule],
  providers: [SmmstoneService],
  exports: [SmmstoneService],
})
export class SmmstoneModule {} 