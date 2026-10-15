import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Mutasi } from "./mutasi.entity";
import { Asset } from "../assets/asset.entity";
import { MutasiService } from "./mutasi.service";
import { MutasiController } from "./mutasi.controller";
import { GatewayModule } from "../gateway/gateway.module";

@Module({
  imports: [TypeOrmModule.forFeature([Mutasi, Asset]), GatewayModule],
  controllers: [MutasiController],
  providers: [MutasiService],
  exports: [MutasiService],
})
export class MutasiModule {}
