import { Controller, Post, Body, UseGuards, Get, Request } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { JwtAuthGuard } from './jwt/jwt.guard';
import { RegisterUserDto } from './dto/register-user.dto'; // <-- New Import
import { LoginUserDto } from './dto/login-user.dto'; // <-- New Import

@Controller('authentication')
export class AuthenticationController {
    constructor(private readonly authService: AuthenticationService) {}

    @Post('register')
    async register(@Body() registrationData: RegisterUserDto): Promise<any> {
        return this.authService.registerUser(registrationData);
    }

    @Post('login')
    async login(@Body() loginData: LoginUserDto): Promise<any> {
        return this.authService.loginUser(loginData);
    }

    @Post('refresh')
    async refresh(@Body() { refreshToken }: { refreshToken: string }): Promise<any> {
        return this.authService.refreshToken(refreshToken);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    getProfile(@Request() req) {
        return {
            message: 'Access granted to protected route.',
            authenticatedUser: {
                sub: req.user.sub,
                email: req.user.email,
                name: req.user.name || 'N/A',
                iat: req.user.iat,
            },
        };
    }


}
