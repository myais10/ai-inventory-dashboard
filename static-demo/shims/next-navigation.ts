import { useSyncExternalStore } from "react";
import { getLoc, navigate, refresh, subscribe, NotFoundSignal, RedirectSignal } from "./router";

export function usePathname() {
  return useSyncExternalStore(subscribe, () => getLoc().path, () => "/");
}
export function useRouter() {
  return { push: navigate, replace: navigate, refresh, back: () => {}, forward: () => {}, prefetch: () => {} };
}
export function useSearchParams() {
  const q = useSyncExternalStore(subscribe, () => getLoc().query, () => ({}));
  return new URLSearchParams(q);
}
export function redirect(to: string): never {
  throw new RedirectSignal(to);
}
export function notFound(): never {
  throw new NotFoundSignal();
}
