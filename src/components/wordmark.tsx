import Link from "next/link";

// The name, underlined with a single pen stroke.
export function Wordmark() {
  return (
    <Link href="/" className="wordmark" aria-label="Cosign home">
      Cosign
      <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
        <path d="M1 5.5 C 22 1.5, 48 7.5, 70 3.5 S 92 2.5, 99 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </Link>
  );
}
