import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { json, urlencoded } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Global prefix for all API routes
  app.setGlobalPrefix("api");

  // Allow large payloads for Excel bulk uploads
  app.use(json({ limit: "50mb" }));
  app.use(urlencoded({ extended: true, limit: "50mb" }));

  // Global validation pipe — strips unknown fields, enables transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // CORS — allow the frontend origin
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("Aset SV IPB API")
    .setDescription("REST API untuk Sistem Manajemen Aset Sekolah Vokasi IPB")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = parseInt(process.env.PORT ?? "3001", 10);
  await app.listen(port);
  console.log(`🚀 Aset SV IPB backend running on port ${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
