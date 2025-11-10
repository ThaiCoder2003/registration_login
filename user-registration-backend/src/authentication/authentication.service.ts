import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';

interface JwtPayload {
    name?: string;
    iat?: number;
    email: string;
    sub: string; // Subject (often used for user ID)
}

@Injectable()
export class AuthenticationService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private readonly jwtService: JwtService,
    ) {}

    async registerUser(registrationData: { email: string; password: string; name?: string }): Promise<any> {
        const { email, password, name } = registrationData;
        
        // Check if user already exists
        const existingUser = await this.userModel.findOne({ email }).exec();
        if (existingUser) {
            throw new ConflictException('User with this email already exists');
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new this.userModel({
            email,
            passwordHash: hashedPassword,
            name,
        });

        const savedUser = await newUser.save();
        const { passwordHash: _, ...result } = savedUser.toJSON();
        return result as Omit<User, 'passwordHash'>;
    }

    async loginUser(loginData: { email: string; password: string }): Promise<any> {
        const { email, password } = loginData;
        
        // Find user by email
        const user = await this.userModel.findOne({ email }).exec();
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload: JwtPayload = { email: user.email, sub: user._id as string, name: user.name };
        const accessToken = this.jwtService.sign(payload);

        const { passwordHash: _, ...result } = user.toJSON();
        return {
            user: result as Omit<User, 'passwordHash'>,
            accessToken,
        };
    }
}
