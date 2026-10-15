import { IsEmail, IsString, MinLength, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "Nama Lengkap" })
  @IsString()
  nama: string;

  @ApiProperty({ example: "user@apps.ipb.ac.id" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "rahasia123" })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ example: "Sekolah Vokasi (SV)" })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: "Pekerja Stock Opname" })
  @IsOptional()
  @IsString()
  harapan_role?: string;

  @ApiPropertyOptional({ description: "Cloudflare Turnstile verification token" })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: "user@apps.ipb.ac.id" })
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;
}
