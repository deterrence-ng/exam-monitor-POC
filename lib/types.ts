export type DataMessageType =
    | { type: "mic_grant" }
    | { type: "mic_revoke" }
    | { type: "warning"; message: string }
    | { type: "chat"; message: string; from: string };

export const MONITOR_IDENTITY_PREFIX = "monitor";

export function isMonitor(identity: string) {
    return identity.toLowerCase().startsWith(MONITOR_IDENTITY_PREFIX);
}
