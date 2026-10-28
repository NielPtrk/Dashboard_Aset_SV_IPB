import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { AiService } from "./ai.service";

class ChatDto {
  message: string;
  history?: { role: "user" | "model"; parts: string }[];
}

import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("ai")
@ApiBearerAuth()
@Roles("Admin Sistem", "Admin Pusat", "Pekerja Stock Opname")
@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("chat")
  chat(@Body() body: ChatDto) {
    return this.ai.chat(body.message, body.history);
  }

  @Post("summarise")
  summarise(@Body() body: { stats: Record<string, unknown> }) {
    return this.ai.summariseStats(body.stats);
  }
}
