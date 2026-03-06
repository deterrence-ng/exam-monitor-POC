"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
    Room,
    RoomEvent,
    Track,
    RemoteTrack,
    RemoteParticipant,
    createLocalScreenTracks,
    createLocalVideoTrack,
} from "livekit-client";
import WarningOverlay from "@/app/components/WarningOverlay";
import type { DataMessageType } from "@/lib/types";

interface ChatMessage {
    from: string;
    text: string;
    ts: number;
}

export default function CandidatePage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const roomId = decodeURIComponent(params.roomId as string);
    const username = searchParams.get("username") || "Candidate";

    const [room] = useState(() => new Room());
    const [connected, setConnected] = useState(false);
    const [micEnabled, setMicEnabled] = useState(false);
    const [cameraOn, setCameraOn] = useState(false);
    const [screenSharing, setScreenSharing] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatOpen, setChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [unread, setUnread] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [monitorAudioTrack, setMonitorAudioTrack] = useState<RemoteTrack | null>(null);

    const cameraRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const chatBottomRef = useRef<HTMLDivElement>(null);

    const handleDataReceived = useCallback(
        (payload: Uint8Array) => {
            try {
                const msg: DataMessageType = JSON.parse(new TextDecoder().decode(payload));
                if (msg.type === "mic_grant") {
                    setMicEnabled(true);
                    room.localParticipant.setMicrophoneEnabled(true);
                } else if (msg.type === "mic_revoke") {
                    setMicEnabled(false);
                    room.localParticipant.setMicrophoneEnabled(false);
                } else if (msg.type === "warning") {
                    setWarning(msg.message);
                } else if (msg.type === "chat") {
                    setChatMessages((prev) => [
                        ...prev,
                        { from: msg.from || "Monitor", text: msg.message, ts: Date.now() },
                    ]);
                    if (!chatOpen) setUnread(true);
                }
            } catch { }
        },
        [room, chatOpen]
    );

    useEffect(() => {
        async function connect() {
            try {
                const res = await fetch(
                    `/api/token?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(username)}&role=candidate`
                );
                const data = await res.json();

                room.on(RoomEvent.DataReceived, handleDataReceived);
                room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
                    if (track.kind === "audio") {
                        setMonitorAudioTrack(track);
                    }
                });
                room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, publication: any, participant: RemoteParticipant) => {
                    if (track.kind === "audio" && participant.identity.toLowerCase().startsWith("monitor")) {
                        setMonitorAudioTrack(null);
                    }
                });

                await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, data.token, {
                    autoSubscribe: true,
                });

                // Start camera immediately, mic stays muted
                await room.localParticipant.setCameraEnabled(true);
                await room.localParticipant.setMicrophoneEnabled(false);
                setCameraOn(true);
                setConnected(true);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Failed to connect");
            }
        }
        connect();
        return () => { room.disconnect(); };
    }, [roomId, username]);

    // Attach local camera preview
    useEffect(() => {
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.videoTrack && cameraRef.current) {
            camPub.videoTrack.attach(cameraRef.current);
            return () => { camPub.videoTrack?.detach(); };
        }
    }, [cameraOn, room]);

    // Attach monitor audio
    useEffect(() => {
        if (monitorAudioTrack && audioRef.current) {
            monitorAudioTrack.attach(audioRef.current);
            return () => { monitorAudioTrack.detach(); };
        }
    }, [monitorAudioTrack]);

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    const startScreenShare = async () => {
        room.startAudio().catch(() => { });
        try {
            const screenTracks = await createLocalScreenTracks({ audio: false });
            for (const track of screenTracks) {
                await room.localParticipant.publishTrack(track);
            }
            setScreenSharing(true);
        } catch {
            // user cancelled or denied
        }
    };

    const sendChat = async () => {
        const text = chatInput.trim();
        if (!text) return;
        const payload = JSON.stringify({ type: "chat", message: text, from: username });
        await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
        setChatMessages((prev) => [...prev, { from: username, text, ts: Date.now() }]);
        setChatInput("");
    };

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
            <audio ref={audioRef} autoPlay style={{ display: "none" }} />

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
                    <span style={{ fontSize: "18px", fontWeight: 700 }}>🎓 e-monitor</span>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>|</span>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Exam: {roomId}</span>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span className={`pill ${connected ? "pill-success" : "pill-muted"}`}>
                        <span className={`dot ${connected ? "dot-green" : ""}`} />
                        {connected ? "Connected" : "Connecting…"}
                    </span>
                    <span className={`pill ${micEnabled ? "pill-success" : "pill-muted"}`}>
                        {micEnabled ? "🎤 Mic On" : "🔇 Mic Off"}
                    </span>
                    <button
                        id="chat-toggle"
                        className="btn-ghost"
                        onClick={() => {
                            room.startAudio().catch(() => { });
                            setChatOpen((v) => !v);
                            setUnread(false);
                        }}
                        style={{ position: "relative" }}
                    >
                        💬 Chat
                        {unread && (
                            <span style={{
                                position: "absolute", top: "4px", right: "4px",
                                width: "8px", height: "8px", background: "var(--accent)", borderRadius: "50%",
                            }} />
                        )}
                    </button>
                </div>
            </header>

            <main style={{ flex: 1, display: "flex", gap: "0" }}>
                {/* Camera & status area */}
                <div style={{ flex: 1, padding: "32px", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
                    {!connected ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", flexDirection: "column", gap: "16px" }}>
                            <div style={{ fontSize: "32px" }}>📡</div>
                            <p style={{ color: "var(--text-secondary)" }}>Connecting to exam room…</p>
                        </div>
                    ) : (
                        <>
                            {/* Camera preview */}
                            <div style={{ width: "100%", maxWidth: "480px" }}>
                                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                    📷 Your Camera
                                </div>
                                <div style={{
                                    width: "100%", aspectRatio: "4/3", background: "#0a0a12",
                                    borderRadius: "16px", overflow: "hidden",
                                    border: "1px solid var(--border)",
                                    position: "relative",
                                }}>
                                    <video
                                        ref={cameraRef}
                                        autoPlay muted playsInline
                                        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                                    />
                                    <div style={{ position: "absolute", bottom: "12px", left: "12px" }}>
                                        <span className="pill pill-success"><span className="dot dot-green" />Camera Live</span>
                                    </div>
                                </div>
                            </div>

                            {/* Status cards */}
                            <div style={{ width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                {/* Screen share */}
                                <div className="glass" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div>
                                        <div style={{ fontSize: "14px", fontWeight: 600 }}>🖥️ Screen Share</div>
                                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                                            {screenSharing ? "Your screen is visible to the monitor" : "Required for this exam"}
                                        </div>
                                    </div>
                                    {!screenSharing ? (
                                        <button id="start-screen" className="btn-primary" onClick={startScreenShare} style={{ padding: "10px 16px", fontSize: "13px" }}>
                                            Start Sharing
                                        </button>
                                    ) : (
                                        <span className="pill pill-success"><span className="dot dot-green" />Sharing</span>
                                    )}
                                </div>

                                {/* Mic status */}
                                <div className="glass" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div>
                                        <div style={{ fontSize: "14px", fontWeight: 600 }}>🎤 Microphone</div>
                                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                                            {micEnabled ? "Monitor has granted you speaking permission" : "Microphone disabled — waiting for monitor"}
                                        </div>
                                    </div>
                                    <span className={`pill ${micEnabled ? "pill-success" : "pill-muted"}`}>
                                        <span className={`dot ${micEnabled ? "dot-green" : "dot-red"}`} />
                                        {micEnabled ? "Enabled" : "Disabled"}
                                    </span>
                                </div>

                                {/* Identity */}
                                <div className="glass" style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ fontSize: "14px", fontWeight: 600 }}>👤 {username}</div>
                                    <span className="pill pill-muted">Candidate</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Chat panel (inline) */}
                {chatOpen && (
                    <div style={{
                        width: "340px",
                        borderLeft: "1px solid var(--border)",
                        display: "flex", flexDirection: "column",
                        background: "var(--bg-surface)",
                    }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: "14px" }}>
                            💬 Chat with Monitor
                        </div>
                        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                            {chatMessages.length === 0 && (
                                <p style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", marginTop: "20px" }}>
                                    No messages yet.
                                </p>
                            )}
                            {chatMessages.map((m, i) => {
                                const mine = m.from === username;
                                return (
                                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                                        <div style={{
                                            maxWidth: "85%", padding: "10px 14px",
                                            borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                                            background: mine ? "var(--accent)" : "var(--bg-card)",
                                            border: mine ? "none" : "1px solid var(--border)",
                                            fontSize: "13px",
                                        }}>
                                            {m.text}
                                        </div>
                                        <span style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "3px" }}>
                                            {mine ? "You" : "Monitor"} · {new Date(m.ts).toLocaleTimeString()}
                                        </span>
                                    </div>
                                );
                            })}
                            <div ref={chatBottomRef} />
                        </div>
                        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px" }}>
                            <input
                                id="candidate-chat-input"
                                className="input"
                                placeholder="Reply…"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && sendChat()}
                                style={{ flex: 1 }}
                            />
                            <button id="candidate-chat-send" className="btn-primary" onClick={sendChat} disabled={!chatInput.trim()} style={{ padding: "10px 14px" }}>↑</button>
                        </div>
                    </div>
                )}
            </main>

            {/* Warning overlay */}
            {warning && <WarningOverlay message={warning} onDismiss={() => setWarning(null)} />}
        </div>
    );
}
