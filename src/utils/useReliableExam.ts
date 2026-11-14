import { useCallback, useEffect, useRef, useState } from "react";
import { useExamApi } from "./useExamApi";
import { useLearnOS } from "../context/LearnOSContext";
import {
  examDrafts,
  writeExamDraft,
  removeExamDraft,
  type ExamDraft,
} from "./examDrafts";
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function useReliableExam(examId: string, uid: string) {
  const api = useExamApi(),
    { refreshState } = useLearnOS(),
    clientId = useRef(crypto.randomUUID()),
    startId = useRef(crypto.randomUUID()),
    scope = uid + ":" + examId,
    key = scope + ":" + clientId.current;
  const [data, setData] = useState<any>(),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [localStatus, setLocalStatus] = useState("Qurilma nusxasi tayyorlanmoqda"),
    [serverStatus, setServerStatus] = useState("Server tasdig‘i yo‘q"),
    [conflict, setConflict] = useState(false),
    [recovered, setRecovered] = useState<ExamDraft>(),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<any>();
  const current = useRef<any>(undefined),
    values = useRef<Record<string, string>>({}),
    ack = useRef<Record<string, string>>({}),
    pending = useRef<any>(undefined),
    intent = useRef<any>(undefined),
    events = useRef<any[]>([]),
    inFlight = useRef<Promise<boolean> | null>(null),
    localQueue = useRef(Promise.resolve()),
    finishLock = useRef(false),
    retryDelay = useRef(1500),
    nextRetry = useRef(0),
    alive = useRef(true),
    conflictRef = useRef(false),
    wake = useRef<() => Promise<any>>(async () => {});
  const update = (v: any) => {
    const old = current.current;
    if ((old?.session.stateVersion || 0) > (v.session.stateVersion || 0))
      return;
    if (old?.session.epoch > v.session.epoch) return;
    if (
      old?.session.epoch === v.session.epoch &&
      old.session.revision > v.session.revision
    )
      v = {
        ...v,
        session: {
          ...v.session,
          answers: old.session.answers,
          revision: old.session.revision,
        },
      };
    if (old?.session.receipt)
      v = {
        ...v,
        session: {
          ...v.session,
          receipt: old.session.receipt,
          submittedAttemptId: old.session.submittedAttemptId,
        },
      };
    v.offset = v.serverNow - Date.now();
    current.current = v;
    setData(v);
    if (v.session.receipt) {
      setReceipt(v.session.receipt);
      setBusy(false);
    }
    if (!v.canWrite && !v.session.receipt) {
      setConflict(true);
      conflictRef.current = true;
    }
  };
  const persist = useCallback(async () => {
    const row: ExamDraft = {
      key,
      scope,
      clientId: clientId.current,
      answers: structuredClone(values.current),
      updatedAt: Date.now(),
      pending: pending.current,
      finish: intent.current,
      events: structuredClone(events.current),
    };
    localQueue.current = localQueue.current
      .catch(() => {})
      .then(async () => {
        await writeExamDraft(row);
        if (alive.current) setLocalStatus("Qurilmada saqlandi");
      })
      .catch(() => {
        if (alive.current)
          setLocalStatus("Qurilmaga saqlanmadi — xotirani tekshiring");
      });
    await localQueue.current;
  }, [key, scope]);
  const issue = (e: any) => {
    if (!alive.current) return;
    setError(e.message);
    setServerStatus("Server tasdig‘i kutilmoqda");
    if (["WINDOW_CONFLICT", "REVISION_CONFLICT"].includes(e.code)) {
      setConflict(true);
      conflictRef.current = true;
    }
    nextRetry.current =
      Date.now() + (e.code === "QUOTA_EXHAUSTED" ? 60000 : retryDelay.current);
    retryDelay.current = Math.min(30000, retryDelay.current * 2);
  };
  const start = async () => {
    setBusy(true);
    try {
      const d = await api(`/api/exams/${examId}/start-v2`, "POST", {
        operationId: startId.current,
        clientId: clientId.current,
      });
      update(d);
      values.current = { ...d.session.answers };
      ack.current = { ...d.session.answers };
      setAnswers(values.current);
      setServerStatus("Serverdagi nusxa ochildi");
      const drafts = await examDrafts(scope).catch(() => {
        setLocalStatus("Qurilma nusxasi ochilmadi");
        return [];
      });
      events.current = [
        ...new Map(
          drafts.flatMap((r) => r.events || []).map((e) => [e.operationId, e]),
        ).values(),
      ];
      const saved = drafts.find((r) => !same(r.answers, d.session.answers));
      if (saved) setRecovered(saved);
      await persist();
      setError("");
    } catch (e) {
      issue(e);
    } finally {
      setBusy(false);
    }
  };
  const edit = useCallback(
    (
      next:
        | Record<string, string>
        | ((old: Record<string, string>) => Record<string, string>),
    ) => {
      values.current = typeof next === "function" ? next(values.current) : next;
      setAnswers(values.current);
      setLocalStatus("Qurilmaga yozilmoqda…");
      setServerStatus("Serverga yuborish kutilmoqda");
      void persist();
    },
    [persist],
  );
  const flush = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return inFlight.current;
    if (
      !current.current ||
      conflictRef.current ||
      current.current.session.receipt ||
      current.current.state === "review_required"
    )
      return false;
    const task = (async () => {
      if (!pending.current && !same(values.current, ack.current)) {
        pending.current = {
          operationId: crypto.randomUUID(),
          clientId: clientId.current,
          epoch: current.current.session.epoch,
          revision: current.current.session.revision,
          answers: structuredClone(values.current),
        };
        await persist();
      }
      if (!pending.current) return true;
      const packet = pending.current;
      try {
        setServerStatus("Serverga yuborilmoqda…");
        const d = await api(`/api/exams/${examId}/session-v2`, "PUT", packet);
        if (!d.canWrite) {
          issue({
            code: "WINDOW_CONFLICT",
            message: "Boshqa oyna boshqaruvni oldi. Mahalliy nusxa saqlangan.",
          });
          return false;
        }
        ack.current = { ...packet.answers };
        pending.current = undefined;
        update(d);
        retryDelay.current = 1500;
        nextRetry.current = 0;
        setError("");
        setServerStatus(
          same(values.current, ack.current)
            ? "Serverga saqlandi"
            : "Keyingi javob yuborilishi kutilmoqda",
        );
        await persist();
        return true;
      } catch (e) {
        if ([400, 413].includes((e as any).status)) {
          pending.current = undefined;
          intent.current = undefined;
          await persist();
        }
        issue(e);
        return false;
      }
    })();
    inFlight.current = task;
    try {
      return await task;
    } finally {
      inFlight.current = null;
    }
  }, [api, examId, persist]);
  const draining = useRef<Promise<void> | null>(null);
  const drain = async () => {
    if (draining.current) return draining.current;
    const task = (async () => {
      while (events.current.length) {
        const packet = events.current[0];
        const d = await api(`/api/exams/${examId}/exit-v2`, "POST", packet);
        if (events.current[0]?.operationId === packet.operationId)
          events.current.shift();
        update(d);
        await persist();
      }
    })();
    draining.current = task;
    try {
      await task;
    } finally {
      if (draining.current === task) draining.current = null;
    }
  };
  const finish = async (automatic = false) => {
    if (
      finishLock.current ||
      !current.current ||
      conflictRef.current ||
      current.current.state === "review_required" ||
      current.current.session.receipt
    )
      return;
    finishLock.current = true;
    setBusy(true);
    intent.current ||= {
      operationId: crypto.randomUUID(),
      clientId: clientId.current,
      epoch: current.current.session.epoch,
    };
    await persist();
    try {
      await drain();
      if (current.current.state === "review_required") return;
      const expired =
        Date.now() + current.current.offset >= current.current.deadline;
      if (!automatic && !expired) {
        const ok = await flush();
        if (!ok || !same(values.current, ack.current)) {
          setError(
            "Topshirish kutilmoqda. Javoblar avval serverga tasdiqlanadi; aloqa tiklanganda davom etadi.",
          );
          return;
        }
      }
      const r = await api(
        `/api/exams/${examId}/finish-v2`,
        "POST",
        intent.current,
      );
      await refreshState().catch(() => {});
      setReceipt(r.receipt);
      current.current.session.receipt = r.receipt;
      current.current.session.submittedAttemptId = r.receipt.attemptId;
      setData({ ...current.current });
      setServerStatus("Yakuniy topshirish serverda tasdiqlandi");
      setError("");
      if (same(values.current, ack.current))
        await removeExamDraft(key).catch(() => {});
      else await persist();
      intent.current = undefined;
    } catch (e) {
      issue(e);
    } finally {
      setBusy(false);
      finishLock.current = false;
    }
  };
  const event = async (kind: string) => {
    if (
      !current.current ||
      current.current.session.receipt ||
      conflictRef.current
    )
      return;
    events.current.push({
      operationId: crypto.randomUUID(),
      clientId: clientId.current,
      epoch: current.current.session.epoch,
      kind,
      observedAt: new Date().toISOString(),
    });
    events.current = events.current.slice(-100);
    await persist();
    void wake.current();
  };
  const takeover = async (useLocal: boolean) => {
    if (!current.current) return;
    setBusy(true);
    try {
      const fresh = await api(
        `/api/exams/${examId}/session-v2?clientId=${clientId.current}`,
      );
      const d = await api(`/api/exams/${examId}/takeover-v2`, "POST", {
        operationId: crypto.randomUUID(),
        clientId: clientId.current,
        epoch: fresh.session.epoch,
        revision: fresh.session.revision,
      });
      conflictRef.current = false;
      setConflict(false);
      pending.current = undefined;
      intent.current = undefined;
      update(d);
      ack.current = { ...d.session.answers };
      if (!useLocal && !same(values.current, d.session.answers))
        await writeExamDraft({
          key: key + ":conflict-" + Date.now(),
          scope,
          clientId: clientId.current,
          answers: structuredClone(values.current),
          updatedAt: Date.now(),
        }).catch(() => {});
      if (!useLocal) {
        values.current = { ...d.session.answers };
        setAnswers(values.current);
      }
      setError("");
      await persist();
    } catch (e) {
      issue(e);
    } finally {
      setBusy(false);
    }
  };
  const explain = async (reason: string) => {
    if (!current.current) return;
    try {
      await api(`/api/exams/${examId}/explanation-v2`, "POST", {
        operationId: crypto.randomUUID(),
        clientId: clientId.current,
        epoch: current.current.session.epoch,
        reason,
        answers: values.current,
      });
      setNotice(
        "Izoh va qurilma nusxasi ustoz ko‘rigi uchun serverga saqlandi.",
      );
      setError("");
    } catch (e) {
      issue(e);
    }
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => {
      if (!intent.current) void flush();
    }, 900);
    return () => clearTimeout(t);
  }, [answers, data?.session.id, flush]);
  useEffect(() => {
    if (!data) return;
    let polling = false;
    const tick = async () => {
      if (polling || document.hidden) return;
      polling = true;
      try {
        const d = await api(
          `/api/exams/${examId}/session-v2?clientId=${clientId.current}`,
        );
        if (!inFlight.current && !pending.current) {
          update(d);
          if (!conflictRef.current && same(values.current, ack.current)) {
            values.current = d.session.answers;
            ack.current = d.session.answers;
            setAnswers(values.current);
          }
        } else if (!d.canWrite) {
          update(d);
        } else {
          current.current = {
            ...current.current,
            deadline: d.deadline,
            serverNow: d.serverNow,
            state: d.state,
            offset: d.serverNow - Date.now(),
          };
          setData({ ...current.current });
        }
      } catch (e) {
        issue(e);
      } finally {
        polling = false;
      }
    };
    const t = setInterval(() => void tick(), 8000);
    return () => clearInterval(t);
  }, [data?.session.id, api, examId]);
  wake.current = async () => {
    if (
      !current.current ||
      conflictRef.current ||
      !navigator.onLine ||
      current.current.session.receipt
    )
      return;
    if (Date.now() < nextRetry.current) return;
    try {
      await drain();
    } catch (e) {
      issue(e);
      return;
    }
    if (intent.current) await finish();
    else if (pending.current || !same(values.current, ack.current))
      await flush();
  };
  useEffect(() => {
    const online = () => {
      nextRetry.current = 0;
      void wake.current();
    };
    window.addEventListener("online", online);
    const t = setInterval(() => void wake.current(), 2000);
    return () => {
      window.removeEventListener("online", online);
      clearInterval(t);
    };
  }, []);
  return {
    data,
    answers,
    edit,
    start,
    flush,
    finish,
    event,
    takeover,
    explain,
    receipt,
    busy,
    submitting: !!intent.current,
    error,
    notice,
    localStatus,
    serverStatus,
    conflict,
    recovered,
    restore: () => {
      if (recovered) {
        edit(recovered.answers);
        setRecovered(undefined);
      }
    },
    dismissRecovery: () => setRecovered(undefined),
    unsent: !same(values.current, ack.current),
  };
}
