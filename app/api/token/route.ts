import { NextRequest, NextResponse } from "next/server";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const room = searchParams.get("room");
    const username = searchParams.get("username");
    const role = searchParams.get("role"); // "monitor" | "candidate"

    if (!room || !username || !role) {
        return NextResponse.json(
            { error: "room, username and role are required" },
            { status: 400 }
        );
    }

    const apiKey = process.env.LIVEKIT_API_KEY!;
    const apiSecret = process.env.LIVEKIT_API_SECRET!;

    const at = new AccessToken(apiKey, apiSecret, {
        identity: username,
        ttl: 3600,
        metadata: JSON.stringify({ role }),
    });

    if (role === "monitor") {
        at.addGrant({
            roomJoin: true,
            room,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });
    } else {
        // candidate – can publish camera+screen, can subscribe to monitor only,
        // mic will be muted client-side by default
        at.addGrant({
            roomJoin: true,
            room,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });
    }

    const token = await at.toJwt();
    return NextResponse.json({ token });
}
