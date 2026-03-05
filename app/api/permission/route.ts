import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

/**
 * POST /api/permission
 * Body: { room, participantIdentity, action: "grant" | "revoke" }
 *
 * Sends a DataPacket to the specific candidate telling them to
 * enable or disable their microphone.
 */
export async function POST(req: NextRequest) {
    const { room, participantIdentity, action } = await req.json();

    if (!room || !participantIdentity || !action) {
        return NextResponse.json({ error: "room, participantIdentity and action are required" }, { status: 400 });
    }

    const svc = new RoomServiceClient(
        process.env.LIVEKIT_URL!.replace("ws://", "http://").replace("wss://", "https://"),
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!
    );

    const payload = JSON.stringify({
        type: action === "grant" ? "mic_grant" : "mic_revoke",
    });

    const encoder = new TextEncoder();
    await svc.sendData(room, encoder.encode(payload), 0, {
        destinationIdentities: [participantIdentity],
    });

    return NextResponse.json({ ok: true });
}
