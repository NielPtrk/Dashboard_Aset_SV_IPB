import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  X,
  RotateCcw,
  Check,
  SwitchCamera,
  Zap,
  ZapOff,
  Image as ImageIcon,
  AlertTriangle,
  Loader2,
  ShieldAlert,
} from "lucide-react";

interface AssetCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photoDataUrl: string) => void;
  title?: string;
  subTitle?: string;
}

// Compress any image (from canvas or File) to max 1280px and JPEG ~80%
export async function compressImage(
  source: CanvasImageSource | File,
  maxDimension = 1280,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processCanvas = (
      srcWidth: number,
      srcHeight: number,
      drawer: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
    ) => {
      let width = srcWidth;
      let height = srcHeight;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(width, 1);
      canvas.height = Math.max(height, 1);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Gagal menginisialisasi canvas 2D"));
        return;
      }
      drawer(ctx, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    if (source instanceof File) {
      const img = document.createElement("img");
      const url = URL.createObjectURL(source);
      img.onload = () => {
        URL.revokeObjectURL(url);
        processCanvas(img.naturalWidth, img.naturalHeight, (ctx, w, h) => {
          ctx.drawImage(img, 0, 0, w, h);
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Gagal membaca file gambar"));
      };
      img.src = url;
    } else {
      const w =
        (source as any).videoWidth || (source as any).naturalWidth || (source as any).width || 1280;
      const h =
        (source as any).videoHeight || (source as any).naturalHeight || (source as any).height || 720;
      processCanvas(w, h, (ctx, targetW, targetH) => {
        ctx.drawImage(source, 0, 0, targetW, targetH);
      });
    }
  });
}

export function AssetCameraModal({
  isOpen,
  onClose,
  onCapture,
  title = "Ambil Foto Fisik Aset",
  subTitle,
}: AssetCameraModalProps) {
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<{
    type: "permission" | "not_secure" | "not_supported" | "not_found" | "generic";
    message: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera tracks cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          // Turn off torch if active
          if ((track as any).applyConstraints && torchOn) {
            (track as any).applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
          }
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    setTorchOn(false);
    setHasTorch(false);
  }, [torchOn]);

  // Start live camera stream
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setCameraError(null);
    stopStream();

    // Check secure context (HTTPS or localhost)
    const isLocal =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "[::1]");
    const isSecure = typeof window !== "undefined" && (window.isSecureContext || isLocal);

    if (!isSecure) {
      setIsLoading(false);
      setCameraError({
        type: "not_secure",
        message:
          "Kamera browser langsung membutuhkan koneksi aman (HTTPS). Gunakan tombol kamera bawaan HP di bawah.",
      });
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsLoading(false);
      setCameraError({
        type: "not_supported",
        message:
          "Browser ini tidak mendukung streaming live kamera. Gunakan tombol kamera bawaan HP di bawah.",
      });
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode === "environment" ? { ideal: "environment" } : "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("muted", "true");
        await videoRef.current.play().catch(() => {});
      }

      // Check if torch/flashlight capability is supported
      const track = stream.getVideoTracks()[0];
      if (track && (track as any).getCapabilities) {
        const caps = (track as any).getCapabilities();
        setHasTorch(Boolean(caps?.torch));
      } else {
        setHasTorch(false);
      }

      setIsLoading(false);
    } catch (err: any) {
      console.warn("Camera init error:", err);
      setIsLoading(false);
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraError({
          type: "permission",
          message:
            "Izin akses kamera ditolak oleh browser. Anda dapat mengizinkannya di pengaturan browser atau gunakan tombol kamera HP di bawah.",
        });
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setCameraError({
          type: "not_found",
          message: "Tidak ada modul kamera yang terdeteksi di perangkat ini.",
        });
      } else {
        setCameraError({
          type: "generic",
          message:
            "Tidak dapat membuka live kamera langsung. Silakan gunakan kamera bawaan HP di bawah.",
        });
      }
    }
  }, [facingMode, stopStream]);

  // Trigger camera start when opened
  useEffect(() => {
    if (isOpen) {
      setCapturedPhoto(null);
      startCamera();
    } else {
      stopStream();
      setCapturedPhoto(null);
      setCameraError(null);
    }
    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, stopStream]);

  // Toggle front / back camera
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Toggle torch / flash
  const handleToggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && (track as any).applyConstraints) {
      const nextState = !torchOn;
      try {
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (e) {
        console.warn("Failed to toggle torch:", e);
      }
    }
  };

  // Shutter action
  const handleCapture = async () => {
    if (!videoRef.current) return;
    try {
      const photo = await compressImage(videoRef.current, 1280, 0.82);
      setCapturedPhoto(photo);
    } catch (e) {
      console.error("Failed to capture image:", e);
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedPhoto(null);
  };

  // Use captured photo
  const handleConfirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      stopStream();
      onClose();
    }
  };

  // Process selected file from native camera or gallery
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const photo = await compressImage(file, 1280, 0.82);
        setCapturedPhoto(photo);
        setCameraError(null);
      } catch (err) {
        console.error("Failed to process file:", err);
      }
    }
    e.target.value = "";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs select-none">
      {/* Hidden fallback native camera input */}
      <input
        ref={fallbackInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInputChange}
      />
      {/* Hidden gallery file input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Main Container: Fullscreen on mobile, rounded card on desktop */}
      <div className="relative w-full h-full sm:h-auto sm:max-w-md md:max-w-lg sm:rounded-3xl sm:border sm:border-slate-800 bg-slate-950 text-white flex flex-col overflow-hidden shadow-2xl">
        {/* Top Header Bar */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="min-w-0 pr-2">
            <h4 className="text-sm font-bold text-white tracking-wide truncate">{title}</h4>
            {subTitle && (
              <p className="text-[11px] text-slate-300 font-medium truncate">{subTitle}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Torch button (if supported & previewing live) */}
            {!capturedPhoto && !cameraError && hasTorch && (
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                  torchOn ? "bg-amber-400 text-slate-900" : "bg-white/15 text-white hover:bg-white/25"
                }`}
                title={torchOn ? "Matikan Lampu Senter" : "Nyalakan Lampu Senter"}
              >
                {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
              </button>
            )}

            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                stopStream();
                onClose();
              }}
              className="p-2.5 bg-white/15 hover:bg-white/25 active:bg-white/35 rounded-full text-white transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Tutup Kamera"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Viewfinder / Preview Center Area */}
        <div className="relative flex-1 sm:h-[480px] bg-black flex items-center justify-center overflow-hidden">
          {capturedPhoto ? (
            /* Review captured photo */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={capturedPhoto}
                alt="Hasil Foto"
                className="w-full h-full object-contain"
              />
              <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-xs text-[11px] font-bold text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/40">
                ✓ Pratinjau Foto Berhasil
              </div>
            </div>
          ) : cameraError ? (
            /* Fallback view when camera is blocked or unsupported */
            <div className="p-6 text-center max-w-sm space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                {cameraError.type === "permission" ? (
                  <ShieldAlert size={28} />
                ) : (
                  <AlertTriangle size={28} />
                )}
              </div>
              <div>
                <h5 className="text-base font-bold text-white">Live Kamera Tidak Tersedia</h5>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {cameraError.message}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => fallbackInputRef.current?.click()}
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <Camera size={18} />
                  <span>Buka Kamera Bawaan HP</span>
                </button>

                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 active:bg-white/25 text-slate-200 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <ImageIcon size={16} />
                  <span>Pilih dari Galeri / File</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Stream */
            <>
              {isLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 gap-3">
                  <Loader2 size={32} className="animate-spin text-blue-400" />
                  <span className="text-xs text-slate-300 font-medium">Menghubungkan kamera...</span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Framing Guidelines */}
              <div className="pointer-events-none absolute inset-8 border border-white/25 rounded-2xl flex items-center justify-center">
                <div className="w-12 h-12 border-t-2 border-l-2 border-white/80 absolute top-0 left-0 rounded-tl-xl" />
                <div className="w-12 h-12 border-t-2 border-r-2 border-white/80 absolute top-0 right-0 rounded-tr-xl" />
                <div className="w-12 h-12 border-b-2 border-l-2 border-white/80 absolute bottom-0 left-0 rounded-bl-xl" />
                <div className="w-12 h-12 border-b-2 border-r-2 border-white/80 absolute bottom-0 right-0 rounded-br-xl" />
              </div>
            </>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-900 shrink-0">
          {capturedPhoto ? (
            /* Review Actions */
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 py-3 px-4 bg-white/15 hover:bg-white/25 active:bg-white/30 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[46px]"
              >
                <RotateCcw size={16} />
                <span>Ulangi Foto</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[46px]"
              >
                <Check size={16} />
                <span>Gunakan Foto</span>
              </button>
            </div>
          ) : !cameraError ? (
            /* Live Shutter Controls */
            <div className="flex items-center justify-between px-2">
              {/* Secondary Option: Pick from Gallery */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center gap-1 text-slate-400 hover:text-white p-2 rounded-xl transition-colors cursor-pointer min-w-[56px] min-h-[46px] justify-center"
                title="Pilih dari Galeri"
              >
                <ImageIcon size={22} />
                <span className="text-[10px] font-medium">Galeri</span>
              </button>

              {/* Shutter Button (large circular center button) */}
              <button
                type="button"
                onClick={handleCapture}
                disabled={isLoading}
                className="relative p-1 rounded-full border-4 border-white/30 hover:border-white/50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                title="Ambil Foto"
              >
                <div className="w-16 h-16 sm:w-18 sm:h-18 bg-white rounded-full flex items-center justify-center text-slate-900 shadow-xl active:bg-slate-200">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-slate-300" />
                </div>
              </button>

              {/* Flip Camera Button */}
              <button
                type="button"
                onClick={handleToggleFacingMode}
                className="flex flex-col items-center gap-1 text-slate-400 hover:text-white p-2 rounded-xl transition-colors cursor-pointer min-w-[56px] min-h-[46px] justify-center"
                title="Ganti Kamera (Depan / Belakang)"
              >
                <SwitchCamera size={22} />
                <span className="text-[10px] font-medium">
                  {facingMode === "environment" ? "Belakang" : "Depan"}
                </span>
              </button>
            </div>
          ) : (
            /* Fallback bottom bar cancel button */
            <button
              type="button"
              onClick={() => {
                stopStream();
                onClose();
              }}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl text-xs font-semibold transition-colors min-h-[44px]"
            >
              Batal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
