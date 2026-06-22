import { getGeminiModel } from "@/lib/gemini";
import { systemPrompt } from "@/lib/prompts/system";
import { legalPrompt } from "@/lib/prompts/legal";
import { geminiErrorCode, geminiErrorMessage } from "@/lib/gemini-error";
import { getProvider } from "@/lib/ai-models";
import {
  deepseekStreamText,
  deepseekErrorCode,
  deepseekErrorMessage,
} from "@/lib/deepseek";

export async function POST(req: Request) {
  const { messages, mode, model } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Thiếu tin nhắn" }, { status: 400 });
  }

  const system = mode === "legal" ? legalPrompt : systemPrompt;

  // DeepSeek: API tương thích OpenAI, stream về text thuần như Gemini.
  if (getProvider(model) === "deepseek") {
    try {
      const stream = await deepseekStreamText({
        model,
        system,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } catch (error) {
      console.error("DeepSeek chat error:", error);
      return Response.json(
        { error: deepseekErrorMessage(error), code: deepseekErrorCode(error) },
        { status: 502 }
      );
    }
  }

  const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1].content as string;

  let result;
  try {
    const chat = getGeminiModel(model).startChat({
      systemInstruction: {
        role: "system",
        parts: [{ text: system }],
      },
      history,
    });
    result = await chat.sendMessageStream(lastMessage);
  } catch (error) {
    console.error("Gemini error:", error);
    return Response.json(
      { error: geminiErrorMessage(error), code: geminiErrorCode(error) },
      { status: 502 }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(new TextEncoder().encode(text));
        }
      } catch (error) {
        console.error("Gemini stream error:", error);
        controller.enqueue(new TextEncoder().encode(`\n\n${geminiErrorMessage(error)}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
