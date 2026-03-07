/**
 * 訪問日データ管理フック
 * カレンダーで選択した訪問日と各日の算定条件を管理する
 */
import { useState, useCallback } from "react";
import type {
  CalcInput,
  CareCalcInput,
  PatientCopayInput,
} from "@/lib/calcEngine";
import {
  defaultInput,
  defaultCareInput,
  defaultCopayInput,
  calculate,
  calculateCare,
  calcCopay,
} from "@/lib/calcEngine";
import { nanoid } from "nanoid";

export type InsuranceMode = "medical" | "care";

export interface VisitDay {
  id: string;
  date: string; // YYYY-MM-DD
  insuranceMode: InsuranceMode;
  medicalInput: CalcInput;
  careInput: CareCalcInput;
  copayInput: PatientCopayInput;
}

export interface VisitDayResult extends VisitDay {
  total: number;        // 医療保険:円 / 介護保険:単位数
  totalYen: number;     // 円換算（介護保険の場合は単価換算後）
  copayAmount: number;  // 患者自己負担額
}

function createDefaultVisitDay(date: string, mode: InsuranceMode): VisitDay {
  return {
    id: nanoid(),
    date,
    insuranceMode: mode,
    medicalInput: { ...defaultInput },
    careInput: { ...defaultCareInput },
    copayInput: { ...defaultCopayInput, insuranceType: mode },
  };
}

function calcVisitDayResult(day: VisitDay): VisitDayResult {
  let total = 0;
  let totalYen = 0;
  let copayAmount = 0;

  if (day.insuranceMode === "medical") {
    const result = calculate(day.medicalInput);
    total = result.total;
    totalYen = result.total;
    const copay = calcCopay(result.total, day.copayInput);
    copayAmount = copay.amount;
  } else {
    const result = calculateCare(day.careInput);
    total = result.totalUnit ?? 0;
    totalYen = result.totalYen ?? 0;
    const copay = calcCopay(totalYen, { ...day.copayInput, insuranceType: "care" });
    copayAmount = copay.amount;
  }

  return { ...day, total, totalYen, copayAmount };
}

export function useVisitStore() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [globalInsuranceMode, setGlobalInsuranceMode] = useState<InsuranceMode>("medical");
  const [visitDays, setVisitDays] = useState<VisitDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [stationName, setStationName] = useState("");

  // 指定日の訪問データを取得（なければnull）
  const getVisitDay = useCallback(
    (date: string) => visitDays.find((d) => d.date === date) ?? null,
    [visitDays]
  );

  // 訪問日をトグル（あれば削除、なければ追加）
  const toggleVisitDay = useCallback(
    (date: string) => {
      setVisitDays((prev) => {
        const exists = prev.find((d) => d.date === date);
        if (exists) {
          return prev.filter((d) => d.date !== date);
        } else {
          return [...prev, createDefaultVisitDay(date, globalInsuranceMode)];
        }
      });
    },
    [globalInsuranceMode]
  );

  // 訪問日の算定条件を更新
  const updateVisitDay = useCallback((date: string, updates: Partial<VisitDay>) => {
    setVisitDays((prev) =>
      prev.map((d) => (d.date === date ? { ...d, ...updates } : d))
    );
  }, []);

  // 当月の訪問日一覧（日付順）
  const currentMonthVisits = visitDays
    .filter((d) => {
      const [y, m] = d.date.split("-").map(Number);
      return y === year && m === month;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // 当月の集計結果
  const monthlyResults = currentMonthVisits.map(calcVisitDayResult);

  const totalAmount = monthlyResults.reduce((sum, r) => sum + r.totalYen, 0);
  const totalCopay = monthlyResults.reduce((sum, r) => sum + r.copayAmount, 0);

  // 月移動
  const prevMonth = useCallback(() => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }, [month]);

  return {
    year, month,
    globalInsuranceMode, setGlobalInsuranceMode,
    visitDays, currentMonthVisits, monthlyResults,
    totalAmount, totalCopay,
    selectedDate, setSelectedDate,
    patientName, setPatientName,
    stationName, setStationName,
    getVisitDay, toggleVisitDay, updateVisitDay,
    prevMonth, nextMonth,
  };
}
