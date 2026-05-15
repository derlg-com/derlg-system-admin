import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
  };

  const mockResponse = () => {
    const res: any = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockRequest = (cookies = {}) => {
    return { cookies } as any;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return access token and set refresh token cookie', async () => {
      const loginResult = {
        accessToken: 'access-token-1',
        refreshToken: 'refresh-token-1',
        user: {
          id: 'user-1',
          email: 'admin@derlg.com',
          fullName: 'Admin',
          role: 'admin',
          adminRole: 'SUPER_ADMIN',
        },
      };

      mockAuthService.login.mockResolvedValue(loginResult);

      const res = mockResponse();
      const result = await controller.login(
        { email: 'admin@derlg.com', password: 'password' },
        res,
      );

      expect(result.success).toBe(true);
      expect(result.data.accessToken).toBe('access-token-1');
      expect(result.data.user.email).toBe('admin@derlg.com');
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-token-1',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        }),
      );
    });
  });

  describe('refresh', () => {
    it('should return new access token from cookie', async () => {
      const refreshResult = {
        accessToken: 'new-access-token',
        user: {
          id: 'user-1',
          email: 'admin@derlg.com',
          fullName: 'Admin',
          role: 'admin',
          adminRole: 'SUPER_ADMIN',
        },
      };

      mockAuthService.refreshTokens.mockResolvedValue(refreshResult);

      const req = mockRequest({ refresh_token: 'valid-refresh-token' });
      const result = await controller.refresh(req);

      expect(result.success).toBe(true);
      expect(result.data.accessToken).toBe('new-access-token');
      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('valid-refresh-token');
    });
  });

  describe('logout', () => {
    it('should clear cookie and revoke token', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const req = mockRequest({ refresh_token: 'refresh-token-1' });
      const res = mockResponse();
      const result = await controller.logout(req, res);

      expect(result.success).toBe(true);
      expect(mockAuthService.logout).toHaveBeenCalledWith('refresh-token-1');
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
        }),
      );
    });
  });
});
