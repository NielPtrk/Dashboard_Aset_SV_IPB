import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Ruangan } from "./ruangan.entity";
import { RuanganService } from "./ruangan.service";
import { RuanganController } from "./ruangan.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Ruangan])],
  controllers: [RuanganController],
  providers: [RuanganService],
  exports: [RuanganService],
})
export class RuanganModule {}
