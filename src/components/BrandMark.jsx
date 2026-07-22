/**
 * Digital Meeting Controller — brand mark.
 * Signature: a live waveform resolving into a checkmark, representing
 * conversation being turned into decisions. Used wherever the app logo
 * previously referenced /logo.png.
 */
export default function BrandMark({ className = 'w-9 h-9', rounded = 'rounded-xl' }) {
  return (
    <div
      className={`${className} ${rounded} flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg shadow-indigo-950/40`}
      style={{ background: 'linear-gradient(135deg, #4338CA 0%, #4F46E5 45%, #0EA5B7 100%)' }}
    >
      <svg viewBox="0 0 40 40" className="w-[68%] h-[68%]" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M3 21 H10 L13 12 L17 29 L21 17 L24 24 L27 21 H37"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="34.5" cy="21" r="2.6" fill="#5EEAD4" />
      </svg>
    </div>
  );
}
