import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { Asset } from "../assets/asset.entity";
import { User } from "../users/user.entity";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "5432"),
  username: process.env.DB_USER ?? "postgres",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "aset_sv_ipb",
  entities: [Asset, User],
  migrations: ["src/database/migrations/*.ts"],
  synchronize: false,
  logging: false,
});
