import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule } from './authentication/authentication.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true,   envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'], }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      global: true,
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { 
          expiresIn: '60m' // Tokens expire after 60 minutes
        },
        global: true, // Makes JwtService globally available
      }),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Prefer an explicit MONGO_URI (set in production). For local dev, fallback to a local DB.
        const uri = config.get<string>('MONGO_URI');
        const nodeEnv = config.get<string>('NODE_ENV') || process.env.NODE_ENV || 'development';

        if (uri) return { uri } as any;

        if (nodeEnv === 'production') {
          // Fail fast in production if no MONGO_URI provided
          throw new Error('MONGO_URI must be provided in production environment');
        }

        // Development fallback
        return { uri: 'mongodb://localhost:27017/user_registration' } as any;
      },
    }),
    AuthenticationModule,
  ],
})
export class AppModule {}
