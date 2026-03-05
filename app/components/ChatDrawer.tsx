"use client";

import { useEffect, useRef, useState } from "react";
import { type RemoteParticipant } from "livekit-client";

interface ChatMessage {
    from: string;
    text: string;
    ts: number;
}

interface ChatDrawerProps {
    participant: RemoteParticipant;
    room: string;
    onClose: () => void;
    messages: ChatMessage[];
    onSend: (text: string) => void;
}

export default function ChatDrawer({ participant, onClose, messages, onSend }: ChatDrawerProps) {
    const [text, setText] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const send = () => {
        const t = text.trim();
        if (!t) return;
        onSend(t);
        setText("");
    };

    return (
        <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, width: "360px",
            background: "var(--bg-surface)",
            borderLeft: "1px solid var(--border)",
            display: "flex", flexDirection: "column",
            zIndex: 80,
            animation: "slideFromRight 0.2s ease",
        }}>
            <style>{`@keyframes slideFromRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

            {/* Header */}
            <div style={{ padding: "20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                    <div style={{ fontSize: "14px", fontWeight: 600 }}>💬 Chat</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{participant.identity}</div>
                </div>
                <button id="chat-close" className="btn-ghost" onClick={onClose} style={{ padding: "8px 12px" }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {messages.length === 0 && (
                    <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", marginTop: "32px" }}>
                        No messages yet. Start the conversation.
                    </p>
                )}
                {messages.map((m, i) => {
                    const isMonitor = m.from === "monitor";
                    return (
                        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: isMonitor ? "flex-end" : "flex-start" }}>
                            <div style={{
                                maxWidth: "80%",
                                padding: "10px 14px",
                                borderRadius: isMonitor ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                background: isMonitor ? "var(--accent)" : "var(--bg-card)",
                                border: isMonitor ? "none" : "1px solid var(--border)",
                                fontSize: "13px",
                                lineHeight: "1.5",
                            }}>
                                {m.text}
                            </div>
                            <span style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
                                {isMonitor ? "You" : m.from} · {new Date(m.ts).toLocaleTimeString()}
                            </span>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px" }}>
                <input
                    id="chat-input"
                    className="input"
                    placeholder="Type a message…"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    style={{ flex: 1 }}
                />
                <button id="chat-send" className="btn-primary" onClick={send} disabled={!text.trim()} style={{ padding: "10px 16px" }}>
                    ↑
                </button>
            </div>
        </div>
    );
}
