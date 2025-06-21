import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // If there's no user (no token or invalid token), proceed as guest
    if (!user) {
      return {
        isGuest: true,
      };
    }
    // If there is a user, return the authenticated user
    return user;
  }
} 