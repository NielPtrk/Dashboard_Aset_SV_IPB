import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { AssetsModule } from "./assets/assets.module";
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { MutasiModule } from "./mutasi/mutasi.module";
import { PengadaanModule } from "./pengadaan/pengadaan.module";
import { OpnameModule } from "./opname/opname.module";
import { DokumenModule } from "./dokumen/dokumen.module";
import { AktivitasModule } from "./aktivitas/aktivitas.module";
import { UsersModule } from "./users/users.module";
import { RuanganModule } from "./ruangan/ruangan.module";
import { StorageModule } from "./storage/storage.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { GatewayModule } from "./gateway/gateway.module";
import { AiModule } from "./ai/ai.module";
import { GuidelinesModule } from './guidelines/guidelines.module';
import { ObservasiModule } from "./observasi/observasi.module";
import { JwtAuthGuard } from "./auth/guards/jwt-auth.guard";
import { RolesGuard } from "./auth/guards/roles.guard";

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({ isGlobal: true }),

    // PostgreSQL via TypeORM
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: "postgres",
        host: cfg.get("DB_HOST", "localhost"),
        port: cfg.get<number>("DB_PORT", 5432),
        database: cfg.get("DB_NAME", "aset_sv_ipb"),
        username: cfg.get("DB_USER", "postgres"),
        password: cfg.get("DB_PASSWORD", ""),
        autoLoadEntities: true,
        synchronize: cfg.get("NODE_ENV") !== "production",
        logging: cfg.get("NODE_ENV") === "development",
      }),
    }),

    // Feature modules
    AuthModule,
    AssetsModule,
    MaintenanceModule,
    MutasiModule,
    PengadaanModule,
    OpnameModule,
    DokumenModule,
    AktivitasModule,
    UsersModule,
    RuanganModule,
    ObservasiModule,
    StorageModule,
    NotificationsModule,
    GatewayModule,
    AiModule,
    GuidelinesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
