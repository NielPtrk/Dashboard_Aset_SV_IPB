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

  // Permissions-Policy for camera access
  app.use((_req: any, res: any, next: any) => {
    res.setHeader("Permissions-Policy", "camera=(self)");
    next();
  });

  // CORS — allow the frontend origin or hosting domains
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((u: string) => u.trim())
    : ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"];

  app.enableCors({
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
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
