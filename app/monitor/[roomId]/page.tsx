"use client";

import { useEffect, useCallback, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
    Room,
    RoomEvent,
    RemoteParticipant,
} from "livekit-client";
import CandidatePanel from "@/app/components/CandidatePanel";
import WarningModal from "@/app/components/WarningModal";
import ChatDrawer from "@/app/components/ChatDrawer";
import type { DataMessageType } from "@/lib/types";

interface ChatMessage {
    from: string;
    text: string;
    ts: number;
}

export default function MonitorPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const roomId = decodeURIComponent(params.roomId as string);
    const username = searchParams.get("username") || "Monitor";

    const [room] = useState(() => new Room());
    const [connected, setConnected] = useState(false);
    const [audioBlocked, setAudioBlocked] = useState(false);
    const [myMicEnabled, setMyMicEnabled] = useState(false);
    const [candidates, setCandidates] = useState<RemoteParticipant[]>([]);
    const [micStates, setMicStates] = useState<Record<string, boolean>>({});
    // warn modal state
    const [warnTarget, setWarnTarget] = useState<RemoteParticipant | null>(null);
    // chat state
    const [chatTarget, setChatTarget] = useState<RemoteParticipant | null>(null);
    const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
    const [unread, setUnread] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string | null>(null);

    // Sync candidates list (exclude monitor itself)
    const syncCandidates = useCallback(() => {
        const remotes = Array.from(room.remoteParticipants.values()).filter(
            (p) => !p.identity.toLowerCase().startsWith("monitor")
        );
        setCandidates(remotes);
    }, [room]);

    useEffect(() => {
        let token: string;

        async function connect() {
            try {
                const res = await fetch(
                    `/api/token?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(username)}&role=monitor`
                );
                const data = await res.json();
                token = data.token;

                room.on(RoomEvent.ParticipantConnected, syncCandidates);
                room.on(RoomEvent.ParticipantDisconnected, syncCandidates);
                room.on(RoomEvent.TrackSubscribed, syncCandidates);
                room.on(RoomEvent.DataReceived, handleDataReceived);
                // Detect when browser blocks audio autoplay
                room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
                    setAudioBlocked(!room.canPlaybackAudio);
                });

                await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, {
                    autoSubscribe: true,
                });

                setConnected(true);
                syncCandidates();
                // Check immediately after connect in case audio is already blocked
                setAudioBlocked(!room.canPlaybackAudio);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Failed to connect");
            }
        }

        connect();

        return () => {
            room.disconnect();
        };
    }, [roomId, username]);

    const handleDataReceived = useCallback(
        (payload: Uint8Array, participant?: RemoteParticipant) => {
            if (!participant) return;
            try {
                const msg: DataMessageType = JSON.parse(new TextDecoder().decode(payload));
                if (msg.type === "chat") {
                    const chatMsg: ChatMessage = {
                        from: participant.identity,
                        text: msg.message,
                        ts: Date.now(),
                    };
                    setChatMessages((prev) => ({
                        ...prev,
                        [participant.identity]: [...(prev[participant.identity] || []), chatMsg],
                    }));
                    setUnread((prev) => ({ ...prev, [participant.identity]: true }));
                }
            } catch { }
        },
        []
    );

    const toggleMic = useCallback(
        async (identity: string) => {
            const current = micStates[identity] ?? false;
            const action = current ? "revoke" : "grant";
            await fetch("/api/permission", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ room: roomId, participantIdentity: identity, action }),
            });
            setMicStates((prev) => ({ ...prev, [identity]: !current }));
        },
        [micStates, roomId]
    );

    const sendWarning = useCallback(
        async (message: string) => {
            if (!warnTarget) return;
            const payload = JSON.stringify({ type: "warning", message });
            const encoder = new TextEncoder();
            await room.localParticipant.publishData(encoder.encode(payload), {
                reliable: true,
                destinationIdentities: [warnTarget.identity],
            });
        },
        [room, warnTarget]
    );

    const sendChat = useCallback(
        async (text: string) => {
            if (!chatTarget) return;
            const payload = JSON.stringify({ type: "chat", message: text, from: username });
            const encoder = new TextEncoder();
            await room.localParticipant.publishData(encoder.encode(payload), {
                reliable: true,
                destinationIdentities: [chatTarget.identity],
            });
            const chatMsg: ChatMessage = { from: "monitor", text, ts: Date.now() };
            setChatMessages((prev) => ({
                ...prev,
                [chatTarget.identity]: [...(prev[chatTarget.identity] || []), chatMsg],
            }));
        },
        [room, chatTarget, username]
    );

    const toggleMyMic = useCallback(async () => {
        try {
            const nextState = !myMicEnabled;
            await room.localParticipant.setMicrophoneEnabled(nextState);
            setMyMicEnabled(nextState);
        } catch (err) {
            console.error("Failed to toggle monitor mic", err);
        }
    }, [room, myMicEnabled]);

    if (error) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="glass" style={{ padding: "32px", textAlign: "center", maxWidth: "400px" }}>
                    <div style={{ fontSize: "32px", marginBottom: "16px" }}>⚠️</div>
                    <h2 style={{ marginBottom: "8px" }}>Connection Failed</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{error}</p>
                    <a href="/" style={{ display: "inline-block", marginTop: "20px" }} className="btn-primary">← Back to Home</a>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            {/* Audio unblock banner — shown when browser blocks autoplay */}
            {audioBlocked && (
                <div style={{
                    position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
                    zIndex: 200,
                    background: "var(--accent)",
                    color: "#fff",
                    padding: "14px 24px",
                    borderRadius: "12px",
                    display: "flex", alignItems: "center", gap: "14px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                    fontSize: "14px",
                    fontWeight: 500,
                }}>
                    <span>🔇 Audio blocked by browser</span>
                    <button
                        id="enable-audio"
                        onClick={async () => {
                            await room.startAudio();
                            setAudioBlocked(false);
                        }}
                        style={{
                            background: "#fff",
                            color: "var(--accent)",
                            border: "none",
                            borderRadius: "8px",
                            padding: "8px 16px",
                            fontWeight: 700,
                            cursor: "pointer",
                            fontSize: "13px",
                        }}
                    >
                        Enable Audio
                    </button>
                </div>
            )}
            {/* Header */}
            <header style={{
                padding: "0 24px",
                height: "60px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-surface)",
                position: "sticky", top: 0, zIndex: 50,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "18px", fontWeight: 700 }}>🖥️ e-monitor</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>|</span>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{roomId}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span className={`pill ${connected ? "pill-success" : "pill-muted"}`}>
                        <span className={`dot ${connected ? "dot-green" : ""}`} />
                        {connected ? "Live" : "Connecting…"}
                    </span>
                    <span className="pill pill-muted">
                        {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
                    </span>
                    <button
                        onClick={toggleMyMic}
                        className={`pill ${myMicEnabled ? "pill-success" : "pill-muted"}`}
                        style={{ cursor: "pointer", border: "none", background: "var(--bg-card)" }}
                    >
                        {myMicEnabled ? "🎤 My Mic On" : "🔇 My Mic Off"}
                    </button>
                    <a href="/" style={{ fontSize: "12px", color: "var(--text-muted)" }}>Leave</a>
                </div>
            </header>

            {/* Main grid */}
            <main style={{ flex: 1, padding: "24px" }}>
                {!connected ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: "16px" }}>
                        <div style={{ fontSize: "32px", animation: "pulse 1.5s infinite" }}>📡</div>
                        <p style={{ color: "var(--text-secondary)" }}>Connecting to room…</p>
                    </div>
                ) : candidates.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: "16px" }}>
                        <div style={{ fontSize: "40px", opacity: 0.3 }}>🎓</div>
                        <h2 style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Waiting for candidates to join…</h2>
                        <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>Room: <strong>{roomId}</strong></p>
                    </div>
                ) : (
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
                        gap: "20px",
                    }}>
                        {candidates.map((p) => (
                            <CandidatePanel
                                key={p.identity}
                                participant={p}
                                room={roomId}
                                micEnabled={micStates[p.identity] ?? false}
                                onToggleMic={() => toggleMic(p.identity)}
                                onWarn={() => setWarnTarget(p)}
                                onChat={() => {
                                    setChatTarget(p);
                                    setUnread((prev) => ({ ...prev, [p.identity]: false }));
                                }}
                                hasUnread={unread[p.identity]}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Warning modal */}
            {warnTarget && (
                <WarningModal
                    candidateName={warnTarget.identity}
                    onSend={sendWarning}
                    onClose={() => setWarnTarget(null)}
                />
            )}

            {/* Chat drawer */}
            {chatTarget && (
                <ChatDrawer
                    participant={chatTarget}
                    room={roomId}
                    messages={chatMessages[chatTarget.identity] || []}
                    onSend={sendChat}
                    onClose={() => setChatTarget(null)}
                />
            )}
        </div>
    );
}
