import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Activity, RefreshCw, Plus, ChevronDown, TrendingUp, Bell, Layers, Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { merchantApi, ingestApi, analyticsApi, apiError, API_BASE } from "../lib/api";
import { classificationMeta } from "../lib/constants";
import OnboardingPanel from "../components/dashboard/OnboardingPanel";
import StreamChart from "../components/dashboard/StreamChart";
import MerchantPanel from "../components/dashboard/MerchantPanel";
import AlertFeed from "../components/dashboard/AlertFeed";
import CreateMerchantModal from "../components/dashboard/CreateMerchantModal";


const ANOMALOUS = ["distress", "breakout", "fraud_pattern", "seasonal_dip"];

export default function Dashboard() {
  const { role, merchantId: myMerchantId, phoneNumber } = useAuth();
  const toast = useToast();
  const isMerchant = role === "merchant";

  const [merchants, setMerchants] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [features, setFeatures] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [latestByMerchant, setLatestByMerchant] = useState({});
  const [simStatus, setSimStatus] = useState(null);

  const [loadingData, setLoadingData] = useState(false);
  const [loadingAnoms, setLoadingAnoms] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [starting, setStarting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busyAlertId, setBusyAlertId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);


  const pollRef = useRef(null);

  // ---- loaders ----------------------------------------------------------
  const loadMerchants = useCallback(async () => {
    setLoadingData(true);
    try {
      const { data } = await merchantApi.list();
      setMerchants(data || []);
      setSelectedId((prev) => {
        if (isMerchant) return myMerchantId || (data?.[0]?.id ?? null);
        return prev || data?.[0]?.id || null;
      });
    } catch (err) {
      toast.error(apiError(err));
    } finally { setLoadingData(false); }
  }, [isMerchant, myMerchantId, toast]);

  const loadAnalytics = useCallback(async (id, { silent } = {}) => {
    if (!id) return;
    if (!silent) { setLoadingAnoms(true); setLoadingAlerts(true); }
    try {
      const [f, a, al] = await Promise.allSettled([
        analyticsApi.features(id, "60d"),
        analyticsApi.anomalies(id, "60d"),
        analyticsApi.alerts(id),
      ]);
      if (f.status === "fulfilled") setFeatures(f.value.data || []);
      if (a.status === "fulfilled") {
        const rows = a.value.data || [];
        setAnomalies(rows);
        if (rows.length) setLatestByMerchant((m) => ({ ...m, [id]: rows[rows.length - 1] }));
      }
      if (al.status === "fulfilled") setAlerts(al.value.data || []);
    } finally { setLoadingAnoms(false); setLoadingAlerts(false); }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMerchants(); }, []);
  useEffect(() => {
    if (selectedId) {
      loadAnalytics(selectedId);
      // pick up any in-flight simulation
      ingestApi.simulateStatus(selectedId).then((r) => setSimStatus(r.data)).catch(() => setSimStatus(null));
    } else {
      setFeatures([]); setAnomalies([]); setAlerts([]); setSimStatus(null);
    }
    // eslint-disable-next-line
  }, [selectedId]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ---- simulation -------------------------------------------------------
  const beginPolling = useCallback((id) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await ingestApi.simulateStatus(id);
        setSimStatus(data);
        // grow the live chart while running
        loadAnalytics(id, { silent: true });
        if (data.status !== "running") {
          clearInterval(pollRef.current); pollRef.current = null;
          if (data.status === "completed") {
            toast.success("Simulation complete — scoring days…");
            await runAnalyze(id);
          } else {
            loadAnalytics(id);
          }
        }
      } catch (_) { /* keep polling */ }
    }, 1500);
  }, [loadAnalytics]); // eslint-disable-line

  const startSim = async (params) => {
    setStarting(true);
    try {
      await ingestApi.simulateStart(params);
      toast.success(`Streaming ${params.persona} data over ${params.days} days…`);
      setSimStatus({ status: "running", current_day_index: 0, total_days: params.days, persona: params.persona });
      beginPolling(params.merchant_id);
    } catch (err) { toast.error(apiError(err)); }
    finally { setStarting(false); }
  };

  const stopSim = async () => {
    try { await ingestApi.simulateStop(selectedId); toast.info("Simulation stopped."); }
    catch (err) { toast.error(apiError(err)); }
  };

  const runAnalyze = async (id) => {
    setAnalyzing(true);
    try {
      const { data } = await analyticsApi.analyze(id);
      const scored = data?.days_scored ?? 0;
      toast.success(scored ? `Scored ${scored} day(s).` : "Analysis up to date.");
      await loadAnalytics(id);
    } catch (err) { toast.error(apiError(err)); }
    finally { setAnalyzing(false); }
  };

  const generateExplanations = async () => {
    if (!selectedId) return;
    setGenerating(true);
    try {
      let rows = anomalies;
      if (!rows.length) {
        const { data } = await analyticsApi.anomalies(selectedId, "60d");
        rows = data || [];
      }
      const targets = rows
        .filter((r) => ANOMALOUS.includes(r.classification))
        .sort((a, b) => Number(b.severity) - Number(a.severity))
        .slice(0, 8);
      if (!targets.length) { toast.info("No anomalous days to explain — everything looks normal."); return; }
      let made = 0;
      for (const t of targets) {
        try { await analyticsApi.explain(selectedId, t.day); made += 1; } catch (_) {}
      }
      toast.success(`Generated ${made} explanation(s).`);
      const { data } = await analyticsApi.alerts(selectedId);
      setAlerts(data || []);
    } catch (err) { toast.error(apiError(err)); }
    finally { setGenerating(false); }
  };

  const ackAlert = async (id) => {
    setBusyAlertId(id);
    try { await analyticsApi.acknowledge(id); setAlerts((a) => a.map((x) => x.id === id ? { ...x, status: "acknowledged" } : x)); toast.success("Alert acknowledged."); }
    catch (err) { toast.error(apiError(err)); }
    finally { setBusyAlertId(null); }
  };
  const dismissAlert = async (id) => {
    setBusyAlertId(id);
    try { await analyticsApi.dismiss(id); setAlerts((a) => a.map((x) => x.id === id ? { ...x, status: "dismissed" } : x)); toast.info("Alert dismissed."); }
    catch (err) { toast.error(apiError(err)); }
    finally { setBusyAlertId(null); }
  };

  // ---- derived ----------------------------------------------------------
  const chartData = features.map((f) => ({
    day: (f.day || "").slice(5),
    volume: Number(f.txn_volume) || 0,
    velocity: Number(f.velocity_7d_avg ?? f.txn_count) || 0,
  }));
  const totalVolume = features.reduce((s, f) => s + (Number(f.txn_volume) || 0), 0);
  const openAlerts = alerts.filter((a) => a.status === "open").length;
  const avgSeverity = anomalies.length ? anomalies.reduce((s, a) => s + (Number(a.severity) || 0), 0) / anomalies.length : 0;
  const latest = latestByMerchant[selectedId] || anomalies[anomalies.length - 1];
  const selectedMerchant = merchants.find((m) => m.id === selectedId);
  const simRunning = simStatus?.status === "running";

  const stats = [
    { label: "Txn volume (60d)", value: "₹" + (totalVolume >= 1e5 ? (totalVolume / 1e5).toFixed(1) + "L" : Math.round(totalVolume).toLocaleString()), icon: TrendingUp, color: "#0E76FF" },
    { label: "Days scored", value: anomalies.length, icon: Layers, color: "#00E676" },
    { label: "Avg severity", value: avgSeverity.toFixed(2), icon: Zap, color: "#FFB300" },
    { label: "Open alerts", value: openAlerts, icon: Bell, color: "#F44336" },
  ];

  return (
    <div className="min-h-screen bg-bg grain">
      {/* top bar */}
      <div className="sticky top-0 z-40 bg-bg/85 backdrop-blur-xl border-b border-line">
        <div className="max-w-grid mx-auto px-6 h-[68px] flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-8 h-8 border border-ink/70"><Activity className="w-4 h-4 text-cobalt" strokeWidth={2.5} /></span>
            <div>
              <p className="font-display font-extrabold leading-none">Dashboard</p>
              <p className="data-label text-[10px] text-faint mt-0.5">{role}{phoneNumber ? ` · ${phoneNumber}` : ""}</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {!isMerchant && (
              <div className="relative">
                <select
                  data-testid="merchant-selector"
                  value={selectedId || ""}
                  onChange={(e) => setSelectedId(e.target.value || null)}
                  className="field py-2.5 pr-9 appearance-none min-w-[200px] cursor-pointer"
                >
                  <option value="">Select merchant…</option>
                  {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-faint absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
            {!isMerchant && (
              <button data-testid="new-merchant-btn" onClick={() => setShowCreate(true)} className="btn py-2.5 px-4"><Plus className="w-4 h-4" /> New</button>
            )}
            <button data-testid="refresh-btn" onClick={() => { loadMerchants(); if (selectedId) loadAnalytics(selectedId); }} className="btn py-2.5 px-4">
              <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-grid mx-auto px-6 py-8">
        {/* API base hint */}
        <p className="data-label text-[10px] text-faint mb-6">gateway · {API_BASE}</p>

        {/* stat strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1], duration: 0.5 }}
              className="card rounded-card p-5 group card-lift"
              data-testid={`stat-${i}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="data-label text-[10px] text-faint">{s.label}</span>
                <s.icon className="w-4 h-4 transition-transform group-hover:scale-110" style={{ color: s.color }} />
              </div>
              <p className="font-stat text-3xl font-bold tabular-nums mb-3" style={{ color: s.color }}>{s.value}</p>
              {/* Color accent underline */}
              <div className="h-[2px] rounded-full overflow-hidden bg-line">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: s.color }}
                  initial={{ width: 0 }}
                  animate={{ width: "60%" }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT column */}
          <div className="lg:col-span-8 space-y-6">
            {/* stream chart */}
            <div className="card rounded-card p-6" data-testid="stream-card">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-display font-bold text-lg">{selectedMerchant?.name || "Transaction stream"}</h3>
                    {simRunning && <span className="flex items-center gap-1.5 data-label text-[10px] text-safe"><span className="w-2 h-2 rounded-full bg-safe live-dot" /> live</span>}
                  </div>
                  <p className="data-label text-[10px] text-faint mt-1">Volume (₹) &amp; 7-day velocity</p>
                </div>
                {latest && (
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 border" style={{ borderColor: classificationMeta(latest.classification).color + "66", background: classificationMeta(latest.classification).color + "14" }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: classificationMeta(latest.classification).color }} />
                    <span className="data-label text-[10px]" style={{ color: classificationMeta(latest.classification).color }}>{classificationMeta(latest.classification).label}</span>
                  </span>
                )}
              </div>

              {chartData.length > 0 ? (
                <StreamChart data={chartData} live={simRunning} />
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center border border-dashed border-line relative overflow-hidden">
                  {/* Decorative ambient glow */}
                  <div className="absolute inset-0 bg-gradient-radial from-cobalt/4 to-transparent pointer-events-none" />
                  <div className="absolute inset-0 grid-lines opacity-30" />
                  <Activity className="w-10 h-10 text-faint mb-4 relative" strokeWidth={1.2} />
                  <p className="text-muted text-sm mb-1 relative font-display font-semibold">No transaction data yet</p>
                  <p className="text-[12px] text-faint relative data-label">Run a simulation or upload a CSV to see the stream.</p>
                </div>
              )}

              {features.length > 0 && !simRunning && (
                <button data-testid="analyze-btn" onClick={() => runAnalyze(selectedId)} disabled={analyzing} className="btn btn-cobalt mt-5 py-2.5">
                  <Zap className="w-4 h-4" /> {analyzing ? "Analysing…" : "Run analysis"}
                </button>
              )}
            </div>

            {/* merchant panel */}
            <MerchantPanel
              merchants={merchants}
              selectedId={selectedId}
              onSelect={(id) => { if (!isMerchant) setSelectedId(id); }}
              anomalies={anomalies}
              loadingAnomalies={loadingAnoms}
              latestByMerchant={latestByMerchant}
            />
          </div>

          {/* RIGHT column */}
          <div className="lg:col-span-4 space-y-6">
            <OnboardingPanel
              merchantId={selectedId}
              simStatus={simStatus}
              onStart={startSim}
              onStop={stopSim}
              starting={starting}
              onIngested={() => loadAnalytics(selectedId)}
            />
            <AlertFeed
              alerts={alerts}
              loading={loadingAlerts}
              onAck={ackAlert}
              onDismiss={dismissAlert}
              onGenerate={generateExplanations}
              generating={generating}
              busyId={busyAlertId}
              canGenerate={!!selectedId && anomalies.length > 0}
            />
          </div>
        </div>
      </div>

      {/* create merchant modal */}
      {showCreate && <CreateMerchantModal onClose={() => setShowCreate(false)} onCreated={(m) => { setMerchants((list) => [...list, m]); setSelectedId(m.id); setShowCreate(false); toast.success(`Created ${m.name}.`); }} />}
    </div>
  );
}

