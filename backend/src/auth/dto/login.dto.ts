import { IsString, MinLength, IsOptional } from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "Budi Santoso", description: "Username pengguna (boleh berspasi, case-insensitive)" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value))
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: "Admin123" })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ description: "Cloudflare Turnstile verification token" })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
