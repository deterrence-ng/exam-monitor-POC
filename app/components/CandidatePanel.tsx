"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RemoteParticipant, Track, TrackPublication } from "livekit-client";

interface CandidatePanelProps {
    participant: RemoteParticipant;
    room: string;
    micEnabled: boolean;
    onToggleMic: () => void;
    onWarn: () => void;
    onChat: () => void;
    onTarget: () => void;
    hasUnread?: boolean;
    isTarget?: boolean;
    micRequested?: boolean;
}

export default function CandidatePanel({
    participant,
    room,
    micEnabled,
    onToggleMic,
    onWarn,
    onChat,
    onTarget,
    hasUnread,
    isTarget,
    micRequested,
}: CandidatePanelProps) {
    const cameraRef = useRef<HTMLVideoElement>(null);
    const screenRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [cameraTrack, setCameraTrack] = useState<TrackPublication | null>(null);
    const [screenTrack, setScreenTrack] = useState<TrackPublication | null>(null);
    const [audioTrack, setAudioTrack] = useState<TrackPublication | null>(null);
    const [speaking, setSpeaking] = useState(false);

    // Rebuilds track state from scratch each call — handles both subscribe AND unsubscribe
    const syncTracks = useCallback(() => {
        let cam: TrackPublication | null = null;
        let screen: TrackPublication | null = null;
        let audio: TrackPublication | null = null;

        for (const pub of participant.trackPublications.values()) {
            // pub.track is non-null only when the local client is subscribed to the track
            if (!pub.track) continue;
            if (pub.kind === "video") {
                if (pub.source === Track.Source.Camera) cam = pub;
                if (pub.source === Track.Source.ScreenShare) screen = pub;
            } else if (pub.kind === "audio") {
                audio = pub;
            }
        }

        setCameraTrack(cam);
        setScreenTrack(screen);
        setAudioTrack(audio);
    }, [participant]);

    useEffect(() => {
        syncTracks();
        participant.on("trackSubscribed", syncTracks);
        participant.on("trackUnsubscribed", syncTracks);
        participant.on("isSpeakingChanged", (s: boolean) => setSpeaking(s));
        return () => {
            participant.off("trackSubscribed", syncTracks);
            participant.off("trackUnsubscribed", syncTracks);
        };
    }, [participant, syncTracks]);

    // Attach camera video
    useEffect(() => {
        if (cameraTrack?.videoTrack && cameraRef.current) {
            cameraTrack.videoTrack.attach(cameraRef.current);
            return () => { cameraTrack.videoTrack?.detach(); };
        }
    }, [cameraTrack]);

    // Attach screen share video
    useEffect(() => {
        if (screenTrack?.videoTrack && screenRef.current) {
            screenTrack.videoTrack.attach(screenRef.current);
            return () => { screenTrack.videoTrack?.detach(); };
        }
    }, [screenTrack]);

    // Attach audio — element must NOT be muted
    useEffect(() => {
        if (audioTrack?.audioTrack && audioRef.current) {
            audioTrack.audioTrack.attach(audioRef.current);
            return () => { audioTrack.audioTrack?.detach(); };
        }
    }, [audioTrack]);

    return (
        <div style={{
            background: "var(--bg-card)",
            border: speaking ? "1px solid var(--success)" : "1px solid var(--border)",
            borderRadius: "16px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            transition: "border-color 0.3s",
            boxShadow: speaking ? "0 0 20px rgba(34,197,94,0.15)" : "var(--shadow-card)",
        }}>
            {/* Hidden audio element — NOT muted, used to play candidate mic audio */}
            <audio ref={audioRef} autoPlay style={{ display: "none" }} />

            {/* Screen share — primary view */}
            <div style={{ position: "relative", aspectRatio: "16/9", background: "#0a0a12" }}>
                {screenTrack ? (
                    <video
                        ref={screenRef}
                        autoPlay muted playsInline
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                ) : (
                    <div style={{
                        width: "100%", height: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--text-muted)", fontSize: "13px", flexDirection: "column", gap: "8px",
                    }}>
                        <span style={{ fontSize: "24px", opacity: 0.4 }}>🖥️</span>
                        <span>No screen share</span>
                    </div>
                )}

                {/* Camera pip */}
                <div style={{
                    position: "absolute", bottom: "10px", right: "10px",
                    width: "100px", height: "75px",
                    background: "#000",
                    borderRadius: "8px",
                    overflow: "hidden",
                    border: "2px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
                }}>
                    {cameraTrack ? (
                        <video ref={cameraRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🎓</div>
                    )}
                </div>

                {/* Speaking indicator */}
                {speaking && (
                    <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                        <span className="pill pill-success"><span className="dot dot-green" />Speaking</span>
                    </div>
                )}
            </div>

            {/* Controls footer */}
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: "8px", borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {participant.identity}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                        <span className={`pill ${micEnabled ? "pill-success" : "pill-muted"}`}>
                            <span className={`dot ${micEnabled ? "dot-green" : "dot-red"}`} />
                            {micEnabled ? "Mic On" : "Mic Off"}
                        </span>
                        {micRequested && !micEnabled && (
                            <span style={{ fontSize: "11px", color: "var(--accent)", fontStyle: "italic", animation: "pulse 1.5s infinite" }}>
                                Hand raised ✋
                            </span>
                        )}
                    </div>
                </div>

                <button
                    id={`warn-${participant.identity}`}
                    className="btn-danger"
                    onClick={onWarn}
                    style={{ padding: "7px 12px", fontSize: "11px" }}
                    title="Send warning"
                >
                    ⚠️
                </button>

                <button
                    id={`target-${participant.identity}`}
                    className={isTarget ? "btn-success" : "btn-ghost"}
                    onClick={onTarget}
                    style={{ padding: "7px 12px", fontSize: "11px", fontWeight: isTarget ? 600 : 400 }}
                    title={isTarget ? "Currently talking to candidate" : "Talk to this candidate"}
                >
                    {isTarget ? "🗣️ Talking" : "🗣️ Talk"}
                </button>

                <button
                    id={`mic-${participant.identity}`}
                    className={micEnabled ? "btn-danger" : (micRequested ? "btn-primary" : "btn-success")}
                    onClick={onToggleMic}
                    style={{ padding: "7px 12px", fontSize: "11px", position: "relative" }}
                    title={micEnabled ? "Revoke mic" : "Grant mic"}
                >
                    {micEnabled ? "🔇" : "🎤"}
                    {micRequested && !micEnabled && (
                        <span style={{
                            position: "absolute", top: "-4px", right: "-4px",
                            width: "10px", height: "10px",
                            background: "var(--accent)",
                            borderRadius: "50%",
                            border: "2px solid var(--bg-card)",
                        }} />
                    )}
                </button>

                <button
                    id={`chat-${participant.identity}`}
                    className="btn-ghost"
                    onClick={onChat}
                    style={{ padding: "7px 12px", fontSize: "11px", position: "relative" }}
                    title="Open chat"
                >
                    💬
                    {hasUnread && (
                        <span style={{
                            position: "absolute", top: "4px", right: "4px",
                            width: "8px", height: "8px",
                            background: "var(--accent)",
                            borderRadius: "50%",
                        }} />
                    )}
                </button>
            </div>
        </div>
    );
}
