import { validateSignature } from "@line/bot-sdk";
import { NextRequest, NextResponse } from "next/server";
import { getFaq } from "@/lib/sheet";
import { askGemini } from "@/lib/gemini";

const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

const DEFAULT_MESSAGE =
  "ขอโทษนะคะ ทางเรายังไม่มีข้อมูลในส่วนนี้ จะรีบแจ้งทีมงานของตู้ให้ทราบโดยเร็วค่ะ";

async function replyText(replyToken: string, text: string): Promise<void> {
  const res = await fetch(LINE_REPLY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_KEY}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    console.error("[line] reply failed:", res.status, await res.text());
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";
  const secret = process.env.LINE_Channel_secret ?? "";

  if (!validateSignature(rawBody, secret, signature)) {
    console.warn("[webhook] invalid signature");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { events: Array<Record<string, unknown>> };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  await Promise.all(
    body.events.map(async (event) => {
      if (
        event.type !== "message" ||
        (event.message as Record<string, unknown>)?.type !== "text"
      ) {
        return;
      }

      const replyToken = event.replyToken as string;
      const userText = (event.message as Record<string, unknown>).text as string;

      try {
        const faq = await getFaq();
        const reply = await askGemini(faq, userText);
        await replyText(replyToken, reply);
      } catch (err) {
        console.error("[webhook] error:", err);
        await replyText(replyToken, DEFAULT_MESSAGE).catch(() => {});
      }
    })
  );

  // return 200 เสมอ กัน LINE retry
  return NextResponse.json({ ok: true });
}
