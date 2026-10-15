import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

@Injectable()
export class AiService {
  private readonly genAI: GoogleGenerativeAI;
  private readonly logger = new Logger(AiService.name);

  private readonly systemInstruction = `Anda adalah Asisten AI Manajemen Aset SV IPB. Bantu pengguna memahami data aset,
menjelaskan kondisi aset, memberikan rekomendasi pemeliharaan, dan menjawab pertanyaan terkait pengelolaan
aset Sekolah Vokasi IPB. Jawab dengan bahasa Indonesia yang profesional dan ringkas.`;

  private readonly safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];

  constructor(cfg: ConfigService) {
    const apiKey = cfg.get("GEMINI_API_KEY", "");
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async chat(message: string, history: { role: "user" | "model"; parts: string }[] = []): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: this.systemInstruction,
        safetySettings: this.safetySettings,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      });

      const chat = model.startChat({
        history: history.map((h) => ({ role: h.role, parts: [{ text: h.parts }] })),
      });

      const result = await chat.sendMessage(message);
      return result.response.text();
    } catch (err) {
      this.logger.error("AI chat error:", err);
      return "Maaf, terjadi kesalahan saat menghubungi layanan AI.";
    }
  }

  async summariseStats(stats: Record<string, unknown>): Promise<string> {
    return this.chat(
      `Berikan ringkasan singkat (3-4 kalimat) tentang kondisi aset berdasarkan data: ${JSON.stringify(stats)}. Fokus pada temuan penting dan rekomendasi prioritas.`,
    );
  }
}
