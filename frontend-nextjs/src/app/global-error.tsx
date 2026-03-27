"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("Global error:", error);

  return (
    <html lang="vi">
      <body className="min-h-screen bg-background-dark">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl border border-border-color bg-surface-dark p-8 text-center shadow-xl">
            <h2 className="text-2xl font-bold text-text-base">Ứng dụng tạm thời gặp sự cố</h2>
            <p className="mt-3 text-text-secondary">
              Hệ thống vừa gặp lỗi không mong muốn. Vui lòng thử tải lại.
            </p>
            <button
              onClick={reset}
              className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-bold text-on-primary hover:opacity-90"
            >
              Tải lại
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
