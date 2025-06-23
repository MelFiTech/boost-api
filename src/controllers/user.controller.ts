import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserService } from '../services/user.service';
import { UpdateUserSettingsDto, UpdateUserProfileDto } from '../dto/user.dto';

@ApiTags('user')
@Controller('user')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile information' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getUserProfile(@Request() req) {
    return this.userService.getUserProfile(req.user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateUserProfile(@Request() req, @Body() updateData: UpdateUserProfileDto) {
    return this.userService.updateUserProfile(req.user.userId, updateData);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get user notification preferences and settings' })
  @ApiResponse({ status: 200, description: 'User settings retrieved successfully' })
  async getUserSettings(@Request() req) {
    return this.userService.getUserSettings(req.user.userId);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update user notification preferences' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  async updateUserSettings(@Request() req, @Body() settingsData: UpdateUserSettingsDto) {
    return this.userService.updateUserSettings(req.user.userId, settingsData);
  }

  @Delete('account')
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  async deleteAccount(@Request() req, @Body() body?: { confirmPassword?: string }) {
    return this.userService.deleteAccount(req.user.userId, body?.confirmPassword);
  }
}

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserOrdersController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Get user order history' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of orders to return (default: 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Number of orders to skip (default: 0)' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'], description: 'Filter by order status' })
  @ApiResponse({ status: 200, description: 'Order history retrieved successfully' })
  async getUserOrders(
    @Request() req,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('status') status?: string,
  ) {
    return this.userService.getUserOrders(req.user.userId, {
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      status,
    });
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get detailed order information' })
  @ApiResponse({ status: 200, description: 'Order details retrieved successfully' })
  async getOrderDetails(@Request() req, @Param('orderId') orderId: string) {
    return this.userService.getOrderDetails(req.user.userId, orderId);
  }
}

 