"use client";

import { IS_STATIC_DEMO } from "@/lib/env";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plug,
  Sparkles,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Field, Input, Select } from "@/components/app/form";
import { buttonClass } from "@/components/ui";
import { cn, fmtNumber } from "@/lib/utils";
import {
  FIELDS,
  KIND_LABEL,
  REQUIRED,
  autoMap,
  detectKind,
  validateImport,
  type FieldKey,
  type ImportFile,
  type ValidationReport,
} from "@/lib/import";
import { chooseSampleDataAction, commitImportAction, saveCompanyDetailsAction, type ImportResult } from "./actions";

const STEPS = ["Welcome", "Company", "Connect data", "Map columns", "Validate", "Analyse"];
const MAX_FILE_BYTES = 20 * 1024 * 1024;

interface Props {
  firstName: string;
  companyName: string;
  industry: string;
  alreadyOnboarded: boolean;
  trialDays: number;
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto">
      {STEPS.map((s, i) => (
        <li key={s} className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
              i < step ? "bg-brand-600 text-white" : i === step ? "bg-brand-50 text-brand-700 ring-2 ring-brand-500" : "bg-slate-100 text-faint",
            )}
          >
            {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={cn("hidden text-xs font-medium xl:inline", i <= step ? "text-ink" : "text-faint")}>{s}</span>
          {i < STEPS.length - 1 && <span className={cn("h-px w-5 lg:w-8", i < step ? "bg-brand-500" : "bg-line")} />}
        </li>
      ))}
    </ol>
  );
}

export function OnboardingFlow({ firstName, companyName, industry, alreadyOnboarded, trialDays }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState({ name: companyName, industry: industry || "Industrial MRO Distribution", warehouses: "1", erp: "", currency: "USD" });
  const [companyError, setCompanyError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState(0);
  const [result, setResult] = useState<ImportResult>();
  const [sampleLoading, setSampleLoading] = useState(false);

  const report: ValidationReport | null = useMemo(() => (files.length ? validateImport(files) : null), [files]);

  const saveCompany = async () => {
    setSaving(true);
    setCompanyError(undefined);
    const res = await saveCompanyDetailsAction({ ...company, warehouses: Number(company.warehouses) || 1, currency: company.currency as "USD" });
    setSaving(false);
    if (!res.ok) return setCompanyError(res.error);
    setStep(2);
  };

  const useSample = async () => {
    setSampleLoading(true);
    await chooseSampleDataAction();
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
          <div className="shrink-0">
            <Logo />
          </div>
          <Stepper step={step} />
          {alreadyOnboarded ? (
            <Link href="/dashboard" className="text-xs font-medium text-muted hover:text-ink">
              Exit
            </Link>
          ) : (
            <span className="hidden whitespace-nowrap text-xs text-muted lg:inline">{trialDays} days left in trial</span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {step === 0 && (
          <div className="mx-auto max-w-2xl text-center animate-fade-in">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <Sparkles className="h-6 w-6" />
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink">Welcome{firstName ? `, ${firstName}` : ""}. Let&apos;s set up {companyName}.</h1>
            <p className="mt-3 text-[15px] text-muted">
              In about 5 minutes you&apos;ll go from a spreadsheet export to a prioritised list of what to reorder, what&apos;s at risk, and where cash is tied up.
            </p>
            <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
              {[
                ["1", "Tell us about your business", "Company, warehouses and ERP"],
                ["2", "Import your data", "Inventory, sales, POs and enquiries via CSV"],
                ["3", "Get recommendations", "Deterministic, explainable calculations"],
              ].map(([n, t, d]) => (
                <div key={n} className="rounded-xl border border-line bg-white p-4">
                  <div className="text-xs font-semibold text-brand-600">Step {n}</div>
                  <div className="mt-1 text-sm font-semibold text-ink">{t}</div>
                  <div className="mt-0.5 text-xs text-muted">{d}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col items-center gap-3">
              <button type="button" onClick={() => setStep(1)} className={buttonClass("primary", "lg")}>
                Get started <ArrowRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={useSample} disabled={sampleLoading} className="text-sm font-medium text-muted hover:text-ink">
                {sampleLoading ? "Loading sample workspace…" : "Or explore with sample data first →"}
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mx-auto max-w-xl animate-fade-in">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Company details</h1>
            <p className="mt-1 text-sm text-muted">This helps us tune defaults like service levels and lead-time assumptions.</p>
            <div className="mt-8 space-y-4 rounded-xl border border-line bg-white p-6">
              {companyError && <div className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{companyError}</div>}
              <Field label="Company name" htmlFor="cname">
                <Input id="cname" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Industry" htmlFor="industry">
                  <Select id="industry" value={company.industry} onChange={(e) => setCompany({ ...company, industry: e.target.value })}>
                    {["Industrial MRO Distribution", "Bearings & Power Transmission", "Fluid Power & Hydraulics", "Electrical Distribution", "HVAC/R Distribution", "Fasteners & Fixings", "Safety & PPE", "Automotive Parts", "Other"].map((i) => (
                      <option key={i}>{i}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Number of warehouses" htmlFor="wh">
                  <Input id="wh" type="number" min={1} value={company.warehouses} onChange={(e) => setCompany({ ...company, warehouses: e.target.value })} />
                </Field>
                <Field label="ERP / inventory system" htmlFor="erp">
                  <Select id="erp" value={company.erp} onChange={(e) => setCompany({ ...company, erp: e.target.value })}>
                    <option value="">Select…</option>
                    {["Epicor Prophet 21", "Infor SX.e / CSD", "NetSuite", "Microsoft Dynamics 365 BC", "SAP Business One", "Acumatica", "Sage 100", "QuickBooks", "Spreadsheets", "Other"].map((i) => (
                      <option key={i}>{i}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Currency" htmlFor="cur">
                  <Select id="cur" value={company.currency} onChange={(e) => setCompany({ ...company, currency: e.target.value })}>
                    {["USD", "CAD", "EUR", "GBP", "AUD"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
            <div className="mt-6 flex justify-between">
              <button type="button" onClick={() => setStep(0)} className={buttonClass("ghost")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button type="button" onClick={saveCompany} disabled={saving || company.name.trim().length < 2} className={buttonClass("primary")}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <ConnectData
            files={files}
            setFiles={(f) => {
              setFiles(f);
              setActiveFile(0);
            }}
            errors={fileErrors}
            setErrors={setFileErrors}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            onSample={useSample}
            sampleLoading={sampleLoading}
          />
        )}

        {step === 3 && (
          <MapColumns
            files={files}
            setFiles={setFiles}
            active={activeFile}
            setActive={setActiveFile}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}

        {step === 4 && report && <Validate report={report} onBack={() => setStep(3)} onNext={() => setStep(5)} />}

        {step === 5 && <Analyse files={files} result={result} setResult={setResult} onBack={() => setStep(4)} />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- Step 3

function ConnectData({
  files,
  setFiles,
  errors,
  setErrors,
  onBack,
  onNext,
  onSample,
  sampleLoading,
}: {
  files: ImportFile[];
  setFiles: (f: ImportFile[]) => void;
  errors: string[];
  setErrors: (e: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  onSample: () => void;
  sampleLoading: boolean;
}) {
  const [method, setMethod] = useState<"csv" | "excel" | "erp">("csv");
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (list: FileList | File[]) => {
      const arr = Array.from(list);
      const errs: string[] = [];
      const parsed: ImportFile[] = [];
      setParsing(true);
      for (const file of arr) {
        if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
          errs.push(`${file.name}: only .csv files are supported. Export your spreadsheet as CSV.`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          errs.push(`${file.name}: file is larger than 20 MB.`);
          continue;
        }
        const text = await file.text();
        const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
        const headers = (res.meta.fields ?? []).filter(Boolean);
        if (!headers.length || !res.data.length) {
          errs.push(`${file.name}: no rows found. Make sure the first row contains column headers.`);
          continue;
        }
        parsed.push({ fileName: file.name, headers, rows: res.data, mapping: autoMap(headers) });
      }
      setParsing(false);
      setErrors(errs);
      const byName = new Map(files.map((f) => [f.fileName, f]));
      for (const p of parsed) byName.set(p.fileName, p);
      setFiles([...byName.values()].slice(0, 10));
    },
    [files, setFiles, setErrors],
  );

  const loadSamples = async () => {
    setParsing(true);
    const names = ["inventory.csv", "sales.csv", "purchase_orders.csv", "enquiries.csv"];
    const blobs = await Promise.all(names.map(async (n) => new File([await (await fetch(`/api/samples/${n}`)).text()], `northstar-${n}`, { type: "text/csv" })));
    await handleFiles(blobs);
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Connect your data</h1>
      <p className="mt-1 text-sm text-muted">Start with an inventory export. Add sales history, open purchase orders and customer enquiries for the full picture.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {(
          [
            { id: "csv", icon: FileText, title: "Upload CSV", desc: "Exports from any ERP or spreadsheet", badge: "Recommended" },
            { id: "excel", icon: FileSpreadsheet, title: "Upload Excel", desc: ".xlsx workbooks", badge: "Coming soon" },
            { id: "erp", icon: Plug, title: "Connect ERP", desc: "Prophet 21, NetSuite, SAP B1 and more", badge: "Coming soon" },
          ] as const
        ).map((o) => (
          <button
            type="button"
            key={o.id}
            onClick={() => setMethod(o.id)}
            className={cn("rounded-xl border bg-white p-4 text-left transition", method === o.id ? "border-brand-500 ring-2 ring-brand-100" : "border-line hover:border-line-strong")}
          >
            <div className="flex items-center justify-between">
              <o.icon className={cn("h-5 w-5", method === o.id ? "text-brand-600" : "text-muted")} />
              <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-medium", o.id === "csv" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-muted")}>{o.badge}</span>
            </div>
            <div className="mt-3 text-sm font-semibold text-ink">{o.title}</div>
            <div className="text-xs text-muted">{o.desc}</div>
          </button>
        ))}
      </div>

      {method === "csv" && (
        <div className="mt-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white px-6 py-12 text-center transition",
              dragging ? "border-brand-500 bg-brand-50/50" : "border-line-strong hover:border-brand-300",
            )}
          >
            {parsing ? <Loader2 className="h-8 w-8 animate-spin text-brand-600" /> : <UploadCloud className="h-8 w-8 text-brand-600" />}
            <div className="mt-3 text-sm font-semibold text-ink">Drop CSV files here or click to browse</div>
            <div className="mt-1 text-xs text-muted">Up to 10 files · 20 MB each · first row must be column headers</div>
            <input ref={inputRef} type="file" accept=".csv,text/csv" multiple hidden onChange={(e) => e.target.files && handleFiles(e.target.files)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
            <span>Don&apos;t have an export handy?</span>
            <button type="button" onClick={loadSamples} className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
              <Copy className="h-3 w-3" /> Load Northstar sample files
            </button>
            {!IS_STATIC_DEMO && ["inventory", "sales", "purchase_orders", "enquiries"].map((n) => (
              <a key={n} href={`/api/samples/${n}.csv`} className="inline-flex items-center gap-1 hover:text-ink">
                <Download className="h-3 w-3" /> {n}.csv
              </a>
            ))}
          </div>
          {errors.map((e) => (
            <div key={e} className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" /> {e}
            </div>
          ))}
          {files.length > 0 && (
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
              {files.map((f) => (
                <li key={f.fileName} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="h-4 w-4 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{f.fileName}</div>
                    <div className="text-xs text-muted">
                      {fmtNumber(f.rows.length)} rows · {f.headers.length} columns · detected as <span className="font-medium text-ink-2">{KIND_LABEL[detectKind(f.mapping)]}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setFiles(files.filter((x) => x !== f))} className="rounded p-1.5 text-muted hover:bg-slate-100 hover:text-red-600" aria-label={`Remove ${f.fileName}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {method === "excel" && (
        <div className="mt-6 rounded-xl border border-line bg-white p-6 text-sm text-ink-2">
          <div className="font-semibold text-ink">Excel import is coming soon</div>
          <p className="mt-1 text-muted">For now, open your workbook and choose <b>File → Save As → CSV (Comma delimited)</b> for each sheet, then upload the CSV files.</p>
          <button type="button" onClick={() => setMethod("csv")} className={buttonClass("secondary", "sm", "mt-4")}>
            Upload CSV instead
          </button>
        </div>
      )}

      {method === "erp" && (
        <div className="mt-6 rounded-xl border border-line bg-white p-6">
          <div className="text-sm font-semibold text-ink">Direct ERP connections</div>
          <p className="mt-1 text-sm text-muted">Nightly sync of items, stock, sales and POs. We&apos;re onboarding design partners now.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {["Epicor Prophet 21", "NetSuite", "SAP Business One", "Infor CSD", "Dynamics 365 BC", "Acumatica"].map((e) => (
              <div key={e} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] text-ink-2">
                <Database className="h-3.5 w-3.5 text-muted" /> {e}
                <span className="ml-auto text-[10.5px] text-faint">Soon</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className={buttonClass("ghost")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onSample} disabled={sampleLoading} className="text-sm font-medium text-muted hover:text-ink">
            {sampleLoading ? "Loading…" : "Skip — use sample data"}
          </button>
          <button type="button" disabled={!files.length} onClick={onNext} className={buttonClass("primary")}>
            Continue to mapping <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Step 4

function MapColumns({
  files,
  setFiles,
  active,
  setActive,
  onBack,
  onNext,
}: {
  files: ImportFile[];
  setFiles: (f: ImportFile[]) => void;
  active: number;
  setActive: (i: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const f = files[active];
  const kind = detectKind(f.mapping);
  const required = new Set<FieldKey>(REQUIRED[kind]);
  const setMap = (key: FieldKey, header: string) => {
    const mapping = { ...f.mapping };
    if (header) mapping[key] = header;
    else delete mapping[key];
    setFiles(files.map((x, i) => (i === active ? { ...x, mapping } : x)));
  };
  const usedHeaders = new Set(Object.values(f.mapping));
  const groups = [...new Set(FIELDS.map((x) => x.group))];
  const allRequiredMapped = files.every((file) => REQUIRED[detectKind(file.mapping)].every((k) => file.mapping[k]));

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Map your columns</h1>
      <p className="mt-1 text-sm text-muted">We matched what we could automatically. Check each field and pick the column from your file that contains it.</p>

      {files.length > 1 && (
        <div className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
          {files.map((file, i) => {
            const ok = REQUIRED[detectKind(file.mapping)].every((k) => file.mapping[k]);
            return (
              <button
                type="button"
                key={file.fileName}
                onClick={() => setActive(i)}
                className={cn("-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", i === active ? "border-brand-600 text-ink" : "border-transparent text-muted hover:text-ink")}
              >
                {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                {file.fileName}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="text-sm font-semibold text-ink">Fields</div>
            <div className="text-xs text-muted">
              Detected: <span className="font-medium text-ink-2">{KIND_LABEL[kind]}</span>
            </div>
          </div>
          <div className="divide-y divide-line/70">
            {groups.map((g) => (
              <div key={g} className="px-5 py-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">{g}</div>
                <div className="space-y-2">
                  {FIELDS.filter((x) => x.group === g).map((fd) => (
                    <div key={fd.key} className="flex items-center gap-3">
                      <div className="w-44 shrink-0 text-[13px] text-ink">
                        {fd.label}
                        {required.has(fd.key) && <span className="ml-1 text-red-500">*</span>}
                      </div>
                      <select
                        value={f.mapping[fd.key] ?? ""}
                        onChange={(e) => setMap(fd.key, e.target.value)}
                        aria-label={`Column for ${fd.label}`}
                        className={cn(
                          "h-8 min-w-0 flex-1 rounded-md border bg-white px-2 text-[13px] outline-none focus:border-brand-500",
                          f.mapping[fd.key] ? "border-emerald-300 text-ink" : required.has(fd.key) ? "border-amber-300 text-faint" : "border-line-strong text-faint",
                        )}
                      >
                        <option value="">— Not mapped —</option>
                        {f.headers.map((h) => (
                          <option key={h} value={h} disabled={usedHeaders.has(h) && f.mapping[fd.key] !== h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      <span className="w-4">{f.mapping[fd.key] ? <Check className="h-4 w-4 text-emerald-500" /> : null}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-white">
            <div className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">Preview · {f.fileName}</div>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr>
                    {f.headers.map((h) => {
                      const mappedTo = FIELDS.find((x) => f.mapping[x.key] === h);
                      return (
                        <th key={h} className="whitespace-nowrap border-b border-line bg-subtle px-3 py-2 font-medium text-muted">
                          <div className="text-ink-2">{h}</div>
                          <div className={cn("text-[10.5px]", mappedTo ? "text-emerald-600" : "text-faint")}>{mappedTo ? `→ ${mappedTo.label}` : "ignored"}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {f.rows.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      {f.headers.map((h) => (
                        <td key={h} className="max-w-[180px] truncate whitespace-nowrap border-b border-line/70 px-3 py-1.5 text-ink-2">
                          {r[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded-xl border border-line bg-white p-5 text-[13px] text-muted">
            <div className="font-semibold text-ink">Required fields by file type</div>
            <ul className="mt-2 space-y-1">
              {(Object.keys(REQUIRED) as (keyof typeof REQUIRED)[]).map((k) => (
                <li key={k}>
                  <span className={cn("font-medium", k === kind ? "text-brand-700" : "text-ink-2")}>{KIND_LABEL[k]}:</span> {REQUIRED[k].map((x) => FIELDS.find((fd) => fd.key === x)!.label).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between">
        <button type="button" onClick={onBack} className={buttonClass("ghost")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button type="button" onClick={onNext} className={buttonClass("primary")}>
          {allRequiredMapped ? "Validate data" : "Validate anyway"} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Step 5

function Validate({ report, onBack, onNext }: { report: ValidationReport; onBack: () => void; onNext: () => void }) {
  const canImport = report.byKind.inventory > 0;
  const tiles = [
    { label: "Rows imported", value: report.validRows, tone: "text-emerald-600", icon: CheckCircle2 },
    { label: "Errors", value: report.errorRows, tone: report.errorRows ? "text-red-600" : "text-ink", icon: XCircle },
    { label: "Missing fields", value: report.missingFields.reduce((a, m) => a + m.fields.length, 0) + report.missingValues, tone: "text-amber-600", icon: AlertCircle },
    { label: "Duplicates", value: report.duplicates, tone: "text-amber-600", icon: Copy },
    { label: "Invalid values", value: report.invalidValues, tone: "text-red-600", icon: AlertCircle },
  ];
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Validate your data</h1>
      <p className="mt-1 text-sm text-muted">
        We checked {fmtNumber(report.totalRows)} rows across {report.files.length} file{report.files.length > 1 ? "s" : ""}. Rows with errors are skipped — you can fix them and re-import any time.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </div>
            <div className={cn("tabular mt-1 text-2xl font-semibold", t.tone)}>{fmtNumber(t.value)}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-xl border border-line bg-white">
          <div className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">Files</div>
          <ul className="divide-y divide-line/70">
            {report.files.map((f) => {
              const missing = report.missingFields.find((m) => m.file === f.fileName);
              return (
                <li key={f.fileName} className="px-5 py-3 text-[13px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium text-ink">{f.fileName}</span>
                    <span className="tabular shrink-0 text-muted">
                      {fmtNumber(f.valid)} / {fmtNumber(f.rows)} valid
                    </span>
                  </div>
                  <div className="text-xs text-muted">{KIND_LABEL[f.kind]}</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(f.valid / (f.rows || 1)) * 100}%` }} />
                  </div>
                  {missing && <div className="mt-1.5 text-xs text-red-600">Missing required columns: {missing.fields.join(", ")} — file will be skipped.</div>}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="text-sm font-semibold text-ink">Issues</span>
            <span className="text-xs text-muted">{report.issues.length ? `Showing ${Math.min(report.issues.length, 50)}` : ""}</span>
          </div>
          {report.issues.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <div className="mt-2 text-sm font-medium text-ink">No issues found</div>
            </div>
          ) : (
            <div className="scroll-thin max-h-[340px] overflow-y-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-muted">
                    <th className="sticky top-0 bg-subtle px-4 py-2 font-medium">File</th>
                    <th className="sticky top-0 bg-subtle px-2 py-2 font-medium">Row</th>
                    <th className="sticky top-0 bg-subtle px-2 py-2 font-medium">Field</th>
                    <th className="sticky top-0 bg-subtle px-4 py-2 font-medium">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {report.issues.slice(0, 50).map((i, idx) => (
                    <tr key={idx} className="border-t border-line/70">
                      <td className="max-w-[140px] truncate px-4 py-2 text-muted">{i.file}</td>
                      <td className="tabular px-2 py-2 text-ink-2">{i.row}</td>
                      <td className="px-2 py-2 text-ink-2">{i.field ?? "—"}</td>
                      <td className={cn("px-4 py-2", i.kind === "duplicate" ? "text-amber-700" : "text-red-600")}>{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {!canImport && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-800 ring-1 ring-amber-200">
          <AlertCircle className="h-4 w-4" /> An inventory file with at least SKU and Quantity is required before we can analyse your data.
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button type="button" onClick={onBack} className={buttonClass("ghost")}>
          <ArrowLeft className="h-4 w-4" /> Back to mapping
        </button>
        <button type="button" disabled={!canImport} onClick={onNext} className={buttonClass("primary")}>
          Import {fmtNumber(report.validRows)} rows & analyse <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Step 6

const ANALYSIS_STEPS = ["Inventory imported", "Sales history imported", "Suppliers identified", "Purchase orders imported", "Demand analysis completed"];

function Analyse({ files, result, setResult, onBack }: { files: ImportFile[]; result?: ImportResult; setResult: (r: ImportResult) => void; onBack: () => void }) {
  const router = useRouter();
  const [done, setDone] = useState(result?.ok ? ANALYSIS_STEPS.length : 0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || result?.ok) return;
    started.current = true;
    let tick = 0;
    const timer = setInterval(() => {
      tick++;
      setDone((d) => Math.min(d + 1, ANALYSIS_STEPS.length - 1, tick));
    }, 650);
    commitImportAction(files).then((res) => {
      setResult(res);
      const finish = setInterval(() => {
        setDone((d) => {
          if (d >= ANALYSIS_STEPS.length) {
            clearInterval(finish);
            return d;
          }
          return res.ok ? d + 1 : d;
        });
      }, 450);
      clearInterval(timer);
      if (!res.ok) clearInterval(finish);
    });
    return () => clearInterval(timer);
  }, [files, result, setResult]);

  const complete = result?.ok && done >= ANALYSIS_STEPS.length;
  const s = result?.summary;

  return (
    <div className="mx-auto max-w-xl animate-fade-in">
      <div className="rounded-2xl border border-line bg-white p-8">
        {complete ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        ) : result && !result.ok ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <XCircle className="h-6 w-6" />
          </div>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">
          {complete ? "Your inventory intelligence is ready." : result && !result.ok ? "Import failed" : "Analysing your data…"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {complete
            ? "We've calculated velocity, lead times, safety stock, reorder points and stockout dates for every SKU."
            : result && !result.ok
              ? result.error
              : "Running the deterministic inventory engine over your history."}
        </p>
        <ul className="mt-6 space-y-3">
          {ANALYSIS_STEPS.map((label, i) => {
            const state = i < done ? "done" : i === done && !(result && !result.ok) ? "active" : "pending";
            return (
              <li key={label} className="flex items-center gap-3 text-[14px]">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full",
                    state === "done" ? "bg-emerald-500 text-white" : state === "active" ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-faint",
                  )}
                >
                  {state === "done" ? <Check className="h-3.5 w-3.5" /> : state === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <span className={state === "pending" ? "text-faint" : "text-ink"}>{label}</span>
              </li>
            );
          })}
        </ul>
        {complete && s && (
          <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl bg-subtle p-4 text-center">
            {[
              ["Products", s.products],
              ["Suppliers", s.suppliers],
              ["Warehouses", s.warehouses],
              ["Sales weeks", s.salesWeeks],
              ["Open POs", s.purchaseOrders],
              ["Enquiries", s.enquiries],
            ].map(([l, v]) => (
              <div key={l as string}>
                <div className="tabular text-lg font-semibold text-ink">{fmtNumber(v as number)}</div>
                <div className="text-[11px] text-muted">{l}</div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-8">
          {complete ? (
            <button
              type="button"
              onClick={() => {
                router.push("/dashboard");
                router.refresh();
              }}
              className={buttonClass("primary", "lg", "w-full")}
            >
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </button>
          ) : result && !result.ok ? (
            <button type="button" onClick={onBack} className={buttonClass("secondary", "lg", "w-full")}>
              <ArrowLeft className="h-4 w-4" /> Back to validation
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
