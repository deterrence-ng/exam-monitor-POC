"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState<"monitor" | "candidate">("candidate");
  const [room, setRoom] = useState("exam-room-1");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = () => {
    if (!name.trim() || !room.trim()) return;
    setLoading(true);
    if (role === "monitor") {
      router.push(`/monitor/${encodeURIComponent(room)}?username=${encodeURIComponent(name)}`);
    } else {
      router.push(`/candidate/${encodeURIComponent(room)}?username=${encodeURIComponent(name)}`);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: `radial-gradient(ellipse at 60% 20%, rgba(99,102,241,0.08) 0%, transparent 60%), var(--bg-primary)`,
    }}>
      {/* Logo / Title */}
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "12px",
            background: "linear-gradient(135deg, #6366f1, #818cf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "22px", boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
          }}>🎓</div>
          <span style={{ fontSize: "28px", fontWeight: 700, letterSpacing: "-0.02em" }}>e-monitor</span>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
          Secure real-time exam proctoring
        </p>
      </div>

      {/* Card */}
      <div className="glass" style={{ width: "100%", maxWidth: "440px", padding: "36px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "24px" }}>Join Session</h2>

        {/* Role selector */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{
            display: "block", fontSize: "12px",
            fontWeight: 600, color: "var(--text-secondary)",
            marginBottom: "10px", textTransform: "uppercase",
            letterSpacing: "0.06em"
          }}>
            Your Role
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {(["candidate", "monitor"] as const).map((r) => (
              <button
                key={r}
                id={`role-${r}`}
                onClick={() => setRole(r)}
                style={{
                  padding: "14px",
                  borderRadius: "10px",
                  border: `2px solid ${role === r ? "var(--accent)" : "var(--border)"}`,
                  background: role === r ? "var(--accent-glow)" : "var(--bg-surface)",
                  color: role === r ? "var(--accent-hover)" : "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                  transition: "all 0.2s",
                  textTransform: "capitalize",
                }}
              >
                {r === "candidate" ? "🎓 Candidate" : "🖥️ Monitor"}
              </button>
            ))}
          </div>
        </div>

        {/* Room name */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            display: "block", fontSize: "12px",
            fontWeight: 600, color: "var(--text-secondary)",
            marginBottom: "8px", textTransform: "uppercase",
            letterSpacing: "0.06em"
          }}>
            Room Name
          </label>
          <input
            id="input-room"
            className="input"
            type="text"
            placeholder="e.g. exam-room-1"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
        </div>

        {/* Display name */}
        <div style={{ marginBottom: "28px" }}>
          <label style={{
            display: "block", fontSize: "12px",
            fontWeight: 600, color: "var(--text-secondary)",
            marginBottom: "8px", textTransform: "uppercase",
            letterSpacing: "0.06em"
          }}>
            Display Name
          </label>
          <input
            id="input-name"
            className="input"
            type="text"
            placeholder={role === "monitor" ? "Monitor" : "Your full name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
        </div>

        <button
          id="btn-join"
          className="btn-primary"
          style={{ width: "100%", padding: "14px" }}
          onClick={handleJoin}
          disabled={!name.trim() || !room.trim() || loading}
        >
          {loading ? "Joining…" : `Join as ${role === "monitor" ? "Monitor" : "Candidate"} →`}
        </button>

        <p style={{ marginTop: "16px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
          {role === "monitor"
            ? "You will supervise the exam room and control participants."
            : "Your camera and screen will be shared with the monitor."}
        </p>
      </div>

      <p style={{ marginTop: "24px", fontSize: "12px", color: "var(--text-muted)" }}>
        Powered by LiveKit · Local Dev Mode
      </p>
    </div>
  );
}
