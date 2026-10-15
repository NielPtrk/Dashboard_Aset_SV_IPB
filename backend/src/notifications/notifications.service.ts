import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  cc?: string;
}

@Injectable()
export class NotificationsService {
  private readonly transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly cfg: ConfigService) {
    const user = cfg.get<string>("SMTP_USER");
    const pass = cfg.get<string>("SMTP_PASS");

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host: cfg.get("SMTP_HOST", "smtp.gmail.com"),
        port: Number(cfg.get<number>("SMTP_PORT", 587)),
        secure: false,
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        "Kredensial SMTP (SMTP_USER, SMTP_PASS) belum dikonfigurasi di .env. Notifikasi email akan dicatat di log server.",
      );
    }
  }

  async sendEmail(payload: EmailPayload): Promise<void> {
    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.cfg.get("SMTP_FROM", "Aset SV IPB <noreply@sv.ipb.ac.id>"),
          to: Array.isArray(payload.to) ? payload.to.join(", ") : payload.to,
          cc: payload.cc,
          subject: payload.subject,
          html: payload.html,
        });
        this.logger.log(`Email terkirim ke ${payload.to}: ${payload.subject}`);
      } else {
        this.logger.log(
          `[SIMULASI EMAIL] Kepada: ${payload.to} | Subjek: ${payload.subject} | Konten: ${payload.html.replace(/<[^>]*>/g, " ").slice(0, 150)}...`,
        );
      }
    } catch (err) {
      this.logger.error(`Gagal mengirim email: ${(err as Error).message}`);
    }
  }

  // Auth & User Lifecycle Email Templates
  async sendVerificationEmail(to: string, nama: string, token: string): Promise<void> {
    const frontendUrl = this.cfg.get("FRONTEND_URL", "http://localhost:5173");
    const verifyUrl = `${frontendUrl}?verify_token=${token}`;
    await this.sendEmail({
      to,
      subject: `[Aset SV IPB] Verifikasi Alamat Email Anda`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px;">
          <h2 style="color: #022B5F;">Verifikasi Email Pendaftaran Akun</h2>
          <p>Halo <strong>${nama}</strong>,</p>
          <p>Terima kasih telah mendaftar di Sistem Manajemen Aset Sekolah Vokasi IPB. Untuk melanjutkan, silakan verifikasi alamat email Anda dengan menekan tautan di bawah ini:</p>
          <div style="margin: 24px 0;">
            <a href="${verifyUrl}" style="background-color: #022B5F; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verifikasi Email Sekarang</a>
          </div>
          <p>Atau masukkan kode verifikasi berikut: <strong style="font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${token}</strong></p>
          <p style="color: #6b7280; font-size: 13px;">Setelah verifikasi email berhasil, akun Anda akan ditinjau dan disetujui oleh Admin Sistem sebelum dapat digunakan untuk login.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 11px; color: #9ca3af;">Email ini dikirim otomatis oleh Sistem Manajemen Aset Sekolah Vokasi IPB.</p>
        </div>
      `,
    });
  }

  async sendApprovalEmail(to: string, nama: string, approved: boolean, role?: string, catatan?: string): Promise<void> {
    const frontendUrl = this.cfg.get("FRONTEND_URL", "http://localhost:5173");
    const subject = approved
      ? `[Aset SV IPB] Pendaftaran Akun Disetujui — Role: ${role}`
      : `[Aset SV IPB] Pendaftaran Akun Ditolak`;

    const html = approved
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px;">
          <h2 style="color: #15803d;">Pendaftaran Akun Disetujui</h2>
          <p>Halo <strong>${nama}</strong>,</p>
          <p>Akun Anda pada Sistem Manajemen Aset Sekolah Vokasi IPB telah <strong>disetujui</strong> oleh Admin Sistem.</p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; color: #166534;">Role yang diberikan: <strong>${role}</strong></p>
            ${catatan ? `<p style="margin: 6px 0 0; color: #374151; font-size: 13px;">Catatan: ${catatan}</p>` : ""}
          </div>
          <p>Silakan login ke sistem untuk mulai menggunakan layanan sesuai hak akses Anda:</p>
          <div style="margin: 20px 0;">
            <a href="${frontendUrl}" style="background-color: #022B5F; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Masuk ke Dashboard</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 11px; color: #9ca3af;">Email ini dikirim otomatis oleh Sistem Manajemen Aset Sekolah Vokasi IPB.</p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px;">
          <h2 style="color: #b91c1c;">Pendaftaran Akun Tidak Disetujui</h2>
          <p>Halo <strong>${nama}</strong>,</p>
          <p>Mohon maaf, pendaftaran akun Anda pada Sistem Manajemen Aset Sekolah Vokasi IPB saat ini <strong>tidak disetujui</strong> oleh Admin Sistem.</p>
          ${catatan ? `<div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 12px 16px; border-radius: 6px; margin: 16px 0; color: #991b1b; font-size: 13px;">Alasan: ${catatan}</div>` : ""}
          <p style="color: #6b7280; font-size: 13px;">Jika Anda merasa ini adalah kekeliruan, silakan hubungi Admin Sistem (Othniel Patrick Limbong) atau Sekretariat SV IPB.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 11px; color: #9ca3af;">Email ini dikirim otomatis oleh Sistem Manajemen Aset Sekolah Vokasi IPB.</p>
        </div>
      `;

    await this.sendEmail({ to, subject, html });
  }

  async sendPasswordResetEmail(to: string, nama: string, token: string): Promise<void> {
    const frontendUrl = this.cfg.get("FRONTEND_URL", "http://localhost:5173");
    const resetUrl = `${frontendUrl}?reset_token=${token}`;
    await this.sendEmail({
      to,
      subject: `[Aset SV IPB] Instruksi Atur Ulang Kata Sandi`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded: 8px;">
          <h2 style="color: #022B5F;">Atur Ulang Kata Sandi</h2>
          <p>Halo <strong>${nama}</strong>,</p>
          <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Aset SV IPB Anda. Silakan tekan tombol di bawah ini dalam waktu 1 jam:</p>
          <div style="margin: 24px 0;">
            <a href="${resetUrl}" style="background-color: #022B5F; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Atur Ulang Kata Sandi</a>
          </div>
          <p>Atau gunakan kode token: <strong style="font-family: monospace; background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${token}</strong></p>
          <p style="color: #6b7280; font-size: 13px;">Jika Anda tidak merasa meminta reset password, abaikan email ini. Kata sandi Anda akan tetap aman.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          <p style="font-size: 11px; color: #9ca3af;">Email ini dikirim otomatis oleh Sistem Manajemen Aset Sekolah Vokasi IPB.</p>
        </div>
      `,
    });
  }

  // Reusable email templates
  async sendMutasiApprovalRequest(to: string, assetName: string, mutasiId: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: `[Aset SV IPB] Permintaan Persetujuan Mutasi Aset`,
      html: `
        <h2>Permintaan Persetujuan Mutasi Aset</h2>
        <p>Terdapat permintaan mutasi aset <strong>${assetName}</strong> yang memerlukan persetujuan Anda.</p>
        <p>ID Mutasi: <code>${mutasiId}</code></p>
        <p>Silakan masuk ke sistem untuk meninjau dan memberikan persetujuan.</p>
        <hr/>
        <p><small>Email ini dikirim otomatis oleh Sistem Manajemen Aset SV IPB.</small></p>
      `,
    });
  }

  async sendMaintenanceDueSoon(to: string, assetName: string, jadwal: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: `[Aset SV IPB] Jadwal Pemeliharaan Aset Segera`,
      html: `
        <h2>Pengingat Jadwal Pemeliharaan</h2>
        <p>Pemeliharaan aset <strong>${assetName}</strong> dijadwalkan pada <strong>${jadwal}</strong>.</p>
        <p>Mohon pastikan persiapan yang diperlukan telah dilakukan.</p>
        <hr/>
        <p><small>Email ini dikirim otomatis oleh Sistem Manajemen Aset SV IPB.</small></p>
      `,
    });
  }

  async sendAssetReplacementAlert(to: string, assets: string[]): Promise<void> {
    const list = assets.map((a) => `<li>${a}</li>`).join("");
    await this.sendEmail({
      to,
      subject: `[Aset SV IPB] Aset Mendekati Akhir Masa Manfaat`,
      html: `
        <h2>Peringatan: Aset Mendekati Akhir Masa Manfaat</h2>
        <p>Aset-aset berikut memerlukan perhatian segera:</p>
        <ul>${list}</ul>
        <p>Silakan tinjau dan rencanakan pengadaan atau penghapusan aset tersebut.</p>
        <hr/>
        <p><small>Email ini dikirim otomatis oleh Sistem Manajemen Aset SV IPB.</small></p>
      `,
    });
  }
}
