import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginUserDto {
  @IsEmail({}, { message: 'Email must be a valid email address.' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  // Note: We check MinLength here primarily for preventing accidental empty submissions, 
  // though the password comparison logic handles the final security check.
  @MinLength(1, { message: 'Password cannot be empty.' }) 
  password: string;
}