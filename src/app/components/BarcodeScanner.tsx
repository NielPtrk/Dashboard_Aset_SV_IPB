import React, { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, QrCode, Download, X, RefreshCw, ZoomIn } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BarcodeScanResult {
  value: string;
  format: string;
  timestamp: Date;
}

interface BarcodeScannerProps {
  onScan: (result: BarcodeScanResult) => void;
  onClose?: () => void;
  active?: boolean;
}

// ── Barcode Scanner (camera) ──────────────────────────────────────────────────
export function BarcodeScanner({ onScan, onClose, active = true }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef   = useRef<number>(0);
  const [error, setError]       = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      if (!("BarcodeDetector" in window)) {
        setError("Browser tidak mendukung BarcodeDetector. Gunakan input manual di bawah.");
        return;
      }
      const formats = await (window as unknown as { BarcodeDetector: { getSupportedFormats(): Promise<string[]> } }).BarcodeDetector.getSupportedFormats();
      const wanted = ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "data_matrix"].filter(f => formats.includes(f));
      detectorRef.current = new (window as unknown as { BarcodeDetector: new (opts: unknown) => BarcodeDetector }).BarcodeDetector({ formats: wanted.length ? wanted : ["qr_code", "code_128"] });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setError("Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser.");
      } else {
        setError("Tidak dapat mengakses kamera. Pastikan perangkat memiliki kamera.");
      }
    }
  }, []);

  useEffect(() => {
    if (!active) { stopCamera(); return; }
    startCamera();
    return () => stopCamera();
  }, [active, startCamera, stopCamera]);

  useEffect(() => {
    if (!scanning || !detectorRef.current) return;
    let cooldown = false;
    const detect = async () => {
      if (!videoRef.current || !detectorRef.current || cooldown) {
        animRef.current = requestAnimationFrame(detect);
        return;
      }
      if (videoRef.current.readyState < 2) {
        animRef.current = requestAnimationFrame(detect);
        return;
      }
      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0) {
          const bc = barcodes[0];
          if (bc.rawValue !== lastScan) {
            setLastScan(bc.rawValue);
            onScan({ value: bc.rawValue, format: bc.format, timestamp: new Date() });
            cooldown = true;
            setTimeout(() => { cooldown = false; }, 2000);
          }
        }
      } catch {
        // detection error — keep looping
      }
      animRef.current = requestAnimationFrame(detect);
    };
    animRef.current = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(animRef.current);
  }, [scanning, onScan, lastScan]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <QrCode size={14} className="text-blue-600" />
        <span className="text-sm font-semibold text-gray-700">Barcode / QR Scanner</span>
        <div className={`ml-auto flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${scanning ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${scanning ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
          {scanning ? "Aktif" : "Nonaktif"}
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="relative bg-gray-950 aspect-video flex items-center justify-center overflow-hidden">
        <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover ${scanning ? "opacity-100" : "opacity-0"}`} />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan overlay */}
        {scanning && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-48 h-32">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-green-400 rounded-tl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-green-400 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-green-400 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-green-400 rounded-br" />
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-green-400 opacity-80 animate-pulse" />
            </div>
          </div>
        )}

        {!scanning && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500">
            <Camera size={28} className="opacity-40" />
            <p className="text-xs opacity-50">Memulai kamera…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <CameraOff size={24} className="text-red-400" />
            <p className="text-xs text-gray-400 max-w-[200px]">{error}</p>
            <button onClick={startCamera} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50">
              <RefreshCw size={11} /> Coba Lagi
            </button>
          </div>
        )}
      </div>

      {lastScan && (
        <div className="px-4 py-2 bg-green-50 border-t border-green-100 flex items-center gap-2">
          <ZoomIn size={12} className="text-green-600 shrink-0" />
          <span className="text-xs text-green-700 font-mono truncate">{lastScan}</span>
        </div>
      )}
    </div>
  );
}

// ── Barcode Generator ─────────────────────────────────────────────────────────
interface BarcodeGeneratorProps {
  value: string;
  label?: string;
  width?: number;
  height?: number;
}

export function BarcodeGenerator({ value, label, width = 280, height = 80 }: BarcodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height + (label ? 20 : 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Code128-style barcode rendering
    const encoded = encodeCode128(value);
    const barWidth = (width - 20) / encoded.length;
    ctx.fillStyle = "#000000";
    for (let i = 0; i < encoded.length; i++) {
      if (encoded[i] === "1") {
        ctx.fillRect(10 + i * barWidth, 5, barWidth, height - 10);
      }
    }

    if (label) {
      ctx.fillStyle = "#000000";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.fillText(label.slice(0, 30), width / 2, height + 14);
    }
  }, [value, label, width, height]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `barcode-${value}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const handlePrint = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh">
      <div style="text-align:center">
        <img src="${dataUrl}" style="max-width:100%" />
        <p style="font-family:monospace;margin-top:8px">${value}</p>
      </div>
      <script>window.onload=()=>{ window.print(); window.close(); }<\/script>
    </body></html>`);
    win.document.close();
  };

  if (!value) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="border border-gray-200 rounded-lg p-3 bg-white">
        <canvas ref={canvasRef} className="block" style={{ width, height: height + (label ? 20 : 0) }} />
      </div>
      <div className="flex gap-2">
        <button onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          <Download size={11} /> Unduh PNG
        </button>
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50">
          🖨 Cetak
        </button>
      </div>
    </div>
  );
}

// ── Minimal Code128 encoder ───────────────────────────────────────────────────
// Returns a binary string ("0"/"1") for Code128B encoding
function encodeCode128(text: string): string {
  const CODE128_B: number[][] = [
    [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
    [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
    [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
    [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
    [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
    [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
    [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
    [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
    [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
    [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
    [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
    [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
    [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
    [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
    [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
    [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
    [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],
    [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
    [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],
    [1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
    [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4],
    [2,1,1,2,3,2],[2,3,3,1,1,1],[1,1,2,1,2,3],
  ];
  const START_B = 104;
  const STOP = [2,3,3,1,1,1,2];

  const bits = (pattern: number[], isBlack = true) => {
    let s = "";
    for (let i = 0; i < pattern.length; i++) {
      s += (isBlack ? "1" : "0").repeat(pattern[i]);
      isBlack = !isBlack;
    }
    return s;
  };

  let result = bits(CODE128_B[START_B]);
  let checksum = START_B;
  for (let i = 0; i < text.length; i++) {
    const idx = text.charCodeAt(i) - 32;
    if (idx >= 0 && idx < CODE128_B.length) {
      result += bits(CODE128_B[idx], i % 2 === 0);
      checksum += (i + 1) * idx;
    }
  }
  const checkIdx = checksum % 103;
  result += bits(CODE128_B[checkIdx], text.length % 2 === 0);
  result += bits(STOP, (text.length + 1) % 2 === 0);
  result += "11"; // termination bar
  return result;
}

// ── Barcode Generate Modal ────────────────────────────────────────────────────
interface BarcodeModalProps {
  assetCode: string;
  assetName: string;
  onClose: () => void;
}

export function BarcodeModal({ assetCode, assetName, onClose }: BarcodeModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <QrCode size={16} className="text-blue-600" />
            <span className="text-sm font-semibold text-gray-800">Generate Barcode Aset</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">{assetName}</p>
            <p className="text-sm font-mono font-bold text-gray-800">{assetCode}</p>
          </div>
          <BarcodeGenerator value={assetCode} label={`${assetCode} | ${assetName.slice(0, 20)}`} width={280} height={80} />
          <p className="text-[10px] text-gray-400 text-center">
            Barcode Code128 — tempel pada aset sebagai identifikasi fisik
          </p>
        </div>
      </div>
    </div>
  );
}
