import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ObservasiItem } from "./observasi-item.entity";
import { ObservasiService } from "./observasi.service";
import { ObservasiController } from "./observasi.controller";

@Module({
  imports: [TypeOrmModule.forFeature([ObservasiItem])],
  controllers: [ObservasiController],
  providers: [ObservasiService],
  exports: [ObservasiService],
})
export class ObservasiModule {}
