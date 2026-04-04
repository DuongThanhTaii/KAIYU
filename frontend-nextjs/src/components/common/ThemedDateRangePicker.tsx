"use client";

import React, { useMemo, useState } from "react";

type ActiveField = "from" | "to";

type Props = {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  error?: string;
};

const WEEK_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTH_LABELS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

const toDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateValue = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

const formatDisplayDate = (value: string) => {
  const date = parseDateValue(value);
  if (!date) return "dd/mm/yyyy";
  return date.toLocaleDateString("vi-VN");
};

export default function ThemedDateRangePicker({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  error,
}: Props) {
  const initialCursor =
    parseDateValue(toDate) || parseDateValue(fromDate) || new Date();
  const [cursor, setCursor] = useState(
    new Date(initialCursor.getFullYear(), initialCursor.getMonth(), 1),
  );
  const [activeField, setActiveField] = useState<ActiveField>("from");

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();

    const firstDayWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const cells: Array<{ date: Date; inCurrentMonth: boolean }> = [];

    for (let i = firstDayWeek - 1; i >= 0; i -= 1) {
      const day = prevMonthDays - i;
      cells.push({
        date: new Date(year, month - 1, day),
        inCurrentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ date: new Date(year, month, day), inCurrentMonth: true });
    }

    while (cells.length % 7 !== 0) {
      const nextDay = cells.length - (firstDayWeek + daysInMonth) + 1;
      cells.push({
        date: new Date(year, month + 1, nextDay),
        inCurrentMonth: false,
      });
    }

    return cells;
  }, [cursor]);

  const selectedFrom = fromDate;
  const selectedTo = toDate;

  const selectDate = (date: Date) => {
    const value = toDateValue(date);
    if (activeField === "from") {
      onFromDateChange(value);
      setActiveField("to");
      return;
    }
    onToDateChange(value);
  };

  const prevMonth = () => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const today = toDateValue(new Date());

  return (
    <div className="w-full rounded-xl border border-border-color bg-surface-dark p-3 shadow-2xl">
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => setActiveField("from")}
          className={`rounded-lg border px-2 py-1.5 text-left transition-all ${
            activeField === "from"
              ? "border-primary bg-primary/15 text-text-base"
              : "border-border-color bg-background-dark text-text-secondary"
          }`}
        >
          <p className="text-[10px] font-semibold">Từ ngày</p>
          <p className="text-xs font-bold">{formatDisplayDate(fromDate)}</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveField("to")}
          className={`rounded-lg border px-2 py-1.5 text-left transition-all ${
            activeField === "to"
              ? "border-primary bg-primary/15 text-text-base"
              : "border-border-color bg-background-dark text-text-secondary"
          }`}
        >
          <p className="text-[10px] font-semibold">Đến ngày</p>
          <p className="text-xs font-bold">{formatDisplayDate(toDate)}</p>
        </button>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-text-base">
          {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="size-7 rounded-md border border-border-color text-text-secondary hover:text-text-base hover:bg-background-dark"
          >
            {"<"}
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="size-7 rounded-md border border-border-color text-text-secondary hover:text-text-base hover:bg-background-dark"
          >
            {">"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEK_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-semibold text-text-secondary py-1"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, inCurrentMonth }) => {
          const value = toDateValue(date);
          const isFrom = value === selectedFrom;
          const isTo = value === selectedTo;
          const isSelected = isFrom || isTo;
          const isToday = value === today;

          return (
            <button
              key={value}
              type="button"
              onClick={() => selectDate(date)}
              className={`h-8 w-full rounded-md text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-primary text-on-primary"
                  : inCurrentMonth
                    ? "text-text-base hover:bg-background-dark"
                    : "text-text-secondary/60 hover:bg-background-dark/60"
              } ${isToday && !isSelected ? "ring-1 ring-primary/50" : ""}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>

      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
