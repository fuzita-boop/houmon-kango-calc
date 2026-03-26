/**
 * 訪問日データ管理フック
 * カレンダーで選択した訪問日と各日の算定条件を管理する
 *
 * 対応保険種別:
 * - medical: 医療保険（訪問看護基本療養費）
 * - care: 介護保険（訪問看護費）
 * - preventive: 介護予防訪問看護
 * - psychiatric: 精神科訪問看護基本療養費
 *
 * 自動コピー機能:
 * - 2回目以降の訪問日追加時、直前の訪問日の算定条件を自動コピー
 * - 月1回加算は2回目以降は自動的にOFFにする
 */
import { useState, useCallback } from "react";
import type {
  CalcInput,
  CareCalcInput,
  PatientCopayInput,
  PsychCalcInput,
  PreventiveCareCalcInput,
  SeishinCopayTracker,
  BukkaTaiouType,
  MedicalBaseupType,
} from "@/lib/calcEngine";
import {
  defaultInput,
  defaultCareInput,
  defaultCopayInput,
  defaultPsychInput,
  defaultPreventiveCareInput,
  defaultSeishinCopayTracker,
  calculate,
  calculateCare,
  calculatePsychiatric,
  calculatePreventiveCare,
  calcCopay,
  calcSeishinCopayWithTracker,
  calcShoguKaizenKasan,
  calcBukkaTaiouRyo,
  MEDICAL_BASEUP_FEE,
  CARE_REGION_RATES,
} from "@/lib/calcEngine";
import { nanoid } from "nanoid";

export type InsuranceMode = "medical" | "care" | "preventive" | "psychiatric";

export interface VisitDay {
  id: string;
  date: string; // YYYY-MM-DD
  insuranceMode: InsuranceMode;
  medicalInput: CalcInput;
  careInput: CareCalcInput;
  preventiveCareInput: PreventiveCareCalcInput;
  psychInput: PsychCalcInput;
  copayInput: PatientCopayInput;
  seishinCopayTracker: SeishinCopayTracker;
  /** 訪問看護物価対応料の種別 */
  bukkaTaiouType: BukkaTaiouType;
  /** 訪問看護ベースアップ評価料の種別 */
  medicalBaseupType: MedicalBaseupType;
  /** 介護保険：処遇改善加算を適用するか */
  applyShoguKaizen: boolean;
  /** 自動コピーされた訪問日かどうか（UIでバナー表示用） */
  wasAutoCopied?: boolean;
}

export interface VisitDayResult extends VisitDay {
  total: number;        // 医療保険:円 / 介護保険:単位数
  totalYen: number;     // 円換算
  copayAmount: number;  // 患者自己負担額
  bukkaRyo: number;     // 物価対応料（円）
  shoguKaizenYen: number; // 処遇改善加算（円）
  baseupRyo: number;    // ベースアップ評価料（円）
  breakdown: { label: string; yen: number; units?: number }[]; // 料金内訳（介護保険はunits付き）
}

// ============================================================
// 月1回加算のリセット
// ============================================================

function resetMonthlyOnceAdditions(input: CalcInput): CalcInput {
  return {
    ...input,
    h24Support: false,
    specialManagement: false,
    infoProvision: false,
    terminalCare: false,
    isFirstVisitOfMonth: false,
  };
}

function resetCareMonthlyOnceAdditions(input: CareCalcInput): CareCalcInput {
  return {
    ...input,
    emergencyVisit: false,
    specialManagement: false,
    terminalCare: false,
  };
}

function resetPsychMonthlyOnceAdditions(input: PsychCalcInput): PsychCalcInput {
  return {
    ...input,
    h24Support: false,
    specialManagement: false,
    terminalCare: false,
    isFirstVisitOfMonth: false,
  };
}

function resetPreventiveMonthlyOnceAdditions(input: PreventiveCareCalcInput): PreventiveCareCalcInput {
  return {
    ...input,
    emergencyVisit: false,
    specialManagement: false,
    terminalCare: false,
    initialAdd: false,
  };
}

// ============================================================
// 週・月カウント計算
// ============================================================

function calcWeeklyVisitCount(date: string, allVisits: VisitDay[]): number {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const dow = target.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(target);
  monday.setDate(target.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const mondayStr = monday.toISOString().split("T")[0];
  const sundayStr = sunday.toISOString().split("T")[0];
  return allVisits.filter((v) => v.date >= mondayStr && v.date <= sundayStr).length;
}

function calcMonthlyVisitCount(date: string, allVisits: VisitDay[]): number {
  const [y, m] = date.split("-").map(Number);
  return allVisits.filter((v) => {
    const [vy, vm] = v.date.split("-").map(Number);
    return vy === y && vm === m && v.date <= date;
  }).length;
}

function applyAutoCountToMedical(input: CalcInput, date: string, allVisits: VisitDay[]): CalcInput {
  const weekCount = calcWeeklyVisitCount(date, allVisits);
  const monthCount = calcMonthlyVisitCount(date, allVisits);
  const weeklyVisitDay = weekCount >= 4 ? "4+" : "1-3";
  let monthlyVisitDays: CalcInput["monthlyVisitDays"] = "1-15";
  if (monthCount >= 25) monthlyVisitDays = "25+";
  else if (monthCount >= 16) monthlyVisitDays = "16-24";
  const monthlyVisitDayForBasic: CalcInput["monthlyVisitDayForBasic"] = monthCount >= 21 ? "21+" : "1-20";
  const isFirstVisitOfMonth = monthCount === 1;
  return { ...input, weeklyVisitDay, monthlyVisitDays, monthlyVisitDayForBasic, isFirstVisitOfMonth };
}

function applyAutoCountToPsych(input: PsychCalcInput, date: string, allVisits: VisitDay[]): PsychCalcInput {
  const weekCount = calcWeeklyVisitCount(date, allVisits);
  const monthCount = calcMonthlyVisitCount(date, allVisits);
  const weeklyVisitDay = weekCount >= 4 ? "4+" : "1-3";
  let monthlyVisitDays: PsychCalcInput["monthlyVisitDays"] = "1-15";
  if (monthCount >= 25) monthlyVisitDays = "25+";
  else if (monthCount >= 16) monthlyVisitDays = "16-24";
  const isFirstVisitOfMonth = monthCount === 1;
  return { ...input, weeklyVisitDay, monthlyVisitDays, isFirstVisitOfMonth };
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
    preventiveCareInput: { ...defaultPreventiveCareInput },
    psychInput: { ...defaultPsychInput },
    copayInput: { ...defaultCopayInput, insuranceType: mode === "medical" || mode === "psychiatric" ? "medical" : "care" },
    seishinCopayTracker: { ...defaultSeishinCopayTracker },
    bukkaTaiouType: "none",
    medicalBaseupType: "none",
    applyShoguKaizen: false,
    wasAutoCopied: false,
  };
}

function createAutoCopiedVisitDay(
  date: string,
  prevDay: VisitDay,
  allVisits: VisitDay[],
  isFirstOfMonth: boolean
): VisitDay {
  let medicalInput = { ...prevDay.medicalInput };
  let careInput = { ...prevDay.careInput };
  let psychInput = { ...prevDay.psychInput };
  let preventiveCareInput = { ...prevDay.preventiveCareInput };

  if (!isFirstOfMonth) {
    medicalInput = resetMonthlyOnceAdditions(medicalInput);
    careInput = resetCareMonthlyOnceAdditions(careInput);
    psychInput = resetPsychMonthlyOnceAdditions(psychInput);
    preventiveCareInput = resetPreventiveMonthlyOnceAdditions(preventiveCareInput);
  }

  medicalInput = applyAutoCountToMedical(medicalInput, date, allVisits);
  psychInput = applyAutoCountToPsych(psychInput, date, allVisits);

  return {
    id: nanoid(),
    date,
    insuranceMode: prevDay.insuranceMode,
    medicalInput,
    careInput,
    preventiveCareInput,
    psychInput,
    copayInput: { ...prevDay.copayInput },
    seishinCopayTracker: { ...prevDay.seishinCopayTracker },
    bukkaTaiouType: prevDay.bukkaTaiouType,
    medicalBaseupType: prevDay.medicalBaseupType,
    applyShoguKaizen: prevDay.applyShoguKaizen,
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
  let bukkaRyo = 0;
  let shoguKaizenYen = 0;
  let baseupRyo = 0;
  const breakdown: { label: string; yen: number; units?: number }[] = [];

  if (day.insuranceMode === "medical") {
    const result = calculate(day.medicalInput);
    total = result.total;
    // 内訳項目をbreakdownに変換
    result.items.forEach(item => {
      if (!item.disabled) breakdown.push({ label: item.label, yen: item.amount });
    });
    // 物価対応料（type1）
    bukkaRyo = calcBukkaTaiouRyo(day.bukkaTaiouType, day.medicalInput.isFirstVisitOfMonth);
    if (bukkaRyo > 0) breakdown.push({ label: "診療報酬物価対応料", yen: bukkaRyo });
    // ベースアップ評価料
    baseupRyo = day.medicalBaseupType !== "none" ? MEDICAL_BASEUP_FEE[day.medicalBaseupType as "type1" | "type2"] : 0;
    if (baseupRyo > 0) {
      const baseupLabel = day.medicalBaseupType === "type1" ? "診療報酬ベースアップ評価料（1）" : "診療報酬ベースアップ評価料（2）";
      breakdown.push({ label: baseupLabel, yen: baseupRyo });
    }
    totalYen = result.total + bukkaRyo + baseupRyo;
    const copay = calcCopay(totalYen, day.copayInput);
    copayAmount = copay.amount;
  } else if (day.insuranceMode === "care") {
    const result = calculateCare(day.careInput);
    total = result.totalUnit ?? 0;
    const baseYen = result.totalYen ?? 0;
    // 内訳項目をbreakdownに変換（単位数→円換算）
    const rate = CARE_REGION_RATES[day.careInput.regionRate];
    result.items.forEach(item => {
      if (!item.disabled) breakdown.push({ label: item.label, units: item.amount, yen: Math.round(item.amount * rate) });
    });
    // 処遇改善加算
    if (day.applyShoguKaizen) {
      const kaizen = calcShoguKaizenKasan(total, rate);
      shoguKaizenYen = kaizen.yen;
      if (shoguKaizenYen > 0) breakdown.push({ label: "処遇改善加算（1.8%）", units: kaizen.units, yen: shoguKaizenYen });
    }
    totalYen = baseYen + shoguKaizenYen;
    const copay = calcCopay(totalYen, { ...day.copayInput, insuranceType: "care" });
    copayAmount = copay.amount;
  } else if (day.insuranceMode === "preventive") {
    const result = calculatePreventiveCare(day.preventiveCareInput);
    total = result.totalUnit ?? 0;
    const baseYen = result.totalYen ?? 0;
    // 内訳項目をbreakdownに変換（単位数→円換算）
    const rate = CARE_REGION_RATES[day.preventiveCareInput.regionRate];
    result.items.forEach(item => {
      if (!item.disabled) breakdown.push({ label: item.label, units: item.amount, yen: Math.round(item.amount * rate) });
    });
    // 処遇改善加算
    if (day.applyShoguKaizen) {
      const kaizen = calcShoguKaizenKasan(total, rate);
      shoguKaizenYen = kaizen.yen;
      if (shoguKaizenYen > 0) breakdown.push({ label: "処遇改善加算（1.8%）", units: kaizen.units, yen: shoguKaizenYen });
    }
    totalYen = baseYen + shoguKaizenYen;
    const copay = calcCopay(totalYen, { ...day.copayInput, insuranceType: "care" });
    copayAmount = copay.amount;
  } else if (day.insuranceMode === "psychiatric") {
    const result = calculatePsychiatric(day.psychInput);
    total = result.total;
    // 内訳項目をbreakdownに変換
    result.items.forEach(item => {
      if (!item.disabled) breakdown.push({ label: item.label, yen: item.amount });
    });
    // 物価対応料（type2）
    bukkaRyo = calcBukkaTaiouRyo(day.bukkaTaiouType, day.psychInput.isFirstVisitOfMonth);
    if (bukkaRyo > 0) breakdown.push({ label: "診療報酬物価対応料", yen: bukkaRyo });
    totalYen = result.total + bukkaRyo;
    // 自立支援医療の月額上限管理
    const baseCopay = calcCopay(totalYen, day.copayInput);
    if (day.copayInput.kohiType === "seishin") {
      const tracked = calcSeishinCopayWithTracker(baseCopay.amount, day.seishinCopayTracker);
      copayAmount = tracked.actualPayment;
    } else {
      copayAmount = baseCopay.amount;
    }
  }

  return { ...day, total, totalYen, copayAmount, bukkaRyo, shoguKaizenYen, baseupRyo, breakdown };
}

// ============================================================
// メインフック
// ============================================================

export function useVisitStore() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [globalInsuranceMode, setGlobalInsuranceMode] = useState<InsuranceMode>("medical");
  const [visitDays, setVisitDays] = useState<VisitDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [stationName, setStationName] = useState("");

  // グローバル算定条件（ステップUIで設定し、新規訪問日に適用する）
  const [globalMedicalInput, setGlobalMedicalInput] = useState<import("@/lib/calcEngine").CalcInput>({ ...defaultInput });
  const [globalCareInput, setGlobalCareInput] = useState<import("@/lib/calcEngine").CareCalcInput>({ ...defaultCareInput });
  const [globalPreventiveCareInput, setGlobalPreventiveCareInput] = useState<import("@/lib/calcEngine").PreventiveCareCalcInput>({ ...defaultPreventiveCareInput });
  const [globalPsychInput, setGlobalPsychInput] = useState<import("@/lib/calcEngine").PsychCalcInput>({ ...defaultPsychInput });
  const [globalCopayInput, setGlobalCopayInput] = useState<import("@/lib/calcEngine").PatientCopayInput>({ ...defaultCopayInput });
  const [globalBukkaTaiouType, setGlobalBukkaTaiouType] = useState<import("@/lib/calcEngine").BukkaTaiouType>("none");
  const [globalMedicalBaseupType, setGlobalMedicalBaseupType] = useState<import("@/lib/calcEngine").MedicalBaseupType>("none");
  const [globalApplyShoguKaizen, setGlobalApplyShoguKaizen] = useState(false);

  // ホーム画面のステップ（種別選択→算定条件→負担割合→カレンダー）
  const [homeStep, setHomeStep] = useState<1 | 2 | 3 | 4>(1);

  const getVisitDay = useCallback(
    (date: string) => visitDays.find((d) => d.date === date) ?? null,
    [visitDays]
  );

  const toggleVisitDay = useCallback(
    (date: string) => {
      setVisitDays((prev) => {
        const exists = prev.find((d) => d.date === date);
        if (exists) {
          return prev.filter((d) => d.date !== date);
        }

        const [y, m] = date.split("-").map(Number);
        const sameMonthVisits = prev
          .filter((d) => {
            const [vy, vm] = d.date.split("-").map(Number);
            return vy === y && vm === m;
          })
          .sort((a, b) => a.date.localeCompare(b.date));

        const tempNewDay: VisitDay = createDefaultVisitDay(date, globalInsuranceMode);
        const allWithNew = [...prev, tempNewDay].sort((a, b) => a.date.localeCompare(b.date));

        if (sameMonthVisits.length === 0) {
          const newDay: VisitDay = {
            ...createDefaultVisitDay(date, globalInsuranceMode),
            medicalInput: applyAutoCountToMedical(
              { ...globalMedicalInput, isFirstVisitOfMonth: true },
              date,
              allWithNew
            ),
            careInput: { ...globalCareInput },
            preventiveCareInput: { ...globalPreventiveCareInput },
            psychInput: applyAutoCountToPsych(
              { ...globalPsychInput, isFirstVisitOfMonth: true },
              date,
              allWithNew
            ),
            copayInput: { ...globalCopayInput, insuranceType: globalInsuranceMode === "medical" || globalInsuranceMode === "psychiatric" ? "medical" : "care" },
            bukkaTaiouType: globalBukkaTaiouType,
            medicalBaseupType: globalMedicalBaseupType,
            applyShoguKaizen: globalApplyShoguKaizen,
          };
          return [...prev, newDay];
        }

        const prevDay = sameMonthVisits[sameMonthVisits.length - 1];
        const newDay = createAutoCopiedVisitDay(date, prevDay, allWithNew, false);
        return [...prev, newDay];
      });
    },
    [globalInsuranceMode, globalMedicalInput, globalCareInput, globalPreventiveCareInput, globalPsychInput, globalCopayInput, globalBukkaTaiouType, globalMedicalBaseupType, globalApplyShoguKaizen]
  );

  const updateVisitDay = useCallback((date: string, updates: Partial<VisitDay>) => {
    setVisitDays((prev) =>
      prev.map((d) => (d.date === date ? { ...d, ...updates, wasAutoCopied: false } : d))
    );
  }, []);

  const updateCopayForAll = useCallback((copayInput: PatientCopayInput) => {
    setVisitDays((prev) =>
      prev.map((d) => {
        const [vy, vm] = d.date.split("-").map(Number);
        if (vy === year && vm === month) {
          const insuranceType = (d.insuranceMode === "medical" || d.insuranceMode === "psychiatric") ? "medical" : "care";
          return { ...d, copayInput: { ...copayInput, insuranceType } };
        }
        return d;
      })
    );
  }, [year, month]);

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

  const currentMonthVisits = visitDays
    .filter((d) => {
      const [y, m] = d.date.split("-").map(Number);
      return y === year && m === month;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const monthlyResults = currentMonthVisits.map(calcVisitDayResult);

  const totalAmount = monthlyResults.reduce((sum, r) => sum + r.totalYen, 0);
  const totalCopay = monthlyResults.reduce((sum, r) => sum + r.copayAmount, 0);

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

  const clearAll = useCallback(() => {
    setVisitDays([]);
    setSelectedDate(null);
    setPatientName("");
    setStationName("");
    setHomeStep(1);
  }, []);

  return {
    year, month,
    globalInsuranceMode, setGlobalInsuranceMode,
    globalMedicalInput, setGlobalMedicalInput,
    globalCareInput, setGlobalCareInput,
    globalPreventiveCareInput, setGlobalPreventiveCareInput,
    globalPsychInput, setGlobalPsychInput,
    globalCopayInput, setGlobalCopayInput,
    globalBukkaTaiouType, setGlobalBukkaTaiouType,
    globalMedicalBaseupType, setGlobalMedicalBaseupType,
    globalApplyShoguKaizen, setGlobalApplyShoguKaizen,
    homeStep, setHomeStep,
    visitDays, currentMonthVisits, monthlyResults,
    totalAmount, totalCopay,
    selectedDate, setSelectedDate,
    patientName, setPatientName,
    stationName, setStationName,
    getVisitDay, toggleVisitDay, updateVisitDay, copyPrevConditions, updateCopayForAll,
    prevMonth, nextMonth, clearAll,
  };
}
