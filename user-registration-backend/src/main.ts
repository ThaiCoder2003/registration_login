import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';                             
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
    app.enableCors({
    origin: process.env.FRONTEND_URL || '*',// your React app
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  const configService = app.get(ConfigService);

  const port = Number(process.env.PORT) || 4000;
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const mongoUri = configService.get<string>('MONGO_URI') || 'mongodb://localhost:27017/user_db';

    // Log active environment and database connection details
  console.log('----------------------------------------');
  console.log(`Environment: ${nodeEnv}`);
  console.log(`Port: ${port}`);
  console.log(`Database URI: ${mongoUri}`);
  console.log('----------------------------------------');

  // Listen using the port retrieved from ConfigService
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
