"use client";

import { useState } from "react";

const PRESET_WARNINGS = [
    "Please keep your face visible at all times.",
    "Stop looking away from the screen.",
    "Multiple faces detected in frame.",
    "Please ensure you are in a quiet environment.",
    "Do not use your phone during the exam.",
    "Please look directly at the camera.",
];

interface WarningModalProps {
    candidateName: string;
    onSend: (message: string) => void;
    onClose: () => void;
}

export default function WarningModal({ candidateName, onSend, onClose }: WarningModalProps) {
    const [custom, setCustom] = useState("");
    const [selected, setSelected] = useState<string | null>(null);

    const handleSend = () => {
        const msg = selected === "__custom__" ? custom.trim() : selected;
        if (msg) {
            onSend(msg);
            onClose();
        }
    };

    return (
        <div className="overlay-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="glass" style={{ width: "100%", maxWidth: "480px", padding: "32px", animation: "slideUp 0.2s ease" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                    <div>
                        <h3 style={{ fontSize: "16px", fontWeight: 700 }}>⚠️ Send Warning</h3>
                        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>To: {candidateName}</p>
                    </div>
                    <button id="warn-modal-close" className="btn-ghost" onClick={onClose} style={{ padding: "8px 12px" }}>✕</button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                    {PRESET_WARNINGS.map((w) => (
                        <button
                            key={w}
                            onClick={() => setSelected(w)}
                            style={{
                                padding: "12px 16px",
                                borderRadius: "10px",
                                border: `1px solid ${selected === w ? "var(--warning)" : "var(--border)"}`,
                                background: selected === w ? "rgba(245,158,11,0.1)" : "var(--bg-surface)",
                                color: selected === w ? "var(--warning)" : "var(--text-secondary)",
                                cursor: "pointer",
                                fontSize: "13px",
                                textAlign: "left",
                                transition: "all 0.15s",
                            }}
                        >
                            {w}
                        </button>
                    ))}
                    <button
                        onClick={() => setSelected("__custom__")}
                        style={{
                            padding: "12px 16px",
                            borderRadius: "10px",
                            border: `1px solid ${selected === "__custom__" ? "var(--accent)" : "var(--border)"}`,
                            background: selected === "__custom__" ? "var(--accent-glow)" : "var(--bg-surface)",
                            color: selected === "__custom__" ? "var(--accent-hover)" : "var(--text-secondary)",
                            cursor: "pointer",
                            fontSize: "13px",
                            textAlign: "left",
                        }}
                    >
                        ✏️ Custom message…
                    </button>
                </div>

                {selected === "__custom__" && (
                    <textarea
                        id="warn-custom-input"
                        className="input"
                        style={{ minHeight: "80px", resize: "vertical", marginBottom: "16px" }}
                        placeholder="Type your warning…"
                        value={custom}
                        onChange={(e) => setCustom(e.target.value)}
                    />
                )}

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button className="btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        id="warn-send"
                        className="btn-danger"
                        onClick={handleSend}
                        disabled={!selected || (selected === "__custom__" && !custom.trim())}
                        style={{ padding: "10px 20px" }}
                    >
                        Send Warning
                    </button>
                </div>
            </div>
        </div>
    );
}
