import Link from "next/link";
import { Logo } from "@/components/app/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
      <Logo />
      <div className="mt-10 text-sm font-semibold text-brand-700">404</div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-sm text-muted">The lead, company or deal may have been removed, or the link is incorrect.</p>
      <Link href="/" className="mt-6 inline-flex h-9 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-900">
        Back to Phoonica
      </Link>
    </div>
  );
}
