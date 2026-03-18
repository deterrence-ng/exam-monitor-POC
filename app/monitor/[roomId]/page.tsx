"use client";

import { useEffect, useCallback, useState, useRef } from "react";
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
    const [audioTarget, setAudioTarget] = useState<"none" | "all" | string>("none");
    const [candidates, setCandidates] = useState<RemoteParticipant[]>([]);
    const [micStates, setMicStates] = useState<Record<string, boolean>>({});
    const [warnTarget, setWarnTarget] = useState<RemoteParticipant | null>(null);
    // chat state
    const [chatTarget, setChatTarget] = useState<RemoteParticipant | null>(null);
    const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
    const [unread, setUnread] = useState<Record<string, boolean>>({});
    const [micRequests, setMicRequests] = useState<Record<string, boolean>>({});
    const [error, setError] = useState<string | null>(null);

    const audioTargetRef = useRef(audioTarget);
    useEffect(() => { audioTargetRef.current = audioTarget; }, [audioTarget]);

    // Sync candidates list (exclude monitor itself)
    const syncCandidates = useCallback(() => {
        const remotes = Array.from(room.remoteParticipants.values()).filter(
            (p) => {
                let isMonitor = false;
                try {
                    const meta = JSON.parse(p.metadata || '{}');
                    isMonitor = meta.role === "monitor";
                } catch { }
                return !isMonitor && !p.identity.toLowerCase().startsWith("monitor");
            }
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

                room.on(RoomEvent.ParticipantConnected, (p) => {
                    syncCandidates();
                    // Sync current monitor target state to the late joiner
                    const payload = JSON.stringify({ type: "monitor_target", target: audioTargetRef.current });
                    room.localParticipant.publishData(new TextEncoder().encode(payload), { 
                        reliable: true,
                        destinationIdentities: [p.identity]
                    }).catch(() => {});
                });
                room.on(RoomEvent.ParticipantDisconnected, syncCandidates);
                room.on(RoomEvent.TrackSubscribed, syncCandidates);
                room.on(RoomEvent.DataReceived, handleDataReceived);

                await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token, {
                    autoSubscribe: true,
                });

                setConnected(true);
                syncCandidates();
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Failed to connect");
            }
        }

        connect();

        return () => {
            room.off(RoomEvent.ParticipantConnected, syncCandidates);
            room.off(RoomEvent.ParticipantDisconnected, syncCandidates);
            room.off(RoomEvent.TrackSubscribed, syncCandidates);
            room.off(RoomEvent.DataReceived, handleDataReceived);
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
                } else if (msg.type === "mic_request") {
                    setMicRequests((prev) => ({ ...prev, [msg.from]: true }));
                }
            } catch { }
        },
        []
    );

    const toggleMic = useCallback(
        async (identity: string) => {
            room.startAudio().catch(() => { }); // silently attempt unblock on click
            const current = micStates[identity] ?? false;
            const action = current ? "revoke" : "grant";
            await fetch("/api/permission", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ room: roomId, participantIdentity: identity, action }),
            });
            setMicStates((prev) => ({ ...prev, [identity]: !current }));
            if (action === "grant") {
                setMicRequests((prev) => ({ ...prev, [identity]: false }));
            }
        },
        [micStates, roomId]
    );

    const sendWarning = useCallback(
        async (message: string) => {
            room.startAudio().catch(() => { });
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
            room.startAudio().catch(() => { });
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

    const toggleAudioTarget = useCallback(async (target: "none" | "all" | string) => {
        try {
            room.startAudio().catch(() => { });

            // If we're clicking the same target again, toggle it off ("none")
            const nextTarget = audioTarget === target ? "none" : target;

            // Enable mic if target is not "none", disable if "none"
            await room.localParticipant.setMicrophoneEnabled(nextTarget !== "none");

            // Broadcast the target to everyone so candidates can mute/unmute locally
            const payload = JSON.stringify({ type: "monitor_target", target: nextTarget });
            await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });

            setAudioTarget(nextTarget);
        } catch (err) {
            console.error("Failed to toggle monitor audio target", err);
        }
    }, [room, audioTarget]);

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
                        onClick={() => toggleAudioTarget("all")}
                        className={`pill ${audioTarget === "all" ? "pill-primary" : audioTarget === "none" ? "pill-muted" : "pill-success"}`}
                        style={{ cursor: "pointer", border: "none" }}
                    >
                        {audioTarget === "none" ? "🔇 Muted" : audioTarget === "all" ? "📢 Broadcasting to All" : `🗣️ Talking to candidate`}
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
                                onWarn={() => {
                                    room.startAudio().catch(() => { });
                                    setWarnTarget(p);
                                }}
                                onChat={() => {
                                    room.startAudio().catch(() => { });
                                    setChatTarget(p);
                                    setUnread((prev) => ({ ...prev, [p.identity]: false }));
                                }}
                                onTarget={() => toggleAudioTarget(p.identity)}
                                onKick={async () => {
                                    try {
                                        await fetch("/api/kickout", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ room: roomId, participantIdentity: p.identity })
                                        });
                                    } catch (err) {
                                        console.error("Failed to kick participant", err);
                                    }
                                }}
                                isTarget={audioTarget === p.identity}
                                hasUnread={unread[p.identity]}
                                micRequested={micRequests[p.identity]}
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
