"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { IS_STATIC_DEMO } from "@/lib/env";

export function PrintButton() {
  if (IS_STATIC_DEMO) return null;
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("secondary", "md", "print:hidden")}>
      <Printer className="h-4 w-4" /> Print / Save PDF
    </button>
  );
}
