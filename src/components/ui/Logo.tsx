// App logo.
//
// Renders the bundled brand image (the high-res master used for the
// apple-touch-icon, same artwork as favicon.ico) as an <img> so it scales
// crisply at any size. Used everywhere the app shows its own brand mark
// (sidebar, boot screen, onboarding, settings, etc.).

// The 1024×1024 RGBA master; the same artwork exists as a 32×32 favicon.ico.
const LOGO_SRC = "/apple-touch-icon.png";

interface LogoProps {
  /** Rendered size in px (square). */
  size?: number;
  className?: string;
}

export function Logo({ size = 24, className }: LogoProps) {
  return (
    <img
      src={LOGO_SRC}
      width={size}
      height={size}
      alt="Scaffold"
      className={className}
      draggable={false}
    />
  );
}
