import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterUserDto {
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  password: string;

  @IsString()
  @IsOptional()
  name?: string;
}