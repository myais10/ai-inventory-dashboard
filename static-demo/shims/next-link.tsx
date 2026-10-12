import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { navigate } from "./router";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname: string }; children?: ReactNode; prefetch?: boolean };

export default function Link({ href, onClick, children, prefetch: _prefetch, ...rest }: Props) {
  const h = typeof href === "string" ? href : href.pathname;
  return (
    <a
      href={h}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(h);
      }}
    >
      {children}
    </a>
  );
}
