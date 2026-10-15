import { IsEmail, IsString, MinLength, IsOptional } from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "admin@sv.ipb.ac.id" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: "password123" })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ description: "Cloudflare Turnstile verification token" })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
