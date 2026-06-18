import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase";

export type SurveyAnswers = Record<string, string | string[]>;

const TABLE = "briefing_surveys";

export interface BriefRecord {
  id: string;
  project_name: string;
  client_name: string;
  client_token: string;
  status: "pending" | "completed";
  answers?: SurveyAnswers;
  brief?: string; // brief Markdown do AI sinh
  created_at: string;
  completed_at?: string;
}

export async function listBriefs(): Promise<BriefRecord[]> {
  const sb = createServiceClient();
  const { data, error } = await sb.from(TABLE).select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BriefRecord[];
}

export async function createBrief(projectName: string, clientName: string): Promise<BriefRecord> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      client_token: randomUUID().replace(/-/g, "").slice(0, 16),
      project_name: projectName,
      client_name: clientName,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BriefRecord;
}

export async function getBriefByToken(token: string): Promise<BriefRecord | undefined> {
  const sb = createServiceClient();
  const { data } = await sb.from(TABLE).select("*").eq("client_token", token).maybeSingle();
  return (data as BriefRecord) ?? undefined;
}

export async function getBriefById(id: string): Promise<BriefRecord | undefined> {
  const sb = createServiceClient();
  const { data } = await sb.from(TABLE).select("*").eq("id", id).maybeSingle();
  return (data as BriefRecord) ?? undefined;
}

export async function deleteBrief(id: string): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  return !error;
}

// Lưu đáp án khảo sát và đánh dấu hoàn thành NGAY khi khách gửi.
// Brief (AI) sinh sau ở chế độ nền / sinh lười để khách không phải chờ Gemini.
export async function saveSurveyAnswers(
  token: string,
  answers: SurveyAnswers
): Promise<BriefRecord | undefined> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from(TABLE)
    .update({ answers, status: "completed", completed_at: new Date().toISOString() })
    .eq("client_token", token)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BriefRecord;
}

// Cập nhật riêng cột brief sau khi Gemini sinh xong (chạy nền hoặc sinh lười).
export async function setBriefById(id: string, brief: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb.from(TABLE).update({ brief }).eq("id", id);
  if (error) throw new Error(error.message);
}
