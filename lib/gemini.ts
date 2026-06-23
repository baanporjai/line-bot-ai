import { GoogleGenAI } from "@google/genai";

const DEFAULT_MESSAGE =
  "ขอโทษนะคะ ทางเรายังไม่มีข้อมูลในส่วนนี้ จะรีบแจ้งทีมงานของตู้ให้ทราบโดยเร็วค่ะ";

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
  return _ai;
}

export async function askGemini(faq: string, question: string): Promise<string> {
  const prompt = `<role>
คุณคือน้องส้ม ผู้ช่วยอัจฉริยะของตู้น้ำส้มคั้นสดอัตโนมัติ O'Fresh
</role>

<constraints>
- ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น
- ห้ามแต่งราคา เวลา หรือที่ตั้งเอง
- ถ้าไม่มีข้อมูลใน FAQ ให้ตอบ default message เท่านั้น ห้ามเดา
- default message = "${DEFAULT_MESSAGE}"
- โทน: สุภาพ เป็นทางการ ใช้ emoji ได้นิดหน่อย
- ความยาว: 1-3 ประโยค
</constraints>

<output_format>
- ภาษาไทยเท่านั้น
- ไม่ใช้ markdown (ไม่มี ** ## -)
</output_format>

<faq>
${faq}
</faq>

<question>
${question}
</question>`;

  try {
    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 1.0,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    const thoughtsTokenCount = response.usageMetadata?.thoughtsTokenCount ?? 0;
    const candidatesTokenCount = response.usageMetadata?.candidatesTokenCount ?? 0;

    console.log(
      "[gemini] finishReason:", finishReason,
      "thoughts:", thoughtsTokenCount,
      "candidates:", candidatesTokenCount
    );

    if (finishReason === "MAX_TOKENS") {
      console.warn("[gemini] MAX_TOKENS — using default message");
      return DEFAULT_MESSAGE;
    }

    return response.text ?? DEFAULT_MESSAGE;
  } catch (err) {
    console.error("[gemini] error:", err);
    return DEFAULT_MESSAGE;
  }
}
