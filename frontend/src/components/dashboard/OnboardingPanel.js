import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, Play, Square, Gauge, Dice5, CheckCircle2, XCircle, Copy,
} from "lucide-react";
import { PERSONAS } from "../../lib/constants";
import { ingestApi, apiError } from "../../lib/api";
import { useToast } from "../Toast";

export default function OnboardingPanel({ merchantId, simStatus, onStart, onStop, starting, onIngested }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [tab, setTab] = useState("simulate");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const [persona, setPersona] = useState("healthy");
  const [days, setDays] = useState(60);
  const [speed, setSpeed] = useState(20);
  const [seed, setSeed] = useState("");

  const running = simStatus?.status === "running";
  const pct = running || simStatus?.status === "completed"
    ? Math.min(100, Math.round(((simStatus?.current_day_index || 0) / (simStatus?.total_days || 1)) * 100))
    : 0;

  const handleFile = async (file) => {
    if (!file) return;
    if (!merchantId) { toast.error("Select or create a merchant first."); return; }
    if (!file.name.endsWith(".csv")) { toast.error("Please upload a .csv file."); return; }
    setUploading(true); setUploadResult(null);
    try {
      const { data } = await ingestApi.upload(merchantId, file);
      setUploadResult(data);
      toast.success(`Ingested ${data.rows_ingested} rows (${data.rows_rejected} rejected, ${data.rows_duplicate} duplicate).`);
      onIngested?.(data);
    } catch (err) { toast.error(apiError(err)); }
    finally { setUploading(false); }
  };

  const startSim = () => {
    if (!merchantId) { toast.error("Select or create a merchant first."); return; }
    onStart({
      merchant_id: merchantId,
      persona,
      days: Number(days),
      speed_multiplier: Number(speed),
      ...(seed !== "" ? { seed: Number(seed) } : {}),
    });
  };

  return (
    <div className="card rounded-card" data-testid="onboarding-panel">
      {/* tabs */}
      <div className="flex border-b border-line">
        {[["simulate", "Run simulation", Play], ["upload", "Upload CSV", UploadCloud]].map(([id, label, Icon]) => (
          <button
            key={id}
            data-testid={`onboard-tab-${id}`}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 data-label text-[11px] transition-colors duration-200 ${
              tab === id ? "text-ink bg-surface" : "text-faint hover:text-muted"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
            {tab === id && <motion.span layoutId="onboard-underline" className="absolute bottom-0 left-0 right-0 h-px bg-cobalt" />}
          </button>
        ))}
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {tab === "simulate" ? (
            <motion.div key="sim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {/* persona */}
              <label className="data-label text-[11px] text-muted block mb-3">Persona</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    data-testid={`persona-${p.id}`}
                    onClick={() => setPersona(p.id)}
                    disabled={running}
                    className={`text-left p-3 border transition-colors duration-200 disabled:opacity-50 ${
                      persona === p.id ? "border-cobalt bg-cobalt/10" : "border-ink/12 hover:border-ink/30"
                    }`}
                  >
                    <span className="font-narrow uppercase tracking-label text-[11px] block mb-0.5">{p.label}</span>
                    <span className="text-[11px] text-faint leading-tight block">{p.desc}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div>
                  <label className="data-label text-[11px] text-muted block mb-2">Days</label>
                  <input data-testid="sim-days" type="number" min="14" max="365" className="field" value={days} onChange={(e) => setDays(e.target.value)} disabled={running} />
                </div>
                <div>
                  <label className="data-label text-[11px] text-muted flex items-center gap-1 mb-2"><Gauge className="w-3 h-3" /> Speed×</label>
                  <input data-testid="sim-speed" type="number" min="1" max="100" className="field" value={speed} onChange={(e) => setSpeed(e.target.value)} disabled={running} />
                </div>
                <div>
                  <label className="data-label text-[11px] text-muted flex items-center gap-1 mb-2"><Dice5 className="w-3 h-3" /> Seed</label>
                  <input data-testid="sim-seed" type="number" className="field" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="rand" disabled={running} />
                </div>
              </div>

              {/* progress */}
              <AnimatePresence>
                {simStatus && simStatus.status !== "not_found" && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="data-label text-[11px] flex items-center gap-2">
                        {running && <span className="w-2 h-2 rounded-full bg-safe live-dot" />}
                        <span className={running ? "text-safe" : simStatus.status === "completed" ? "text-cobalt" : "text-muted"}>
                          {simStatus.status}
                        </span>
                      </span>
                      <span className="data-label text-[11px] text-muted tabular-nums">
                        Day {simStatus.current_day_index}/{simStatus.total_days}
                      </span>
                    </div>
                    <div className="h-2 bg-void overflow-hidden border border-line" data-testid="sim-progress">
                      <motion.div className="h-full bg-cobalt" animate={{ width: `${pct}%` }} transition={{ ease: "linear", duration: 0.4 }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {running ? (
                <button data-testid="sim-stop" onClick={onStop} className="btn w-full justify-center" style={{ borderColor: "#F44336", color: "#F44336" }}>
                  <Square className="w-4 h-4" /> Stop simulation
                </button>
              ) : (
                <button data-testid="sim-start" onClick={startSim} disabled={starting || !merchantId} className="btn btn-cobalt w-full justify-center">
                  <Play className="w-4 h-4" /> {starting ? "Starting…" : "Start simulation"}
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div
                data-testid="csv-dropzone"
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}
                className={`border border-dashed cursor-pointer p-10 text-center transition-colors duration-200 ${
                  dragging ? "border-cobalt bg-cobalt/10" : "border-ink/20 hover:border-ink/40"
                }`}
              >
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} data-testid="csv-input" />
                <UploadCloud className={`w-8 h-8 mx-auto mb-4 ${dragging ? "text-cobalt" : "text-muted"}`} strokeWidth={1.5} />
                <p className="text-ink font-medium mb-1">{uploading ? "Uploading…" : "Drop a CSV or click to browse"}</p>
                <p className="text-[12px] text-faint">Columns: ts, amount, status, payment_method, customer_id</p>
              </div>

              <AnimatePresence>
                {uploadResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5 grid grid-cols-3 gap-3" data-testid="upload-result">
                    {[
                      ["Ingested", uploadResult.rows_ingested, "#00E676", CheckCircle2],
                      ["Rejected", uploadResult.rows_rejected, "#F44336", XCircle],
                      ["Duplicate", uploadResult.rows_duplicate, "#FFB300", Copy],
                    ].map(([label, val, color, Icon]) => (
                      <div key={label} className="border border-line p-4 text-center">
                        <Icon className="w-4 h-4 mx-auto mb-2" style={{ color }} />
                        <p className="font-narrow text-2xl font-bold tabular-nums" style={{ color }}>{val}</p>
                        <p className="data-label text-[10px] text-faint mt-1">{label}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {uploadResult?.errors?.length > 0 && (
                <div className="mt-4 border border-line max-h-40 overflow-auto">
                  {uploadResult.errors.slice(0, 20).map((e, i) => (
                    <div key={i} className="flex gap-3 px-3 py-2 border-b border-line last:border-0 text-[12px]">
                      <span className="data-label text-faint">Row {e.row}</span>
                      <span className="text-critical/90">{e.error}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 text-[12px] text-faint">
                <FileText className="w-3.5 h-3.5" />
                <span>Uploaded rows are analysed the same way as simulated ones.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
