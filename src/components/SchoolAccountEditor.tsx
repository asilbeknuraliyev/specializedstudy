import {useUnsavedChanges} from '../utils/useUnsavedChanges';
import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useExamApi } from "../utils/useExamApi";
import { Button, Card, Input, Select, Skeleton, Toast } from "./DesignSystem";
export function SchoolAccountEditor() {
  const { id } = useParams(),
    api = useExamApi(),
    [data, setData] = useState<any>(),
    [form, setForm] = useState<any>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    op = useRef<{ sig: string; id: string } | undefined>(undefined);
  useUnsavedChanges(!!form&&!!data&&JSON.stringify(form)!==JSON.stringify({...data.user,reason:''}));
  useEffect(() => {
    let live = true;
    api("/api/school-admin/accounts/" + encodeURIComponent(id || ""))
      .then((d) => {
        if (live) {
          setData(d);
          setForm({ ...d.user, reason: "" });
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [api, id]);
  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <Link className="ss-secondary" to="/admin/accounts">
        ← Hisoblar
      </Link>
      <h1 className="text-3xl font-bold">Profil va biriktirish</h1>
      {error && (
        <Card role="alert">
          {error}
          <p className="mt-2 text-sm">
            Yozganlaringiz saqlanib turibdi. Parallel o‘zgarishda server
            holatini yangi oynada tekshiring.
          </p>
        </Card>
      )}
      {saved && (
        <Toast>Profil saqlandi. Eski kirish sessiyalari bekor qilindi.</Toast>
      )}
      {!form ? (
        <Skeleton />
      ) : (
        <Card>
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              setSaved(false);
              const { id, role, status, ...body } = form,
                sig = JSON.stringify(body);
              if (op.current?.sig !== sig)
                op.current = { sig, id: crypto.randomUUID() };
              try {
                const r = await api(
                  "/api/school-admin/accounts/" + data.user.id,
                  "POST",
                  { ...body, operationId: op.current.id },
                );
                op.current = undefined;
                const next = await api(
                  "/api/school-admin/accounts/" + data.user.id,
                );
                setData(next);
                setForm({ ...next.user, reason: "" });
                setSaved(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm text-slate-500">
              {form.role === "teacher" ? "O‘qituvchi" : "O‘quvchi"} ·{" "}
              {form.status}. Rol va admin huquqi bu oynadan o‘zgarmaydi.
            </p>
            <label className="block text-sm">
              Ism-familiya
              <Input
                required
                minLength={3}
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            {form.role === "teacher" ? (
              <>
                <label className="block text-sm">
                  Biriktirilgan fan
                  <Input
                    required
                    minLength={2}
                    maxLength={100}
                    value={form.subject}
                    onChange={(e) =>
                      setForm({ ...form, subject: e.target.value })
                    }
                  />
                </label>
                <fieldset className="space-y-3">
                  <legend className="mb-3 text-sm font-semibold">
                    Sinflar · bir nechta tanlash mumkin
                  </legend>
                  {data.classes.map((c: any) => (
                    <label
                      className="mr-4 inline-flex min-h-11 items-center gap-2 text-sm"
                      key={c.id}
                    >
                      <input
                        type="checkbox"
                        checked={form.classIds.includes(c.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            classIds: e.target.checked
                              ? [...form.classIds, c.id]
                              : form.classIds.filter(
                                  (id: string) => id !== c.id,
                                ),
                          })
                        }
                      />
                      {c.code.toUpperCase()}
                    </label>
                  ))}
                </fieldset>
              </>
            ) : (
              <label className="block text-sm">
                Sinf
                <Select
                  value={form.classId}
                  onChange={(e) =>
                    setForm({ ...form, classId: e.target.value })
                  }
                >
                  <option value="">
                    Sinfsiz · darslarga kirish cheklangan
                  </option>
                  {data.classes.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.code.toUpperCase()}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <label className="block text-sm">
              O‘zgartirish sababi
              <textarea
                className="ss-field min-h-28"
                required
                minLength={8}
                maxLength={2000}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </label>
            <Button type="submit" busy={busy}>
              Profilni saqlash
            </Button>
          </form>
        </Card>
      )}
    </main>
  );
}
