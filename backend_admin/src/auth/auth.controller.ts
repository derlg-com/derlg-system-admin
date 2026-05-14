import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password);

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
      message: 'ok',
      error: null,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request) {
    const refreshToken = req.cookies?.refresh_token;
    const result = await this.authService.refreshTokens(refreshToken);

    return {
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
      message: 'ok',
      error: null,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    await this.authService.logout(refreshToken);

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return {
      success: true,
      data: null,
      message: 'Logged out successfully',
      error: null,
    };
  }
}
