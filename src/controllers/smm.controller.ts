import { Controller, Post, Body } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SMMService } from '../services/smm.service';
import { ServiceResponse, SyncResponse } from '../types/smm.types';
import { ServiceRequestDto } from '../dto/service-request.dto';

@ApiTags('SMM')
@Controller('smm')
export class SMMController {
  constructor(private readonly smmService: SMMService) {}

  @Post('services')
  @ApiOperation({ summary: 'Get all services from provider' })
  @ApiResponse({
    status: 200,
    description: 'Returns all services',
    type: ServiceResponse,
    isArray: true
  })
  async getServices(): Promise<ServiceResponse[]> {
    return this.smmService.getServices();
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync services with provider' })
  @ApiResponse({
    status: 200,
    description: 'Returns sync status',
    type: SyncResponse
  })
  async syncServices(): Promise<SyncResponse> {
    return this.smmService.syncServices();
  }

  @Post('request')
  @ApiTags('orders')
  @ApiOperation({ summary: 'Request a service' })
  @ApiResponse({
    status: 201,
    description: 'Service order created successfully'
  })
  async requestService(@Body() dto: ServiceRequestDto) {
    return this.smmService.createServiceOrder(dto);
  }
} 