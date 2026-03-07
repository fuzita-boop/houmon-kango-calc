/**
 * 訪問日データ管理フック
 * カレンダーで選択した訪問日と各日の算定条件を管理する
 *
 * 自動コピー機能:
 * - 2回目以降の訪問日追加時、直前の訪問日の算定条件を自動コピー
 * - 月1回加算（24時間対応体制加算・特別管理加算・情報提供療養費・ターミナルケア）は
 *   2回目以降は自動的にOFFにする
 * - 週の訪問日数（weeklyVisitDay）はその週の訪問回数を自動カウント
 * - 月の訪問日数（monthlyVisitDays）は当月の訪問回数を自動カウント
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
  /** 自動コピーされた訪問日かどうか（UIでバナー表示用） */
  wasAutoCopied?: boolean;
}

export interface VisitDayResult extends VisitDay {
  total: number;        // 医療保険:円 / 介護保険:単位数
  totalYen: number;     // 円換算（介護保険の場合は単価換算後）
  copayAmount: number;  // 患者自己負担額
}

// ============================================================
// 月1回加算のリセット
// ============================================================

/**
 * 医療保険の月1回加算をOFFにした入力を返す
 * 月の2回目以降の訪問日に適用する
 */
function resetMonthlyOnceAdditions(input: CalcInput): CalcInput {
  return {
    ...input,
    // 24時間対応体制加算 → OFF（月1回）
    h24Support: false,
    // 特別管理加算 → OFF（月1回）
    specialManagement: false,
    // 訪問看護情報提供療養費 → OFF（月1回）
    infoProvision: false,
    // ターミナルケア療養費 → OFF（月1回）
    terminalCare: false,
    // 月初日フラグ → OFF
    isFirstVisitOfMonth: false,
  };
}

/**
 * 介護保険の月1回加算をOFFにした入力を返す
 */
function resetCareMonthlyOnceAdditions(input: CareCalcInput): CareCalcInput {
  return {
    ...input,
    // 緊急時訪問看護加算 → OFF（月1回）
    emergencyVisit: false,
    // 特別管理加算 → OFF（月1回）
    specialManagement: false,
    // ターミナルケア加算 → OFF（月1回）
    terminalCare: false,
  };
}

// ============================================================
// 週の訪問日数を計算
// ============================================================

/**
 * 指定日が含まれる週（月曜〜日曜）の訪問回数を返す
 * ※ 算定上の「週」は月曜始まりが一般的
 */
function calcWeeklyVisitCount(date: string, allVisits: VisitDay[]): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const dow = target.getDay(); // 0=日, 1=月, ..., 6=土
  // 週の月曜日を求める（日曜の場合は6日前）
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(target);
  monday.setDate(target.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const mondayStr = monday.toISOString().split("T")[0];
  const sundayStr = sunday.toISOString().split("T")[0];

  return allVisits.filter((v) => v.date >= mondayStr && v.date <= sundayStr).length;
}

/**
 * 指定日時点での当月の訪問回数（指定日含む）を返す
 */
function calcMonthlyVisitCount(date: string, allVisits: VisitDay[]): number {
  const [y, m] = date.split("-").map(Number);
  return allVisits.filter((v) => {
    const [vy, vm] = v.date.split("-").map(Number);
    return vy === y && vm === m && v.date <= date;
  }).length;
}

// ============================================================
// 訪問日の週・月カウントに基づいてCalcInputを更新
// ============================================================

function applyAutoCountToMedical(input: CalcInput, date: string, allVisits: VisitDay[]): CalcInput {
  const weekCount = calcWeeklyVisitCount(date, allVisits);
  const monthCount = calcMonthlyVisitCount(date, allVisits);

  // 週4日目以降かどうか
  const weeklyVisitDay = weekCount >= 4 ? "4+" : "1-3";

  // 月の訪問日数区分（管理療養費2日目以降用）
  let monthlyVisitDays: CalcInput["monthlyVisitDays"] = "1-15";
  if (monthCount >= 25) monthlyVisitDays = "25+";
  else if (monthCount >= 16) monthlyVisitDays = "16-24";

  // 月の訪問日数（基本療養費Ⅱ用）
  const monthlyVisitDayForBasic: CalcInput["monthlyVisitDayForBasic"] = monthCount >= 21 ? "21+" : "1-20";

  // 月初日フラグ（1回目のみtrue）
  const isFirstVisitOfMonth = monthCount === 1;

  return {
    ...input,
    weeklyVisitDay,
    monthlyVisitDays,
    monthlyVisitDayForBasic,
    isFirstVisitOfMonth,
  };
}

// ============================================================
// 新規訪問日の作成
// ============================================================

function createDefaultVisitDay(date: string, mode: InsuranceMode): VisitDay {
  return {
    id: nanoid(),
    date,
    insuranceMode: mode,
    medicalInput: { ...defaultInput },
    careInput: { ...defaultCareInput },
    copayInput: { ...defaultCopayInput, insuranceType: mode },
    wasAutoCopied: false,
  };
}

/**
 * 直前の訪問日の条件をコピーして新規訪問日を作成する
 * 月1回加算は自動でOFFにし、週・月カウントを自動更新する
 */
function createAutoCopiedVisitDay(
  date: string,
  prevDay: VisitDay,
  allVisits: VisitDay[], // コピー先日付を含む全訪問日リスト
  isFirstOfMonth: boolean
): VisitDay {
  let medicalInput = { ...prevDay.medicalInput };
  let careInput = { ...prevDay.careInput };

  if (!isFirstOfMonth) {
    // 月1回加算をOFF
    medicalInput = resetMonthlyOnceAdditions(medicalInput);
    careInput = resetCareMonthlyOnceAdditions(careInput);
  }

  // 週・月カウントを自動更新（コピー先日付を含む全訪問日で計算）
  medicalInput = applyAutoCountToMedical(medicalInput, date, allVisits);

  return {
    id: nanoid(),
    date,
    insuranceMode: prevDay.insuranceMode,
    medicalInput,
    careInput,
    copayInput: { ...prevDay.copayInput },
    wasAutoCopied: true,
  };
}

// ============================================================
// 計算結果
// ============================================================

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

// ============================================================
// メインフック
// ============================================================

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
          // 削除
          return prev.filter((d) => d.date !== date);
        }

        // 追加：当月の既存訪問日（日付順）を取得
        const [y, m] = date.split("-").map(Number);
        const sameMonthVisits = prev
          .filter((d) => {
            const [vy, vm] = d.date.split("-").map(Number);
            return vy === y && vm === m;
          })
          .sort((a, b) => a.date.localeCompare(b.date));

        // 追加後の全訪問日リスト（カウント計算用）
        const tempNewDay: VisitDay = createDefaultVisitDay(date, globalInsuranceMode);
        const allWithNew = [...prev, tempNewDay].sort((a, b) => a.date.localeCompare(b.date));

        if (sameMonthVisits.length === 0) {
          // 月の初回：デフォルト値で作成（月初日フラグON）
          const newDay: VisitDay = {
            ...createDefaultVisitDay(date, globalInsuranceMode),
            medicalInput: applyAutoCountToMedical(
              { ...defaultInput, isFirstVisitOfMonth: true },
              date,
              allWithNew
            ),
          };
          return [...prev, newDay];
        }

        // 2回目以降：直前の訪問日の条件をコピー
        const prevDay = sameMonthVisits[sameMonthVisits.length - 1];
        const isFirstOfMonth = false;
        const newDay = createAutoCopiedVisitDay(date, prevDay, allWithNew, isFirstOfMonth);
        return [...prev, newDay];
      });
    },
    [globalInsuranceMode]
  );

  // 訪問日の算定条件を更新
  const updateVisitDay = useCallback((date: string, updates: Partial<VisitDay>) => {
    setVisitDays((prev) =>
      prev.map((d) => (d.date === date ? { ...d, ...updates, wasAutoCopied: false } : d))
    );
  }, []);

  /**
   * 当月の全訪問日に同じ患者負担設定を反映する
   * （患者負担タブで変更した際に全日に適用）
   */
  const updateCopayForAll = useCallback((copayInput: PatientCopayInput) => {
    setVisitDays((prev) =>
      prev.map((d) => {
        const [vy, vm] = d.date.split("-").map(Number);
        if (vy === year && vm === month) {
          return { ...d, copayInput: { ...copayInput, insuranceType: d.insuranceMode } };
        }
        return d;
      })
    );
  }, [year, month]);

  /**
   * 指定日に直前の訪問日の条件を手動でコピーする
   * （詳細パネルの「前回の条件をコピー」ボタン用）
   */
  const copyPrevConditions = useCallback((date: string) => {
    setVisitDays((prev) => {
      const [y, m] = date.split("-").map(Number);
      const sameMonthVisits = prev
        .filter((d) => {
          const [vy, vm] = d.date.split("-").map(Number);
          return vy === y && vm === m && d.date < date;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      if (sameMonthVisits.length === 0) return prev;

      const prevDay = sameMonthVisits[sameMonthVisits.length - 1];
      const allWithNew = prev.sort((a, b) => a.date.localeCompare(b.date));
      const copied = createAutoCopiedVisitDay(date, prevDay, allWithNew, false);

      return prev.map((d) => (d.date === date ? { ...copied, id: d.id } : d));
    });
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
    getVisitDay, toggleVisitDay, updateVisitDay, copyPrevConditions, updateCopayForAll,
    prevMonth, nextMonth,
  };
}
