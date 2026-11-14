import { useCallback } from "react";
import { useLearnOS } from "../context/LearnOSContext";
export function useExamApi() {
  const { sessionToken } = useLearnOS();
  return useCallback(
    async (path: string, method = "GET", body?: unknown) => {
      let response: Response;
      try {
        response = await fetch(path, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        throw Error(
          "Serverga ulanish bo‘lmadi. Internetni tekshirib qayta urinib ko‘ring.",
        );
      }
      let data: any;
      try {
        data = await response.json();
      } catch {
        throw Object.assign(
          Error(
            response.status === 413
              ? "Javob hajmi katta. Chizma yoki matnni kamaytiring."
              : "Server javob bermadi. Qayta urinib ko‘ring.",
          ),
          { status: response.status },
        );
      }
      if (!response.ok)
        throw Object.assign(Error(data.error || "Amal bajarilmadi."), {
          status: response.status,
          code: data.code,
          fields: data.fields,
          errors: data.errors,
        });
      return data;
    },
    [sessionToken],
  );
}
