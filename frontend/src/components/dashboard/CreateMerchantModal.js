import React, { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useToast } from "../Toast";
import { merchantApi, apiError } from "../../lib/api";

export default function CreateMerchantModal({ onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data } = await merchantApi.create({ name: name.trim(), category: category.trim() || null });
      onCreated(data);
    } catch (err) { toast.error(apiError(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-void/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()} className="card rounded-card w-full max-w-md p-7" data-testid="create-merchant-modal">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display font-bold text-xl">New merchant</h3>
          <button onClick={onClose} className="text-faint hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="data-label text-[11px] text-muted block mb-2">Name</label>
            <input data-testid="cm-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Payments" autoFocus />
          </div>
          <div>
            <label className="data-label text-[11px] text-muted block mb-2">Category (optional)</label>
            <input data-testid="cm-category" className="field" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="ecommerce" />
          </div>
        </div>
        <button data-testid="cm-submit" onClick={submit} disabled={!name.trim() || saving} className="btn btn-cobalt w-full justify-center mt-6">
          {saving ? "Creating…" : "Create merchant"}
        </button>
        <p className="text-[12px] text-faint mt-3">You can run a simulation on this merchant right after creating it.</p>
      </motion.div>
    </div>
  );
}
