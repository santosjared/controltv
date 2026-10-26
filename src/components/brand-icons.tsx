import type { SVGProps } from "react";

type BrandIconProps = SVGProps<SVGSVGElement>;

export function FacebookIcon(props: BrandIconProps) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle cx="12" cy="12" r="10" fill="currentColor" /><path className="fill-[#08783f] transition-colors group-hover:fill-(--brand-gold)" d="M13.4 19v-6h2l.3-2.4h-2.3V9.1c0-.7.2-1.2 1.2-1.2h1.2V5.8c-.5-.1-1.1-.2-1.8-.2-1.8 0-3.1 1.1-3.1 3.2v1.8H9v2.4h1.9v6h2.5Z" /></svg>;
}

export function YouTubeIcon(props: BrandIconProps) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}><path fill="currentColor" d="M21.4 6.2a2.8 2.8 0 0 0-2-2C17.7 3.7 12 3.7 12 3.7s-5.7 0-7.4.5a2.8 2.8 0 0 0-2 2C2.1 8 2.1 12 2.1 12s0 4 .5 5.8a2.8 2.8 0 0 0 2 2c1.7.5 7.4.5 7.4.5s5.7 0 7.4-.5a2.8 2.8 0 0 0 2-2c.5-1.8.5-5.8.5-5.8s0-4-.5-5.8Z" /><path className="fill-[#08783f] transition-colors group-hover:fill-(--brand-gold)" d="m10 15.6 5.2-3.6L10 8.4v7.2Z" /></svg>;
}

export function TikTokIcon(props: BrandIconProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M15.3 3c.3 1.8 1.3 3.1 3 4 .8.4 1.7.6 2.7.6v3.2a8.7 8.7 0 0 1-5.7-2v7.4a5.8 5.8 0 1 1-5-5.7v3.3a2.6 2.6 0 1 0 1.8 2.5V3h3.2Z" /></svg>;
}
