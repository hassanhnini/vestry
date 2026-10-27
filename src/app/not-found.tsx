import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 font-display text-4xl">This page isn&apos;t in the collection</h1>
      <Link href="/home" className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 text-paper">Back home</Link>
    </div>
  );
}
