import { ApiProperty } from '@nestjs/swagger';

// Provider service type (from SMMStone)
export class SMMService {
  @ApiProperty()
  service: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  rate: string;

  @ApiProperty()
  min: string;

  @ApiProperty()
  max: string;

  @ApiProperty()
  dripfeed: boolean;

  @ApiProperty()
  refill: boolean;

  @ApiProperty()
  cancel: boolean;

  @ApiProperty()
  category: string;
}

// Our platform type
export class PlatformResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// Our category type
export class CategoryResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  platformId: string;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// Our service response type
export class ServiceResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  serviceId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  providerRate: number;

  @ApiProperty()
  boostRate: number;

  @ApiProperty()
  minOrder: number;

  @ApiProperty()
  maxOrder: number;

  @ApiProperty()
  platformId: string;

  @ApiProperty({ type: () => PlatformResponse })
  platform: PlatformResponse;

  @ApiProperty()
  categoryId: string;

  @ApiProperty({ type: () => CategoryResponse })
  category: CategoryResponse;

  @ApiProperty()
  dripfeed: boolean;

  @ApiProperty()
  refill: boolean;

  @ApiProperty()
  cancel: boolean;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  lastChecked: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export interface SMMServiceRequest {
  key: string;
  action: string;
}

export class SyncResponse {
  @ApiProperty()
  updated: number;

  @ApiProperty()
  added: number;

  @ApiProperty()
  hasChanges: boolean;
} 