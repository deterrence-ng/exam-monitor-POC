import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

/**
 * POST /api/kickout
 * Body: { room: string, participantIdentity: string }
 *
 * Forces a participant to disconnect from the LiveKit room.
 */
export async function POST(req: NextRequest) {
    try {
        const { room, participantIdentity } = await req.json();

        if (!room || !participantIdentity) {
            return NextResponse.json({ error: "room and participantIdentity are required" }, { status: 400 });
        }

        const svc = new RoomServiceClient(
            process.env.LIVEKIT_URL!.replace("ws://", "http://").replace("wss://", "https://"),
            process.env.LIVEKIT_API_KEY!,
            process.env.LIVEKIT_API_SECRET!
        );

        await svc.removeParticipant(room, participantIdentity);
        
        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("Failed to kick participant", error);
        return NextResponse.json({ error: error.message || "Failed to kick participant" }, { status: 500 });
    }
}
