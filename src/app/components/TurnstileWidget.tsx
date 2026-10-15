import React, { useEffect, useRef, useState } from "react";
import {
  loadTurnstileScript,
  renderTurnstile,
  resetTurnstile,
  TURNSTILE_SITE_KEY,
} from "../services/turnstileService";
import { ShieldCheck, RefreshCw } from "lucide-react";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (err: unknown) => void;
  theme?: "light" | "dark" | "auto";
}

export function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  theme = "light",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    loadTurnstileScript()
      .then(() => {
        if (!isMounted || !containerRef.current) return;
        setLoaded(true);
        // Render widget
        try {
          if (containerRef.current.children.length === 0) {
            const id = renderTurnstile(
              containerRef.current,
              (token) => {
                if (isMounted) onVerify(token);
              },
              (err) => {
                if (isMounted) {
                  console.warn("Turnstile error:", err);
                  onError?.(err);
                }
              },
              theme,
              "flexible",
            );
            widgetIdRef.current = id;
          }
        } catch (e) {
          console.error("Failed to render Turnstile widget", e);
          if (isMounted) setLoadError(true);
        }
      })
      .catch((err) => {
        console.warn("Turnstile script load error (possibly offline):", err);
        if (isMounted) setLoadError(true);
      });

    return () => {
      isMounted = false;
      if (widgetIdRef.current) {
        resetTurnstile(widgetIdRef.current);
      }
    };
  }, [onVerify, onError, theme]);

  return (
    <div className="w-full my-1">
      <div
        ref={containerRef}
        className="w-full flex items-center justify-center min-h-[65px] [&>iframe]:w-full [&>iframe]:max-w-full"
      />
      {loadError && (
        <div className="flex items-center justify-between p-3.5 border border-[#E2E8F0] rounded-xl bg-white text-slate-700">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="dev-bypass-check"
              onChange={(e) => {
                if (e.target.checked) onVerify("turnstile-dev-token-bypass");
              }}
              className="w-5 h-5 rounded border-slate-300 text-[#0A56A4] focus:ring-[#0A56A4] cursor-pointer"
            />
            <div>
              <label htmlFor="dev-bypass-check" className="text-xs font-medium text-slate-800 cursor-pointer">
                Saya bukan robot
              </label>
              <div className="text-[10px] text-slate-400">Verifikasi keamanan (Dev Mode)</div>
            </div>
          </div>
          <ShieldCheck size={20} className="text-[#0A56A4] shrink-0" />
        </div>
      )}
    </div>
  );
}
