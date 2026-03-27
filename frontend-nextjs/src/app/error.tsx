"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-dark px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border-color bg-surface-dark p-8 text-center shadow-xl">
        <h2 className="text-2xl font-bold text-text-base">Đã xảy ra lỗi</h2>
        <p className="mt-3 text-text-secondary">
          Có sự cố trong quá trình tải trang. Bạn có thể thử lại hoặc quay về thư viện.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-on-primary hover:opacity-90"
          >
            Thử lại
          </button>
          <Link
            href="/learn"
            className="rounded-full border border-border-color px-5 py-2 text-sm font-bold text-text-base hover:bg-surface-highlight"
          >
            Về thư viện
          </Link>
        </div>
      </div>
    </div>
  );
}
