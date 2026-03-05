"use client";

import { useEffect } from "react";

interface WarningOverlayProps {
    message: string;
    onDismiss: () => void;
}

export default function WarningOverlay({ message, onDismiss }: WarningOverlayProps) {
    // Auto-dismiss after 10 seconds
    useEffect(() => {
        const t = setTimeout(onDismiss, 10000);
        return () => clearTimeout(t);
    }, [onDismiss]);

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            animation: "fadeIn 0.2s ease",
        }}>
            <div style={{
                textAlign: "center", maxWidth: "520px", padding: "20px",
                animation: "slideUp 0.25s ease",
            }}>
                {/* Warning icon */}
                <div style={{
                    width: "80px", height: "80px",
                    borderRadius: "50%",
                    background: "rgba(239,68,68,0.15)",
                    border: "2px solid rgba(239,68,68,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "36px",
                    margin: "0 auto 24px",
                    boxShadow: "0 0 48px rgba(239,68,68,0.3)",
                    animation: "warnPulse 1.5s ease infinite",
                }}>⚠️</div>

                <style>{`
          @keyframes warnPulse {
            0%, 100% { box-shadow: 0 0 24px rgba(239,68,68,0.3); }
            50%       { box-shadow: 0 0 64px rgba(239,68,68,0.6); }
          }
        `}</style>

                <div style={{
                    fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em",
                    color: "var(--danger)", textTransform: "uppercase", marginBottom: "16px",
                }}>
                    ⚠ Monitor Warning
                </div>

                <p style={{
                    fontSize: "22px", fontWeight: 600, lineHeight: "1.4",
                    color: "var(--text-primary)", marginBottom: "32px",
                }}>
                    {message}
                </p>

                <button
                    id="warn-dismiss"
                    className="btn-primary"
                    onClick={onDismiss}
                    style={{ padding: "12px 32px" }}
                >
                    I Understand
                </button>

                <p style={{ marginTop: "16px", fontSize: "11px", color: "var(--text-muted)" }}>
                    This warning will auto-dismiss in 10 seconds
                </p>
            </div>
        </div>
    );
}
