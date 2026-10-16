import NextLink from "next/link";
import type { ComponentProps } from "react";

/**
 * App links default to no prefetch. Every page here is dynamic and per-user, so prefetching runs the
 * authenticated layout server-side; a 50-row table would trigger 50 renders on every visit and queue
 * the user's real click behind them. The sidebar keeps Next's default prefetch for its few links.
 */
export default function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={prefetch} {...props} />;
}
