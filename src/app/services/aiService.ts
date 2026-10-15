import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type GenerativeModel,
  type ChatSession,
} from "@google/generative-ai";

// ─── Configuration ─────────────────────────────────────────────────────────────
// In production, set VITE_GEMINI_API_KEY in your .env file.
// Never expose this key in client-side code for public deployments —
// proxy the call through your NestJS backend instead.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "YOUR_GEMINI_API_KEY_HERE";
const MODEL_NAME = "gemini-1.5-flash";

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const SYSTEM_PROMPT = `Anda adalah Asisten AI Manajemen Aset SV IPB. Anda membantu pengguna memahami data aset,
menjelaskan kondisi aset, memberikan rekomendasi pemeliharaan, dan menjawab pertanyaan terkait pengelolaan
aset Sekolah Vokasi IPB. Jawab dengan bahasa Indonesia yang profesional dan ringkas.`;

// ─── Singleton model instance ──────────────────────────────────────────────────
let _model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (!_model) {
    const genAI = new GoogleGenerativeAI(API_KEY);
    _model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_PROMPT,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });
  }
  return _model;
}

// ─── Per-session chat history ──────────────────────────────────────────────────
let _chat: ChatSession | null = null;

export const aiService = {
  startNewChat(): void {
    _chat = getModel().startChat({ history: [] });
  },

  async sendMessage(text: string): Promise<string> {
    if (!_chat) this.startNewChat();
    try {
      const result = await _chat!.sendMessage(text);
      return result.response.text();
    } catch (err) {
      console.error("AI service error:", err);
      return "Maaf, terjadi kesalahan saat menghubungi layanan AI. Silakan coba lagi.";
    }
  },

  // One-shot prompt (no session history)
  async generateText(prompt: string): Promise<string> {
    try {
      const result = await getModel().generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.error("AI generateText error:", err);
      return "Maaf, terjadi kesalahan. Silakan coba lagi.";
    }
  },

  // Summarise asset analytics for the AI assistant panel
  async summariseAssets(stats: Record<string, unknown>): Promise<string> {
    const prompt = `Berikan ringkasan singkat (3-4 kalimat) tentang kondisi aset berdasarkan data berikut:
${JSON.stringify(stats, null, 2)}
Fokus pada temuan penting dan rekomendasi tindakan prioritas.`;
    return this.generateText(prompt);
  },

  async recommendMaintenance(assetInfo: Record<string, unknown>): Promise<string> {
    const prompt = `Berdasarkan data aset berikut, berikan rekomendasi pemeliharaan:
${JSON.stringify(assetInfo, null, 2)}
Berikan rekomendasi dalam format poin-poin yang jelas.`;
    return this.generateText(prompt);
  },
};

export default aiService;
