"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SURVEY_SECTIONS } from "@/lib/briefing-survey";

type Step = "loading" | "error" | "welcome" | "form" | "submitting" | "done";
type Answers = Record<string, string | string[]>;

const TOTAL_QUESTIONS = SURVEY_SECTIONS.reduce((n, s) => n + s.questions.length, 0);

export default function ClientBriefPage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>("loading");
  const [project, setProject] = useState<{ project_name: string; client_name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});

  useEffect(() => {
    fetch(`/api/briefing/projects/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          setStep("error");
          return;
        }
        if (d.completed) {
          setStep("done");
          return;
        }
        setProject(d.project);
        setStep("welcome");
      })
      .catch(() => {
        setError("Không thể tải khảo sát");
        setStep("error");
      });
  }, [token]);

  function setSingle(qid: string, val: string) {
    setAnswers((a) => ({ ...a, [qid]: val }));
  }
  function toggleMulti(qid: string, val: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[qid]) ? (a[qid] as string[]) : [];
      return { ...a, [qid]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] };
    });
  }

  const answered = Object.values(answers).filter(
    (v) => v && (!Array.isArray(v) || v.length > 0)
  ).length;

  async function submit() {
    setStep("submitting");
    setError(null);
    try {
      const res = await fetch(`/api/briefing/projects/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Gửi thất bại");
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gửi thất bại");
      setStep("form");
    }
  }

  if (step === "loading") {
    return <div className="flex min-h-screen items-center justify-center text-stone-500">Đang tải...</div>;
  }

  if (step === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-lg text-stone-300">{error ?? "Đường link không hợp lệ"}</p>
        <p className="text-sm text-stone-600">Vui lòng liên hệ kiến trúc sư để nhận link mới.</p>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">✓</div>
        <h2 className="text-2xl font-semibold">Cảm ơn bạn!</h2>
        <p className="leading-relaxed text-stone-400">
          Chúng tôi đã nhận được khảo sát của bạn. Kiến trúc sư sẽ liên hệ lại sớm cùng bản brief thiết kế được cá nhân hoá.
        </p>
      </div>
    );
  }

  if (step === "welcome") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-7 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-800 text-3xl">🏡</div>
        <div>
          <h1 className="mb-2 text-2xl font-semibold">Chào {project?.client_name}!</h1>
          <p className="leading-relaxed text-stone-400">
            Khảo sát này giúp kiến trúc sư hiểu rõ nhu cầu &amp; phong cách của bạn cho dự án{" "}
            <strong className="text-stone-200">{project?.project_name}</strong>. Mất khoảng{" "}
            <strong className="text-stone-200">5 phút</strong>.
          </p>
        </div>
        <div className="w-full rounded-2xl border border-stone-800 bg-stone-900 p-4 text-left text-sm text-stone-400">
          Gồm <strong className="text-stone-200">{SURVEY_SECTIONS.length} phần</strong> ·{" "}
          {TOTAL_QUESTIONS} câu hỏi. Chọn đáp án phù hợp nhất — có thể bỏ qua câu chưa chắc.
        </div>
        <button
          onClick={() => setStep("form")}
          className="w-full rounded-2xl bg-stone-200 py-4 text-base font-semibold text-stone-900 transition-colors hover:bg-white"
        >
          Bắt đầu khảo sát →
        </button>
      </div>
    );
  }

  // step === "form" | "submitting"
  const submitting = step === "submitting";
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-28 sm:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Khảo sát nhu cầu thiết kế</h1>
        <p className="mt-1 text-sm text-stone-500">
          {project?.project_name} · {project?.client_name}
        </p>
      </div>

      <div className="space-y-8">
        {SURVEY_SECTIONS.map((section) => (
          <section key={section.id}>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-stone-200">
              <span>{section.icon}</span>
              {section.title}
            </h2>
            <div className="space-y-5">
              {section.questions.map((q) => (
                <div key={q.id}>
                  <label className="mb-2 block text-sm text-stone-300">
                    {q.label}
                    {q.optional && <span className="ml-1 text-xs text-stone-600">(tuỳ chọn)</span>}
                  </label>

                  {q.type === "text" ? (
                    <textarea
                      rows={2}
                      value={(answers[q.id] as string) ?? ""}
                      onChange={(e) => setSingle(q.id, e.target.value)}
                      placeholder={q.placeholder}
                      className="w-full resize-y rounded-xl border border-stone-700 bg-stone-900 px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-600 focus:border-stone-500 focus:outline-none"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {q.options?.map((opt) => {
                        const selected =
                          q.type === "single"
                            ? answers[q.id] === opt
                            : Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => (q.type === "single" ? setSingle(q.id, opt) : toggleMulti(q.id, opt))}
                            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                              selected
                                ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                                : "border-stone-700 bg-stone-900 text-stone-400 hover:border-stone-500 hover:text-stone-200"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {/* Thanh gửi cố định dưới */}
      <div className="fixed inset-x-0 bottom-0 border-t border-stone-800 bg-stone-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="text-xs text-stone-500">
            Đã trả lời {answered}/{TOTAL_QUESTIONS}
          </span>
          <button
            onClick={submit}
            disabled={submitting || answered === 0}
            className="rounded-xl bg-stone-200 px-6 py-2.5 text-sm font-semibold text-stone-900 transition-colors hover:bg-white disabled:opacity-40"
          >
            {submitting ? "Đang gửi..." : "Gửi khảo sát"}
          </button>
        </div>
      </div>
    </div>
  );
}
