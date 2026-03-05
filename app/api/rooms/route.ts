import { NextRequest, NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

export async function GET() {
    const svc = new RoomServiceClient(
        process.env.LIVEKIT_URL!.replace("ws://", "http://").replace("wss://", "https://"),
        process.env.LIVEKIT_API_KEY!,
        process.env.LIVEKIT_API_SECRET!
    );

    try {
        const rooms = await svc.listRooms();
        return NextResponse.json({ rooms });
    } catch {
        return NextResponse.json({ rooms: [] });
    }
}
