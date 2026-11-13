import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExamApi } from "../utils/useExamApi";
import { useLearnOS } from "../context/LearnOSContext";
import { Button, Card, EmptyState, Skeleton } from "./DesignSystem";
export function SchoolNotifications() {
  const api = useExamApi(),
    navigate = useNavigate(),
    { currentUser } = useLearnOS(),
    [data, setData] = useState<any>(),
    [page, setPage] = useState(0),
    [version, setVersion] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const prefix =
    currentUser?.role === "student"
      ? "student"
      : currentUser?.role === "teacher"
        ? "teacher"
        : "admin";
  useEffect(() => {
    let live = true;
    api("/api/workspace/notifications?page=" + page)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api, page, version]);
  const read = async (id?: string) => {
    setBusy(true);
    setError("");
    try {
      await api("/api/workspace/notifications/read", "POST", {
        operationId: crypto.randomUUID(),
        id,
        all: !id,
      });
      setVersion((v) => v + 1);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold">Bildirishnomalar</h1>
      {error && <Card role="alert">{error}</Card>}
      {!data ? (
        <Skeleton />
      ) : (
        <>
          <div className="flex flex-wrap justify-between gap-3">
            <p className="text-sm text-slate-500">
              {data.unread} o‘qilmagan · {data.total} jami
            </p>
            <Button
              busy={busy}
              disabled={!data.unread}
              onClick={() => void read()}
            >
              Hammasi o‘qildi
            </Button>
          </div>
          {data.rows.map((n: any) => (
            <Card
              key={n.id}
              className={n.read ? "opacity-80" : "border-blue-300"}
            >
              <h2 className="font-bold">{n.title}</h2>
              <p className="mt-2 text-sm leading-7">{n.message}</p>
              <p className="my-3 text-xs text-slate-500">
                {new Date(n.createdAt).toLocaleString("uz-UZ", {
                  timeZone: "Asia/Tashkent",
                })}
              </p>
              <button
                className="ss-secondary"
                disabled={busy}
                onClick={async () => {
                  if (await read(n.id)) {
                    if (
                      n.link?.startsWith("/" + prefix + "/") ||
                      n.link === "/account/security"
                    )
                      navigate(n.link);
                  }
                }}
              >
                Shaxsiy bo‘limda ochish
              </button>
            </Card>
          ))}
          {!data.total && (
            <EmptyState title="Hozircha xabar yo‘q">
              Sizga tegishli o‘quv va ish xabarlari shu yerda ko‘rinadi.
            </EmptyState>
          )}
          <div className="flex justify-between">
            <button
              className="ss-secondary"
              disabled={!page}
              onClick={() => setPage((p) => p - 1)}
            >
              Oldingi
            </button>
            <span className="text-sm">
              {page + 1}/{Math.max(1, Math.ceil(data.total / 20))}
            </span>
            <button
              className="ss-secondary"
              disabled={(page + 1) * 20 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Keyingi
            </button>
          </div>
        </>
      )}
    </main>
  );
}
