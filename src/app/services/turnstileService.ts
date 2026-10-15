// ─── Cloudflare Turnstile integration ─────────────────────────────────────────
// Turnstile is a CAPTCHA alternative used on the login page to prevent bots.
// The site key below is a test key — replace with your actual site key in production.
// Server-side verification is handled by the NestJS auth service.

export const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA"; // test key

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: (err: unknown) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string;
    };
  }
}

// Dynamically injects the Cloudflare Turnstile script once
let _scriptLoaded = false;

export function loadTurnstileScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (_scriptLoaded || window.turnstile) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      _scriptLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Render the Turnstile widget into a container element
export function renderTurnstile(
  container: HTMLElement,
  onSuccess: (token: string) => void,
  onError?: (err: unknown) => void,
  theme: "light" | "dark" | "auto" = "auto",
  size: "normal" | "compact" | "flexible" = "flexible",
): string | undefined {
  if (!window.turnstile) {
    console.warn("Turnstile script not yet loaded.");
    return;
  }
  return window.turnstile.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    callback: onSuccess,
    "error-callback": onError,
    theme,
    size,
  });
}

export function resetTurnstile(widgetId?: string): void {
  window.turnstile?.reset(widgetId);
}

export function getTurnstileToken(widgetId?: string): string {
  return window.turnstile?.getResponse(widgetId) ?? "";
}
