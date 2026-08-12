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
import { useState, useCallback, useEffect } from "react";
import type {
  CalcInput,
  CareCalcInput,
  PatientCopayInput,
  PsychCalcInput,
  PreventiveCareCalcInput,
  SeishinCopayTracker,
  BukkaTaiouType,
  MedicalBaseupType,
  MedicalBaseupConfig,
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
  calcBaseupFee,
  DEFAULT_BASEUP_CONFIG,
  MEDICAL_BASEUP_FEE,
  CARE_REGION_RATES,
} from "@/lib/calcEngine";
import { nanoid } from "nanoid";
import {
  downloadBackup,
  loadPersistedAppData,
  readBackupFile,
  readLegacyLocalStorageData,
  savePersistedAppData,
} from "@/lib/localPersistence";
import type { PersistedAppData, PersistedVisitDay } from "@/lib/localPersistence";

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
  /** 訪問看護ベースアップ評価料の設定（令和8年度改定・月1回定額） */
  medicalBaseupConfig: MedicalBaseupConfig;
  /** 介護保険：処遇改善加算を適用するか */
  applyShoguKaizen: boolean;
  /** 自動コピーされた訪問日かどうか（UIでバナー表示用） */
  wasAutoCopied?: boolean;
}

export interface VisitDayResult extends VisitDay {
  total: number;        // 医療保険:円 / 介護保険:単位数
  totalYen: number;     // 円換算（処遇改善加算を除く）
  copayAmount: number;  // 患者自己負担額（処遇改善加算を除く）
  bukkaRyo: number;     // 物価対応料（円）
  shoguKaizenYen: number; // 処遇改善加算（円）※月次集計でのみ使用
  baseupRyo: number;    // ベースアップ評価料（円）
  breakdown: { label: string; yen: number; units?: number }[]; // 料金内訳（介護保険はunits付き）
}

/** 月次集計結果（処遇改善加算を月合計で計算） */
export interface MonthlySummaryResult {
  records: VisitDayResult[];
  totalUnitsForCare: number;   // 介護保険・介護予防の月合計単位数
  shoguKaizenUnits: number;    // 処遇改善加算の単位数（月1回）
  shoguKaizenYen: number;      // 処遇改善加算の円換算（月1回）
  totalAmount: number;         // 月合計金額（処遇改善加算・ベースアップ評価料込み）
  totalCopay: number;          // 月合計自己負担（処遇改善加算・ベースアップ評価料込み）
  applyShoguKaizen: boolean;   // 処遇改善加算を適用するか
  shoguKaizenRegionRate: number; // 処遇改善加算の地域単価
  /** ベースアップ評価料（月次集計・月に1回） */
  monthlyBaseupYen: number;    // ベースアップ評価料の月額（円）
  hasBaseup: boolean;          // ベースアップ評価料を適用するか
}

type PersistedVisitState = Omit<PersistedAppData, "savedAt" | "schemaVersion">;

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
    initialAdd: false,
  };
}

function resetPsychMonthlyOnceAdditions(input: PsychCalcInput): PsychCalcInput {
  return {
    ...input,
    h24Support: false,
    specialManagement: false,
    terminalCare: false,
    infoProvision: false,  // 情報提供療養費は月1回のみ
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
    medicalBaseupConfig: { ...DEFAULT_BASEUP_CONFIG },
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
    medicalBaseupConfig: { ...prevDay.medicalBaseupConfig },
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
    // ベースアップ評価料は月次集計で月に1回算定するため、日次計算からは除外
    totalYen = result.total + bukkaRyo;
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
    // 処遇改善加算は月次集計で月合計単位数から計算するため、ここでは計算しない
    totalYen = baseYen;
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
    // 処遇改善加算は月次集計で月合計単位数から計算するため、ここでは計算しない
    totalYen = baseYen;
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
    // ベースアップ評価料は月次集計で月に1回算定するため、日次計算からは除外
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
// 端末内保存データの復元・正規化
// ============================================================

function isInsuranceMode(value: unknown): value is InsuranceMode {
  return value === "medical" || value === "care" || value === "preventive" || value === "psychiatric";
}

function normalizePersistedVisitDay(value: PersistedVisitDay): VisitDay {
  const mode = isInsuranceMode(value.insuranceMode) ? value.insuranceMode : "medical";
  const fallback = createDefaultVisitDay(typeof value.date === "string" ? value.date : "", mode);
  return {
    ...fallback,
    ...value,
    id: typeof value.id === "string" ? value.id : fallback.id,
    date: typeof value.date === "string" ? value.date : fallback.date,
    insuranceMode: mode,
    medicalInput: { ...defaultInput, ...value.medicalInput },
    careInput: { ...defaultCareInput, ...value.careInput },
    preventiveCareInput: { ...defaultPreventiveCareInput, ...value.preventiveCareInput },
    psychInput: { ...defaultPsychInput, ...value.psychInput },
    copayInput: { ...defaultCopayInput, ...value.copayInput },
    seishinCopayTracker: { ...defaultSeishinCopayTracker, ...value.seishinCopayTracker },
    medicalBaseupConfig: { ...DEFAULT_BASEUP_CONFIG, ...value.medicalBaseupConfig },
    bukkaTaiouType: value.bukkaTaiouType ?? "type1",
    applyShoguKaizen: Boolean(value.applyShoguKaizen),
  };
}

function normalizePersistedState(data: PersistedAppData): PersistedVisitState {
  const now = new Date();
  const visitDays = Array.isArray(data.visitDays)
    ? data.visitDays.filter((day): day is PersistedVisitDay => Boolean(day && typeof day === "object")).map(normalizePersistedVisitDay)
    : [];
  const homeStep = data.homeStep === 2 || data.homeStep === 3 || data.homeStep === 4 ? data.homeStep : 1;
  return {
    year: Number.isInteger(data.year) ? data.year : now.getFullYear(),
    month: Number.isInteger(data.month) && data.month >= 1 && data.month <= 12 ? data.month : now.getMonth() + 1,
    globalInsuranceMode: isInsuranceMode(data.globalInsuranceMode) ? data.globalInsuranceMode : "medical",
    visitDays,
    selectedDate: typeof data.selectedDate === "string" ? data.selectedDate : null,
    patientName: typeof data.patientName === "string" ? data.patientName : "",
    stationName: typeof data.stationName === "string" ? data.stationName : "",
    globalMedicalInput: { ...defaultInput, ...data.globalMedicalInput },
    globalCareInput: { ...defaultCareInput, ...data.globalCareInput },
    globalPreventiveCareInput: { ...defaultPreventiveCareInput, ...data.globalPreventiveCareInput },
    globalPsychInput: { ...defaultPsychInput, ...data.globalPsychInput },
    globalCopayInput: { ...defaultCopayInput, ...data.globalCopayInput },
    globalBukkaTaiouType: data.globalBukkaTaiouType ?? "type1",
    globalBaseupConfig: { ...DEFAULT_BASEUP_CONFIG, ...data.globalBaseupConfig },
    globalApplyShoguKaizen: Boolean(data.globalApplyShoguKaizen),
    homeStep,
  };
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
  const [globalBukkaTaiouType, setGlobalBukkaTaiouType] = useState<import("@/lib/calcEngine").BukkaTaiouType>("type1"); // 物価対応料はデフォルトON
  const [globalBaseupConfig, setGlobalBaseupConfig] = useState<import("@/lib/calcEngine").MedicalBaseupConfig>({ ...DEFAULT_BASEUP_CONFIG });
  const [globalApplyShoguKaizen, setGlobalApplyShoguKaizen] = useState(false);

  // ホーム画面のステップ（種別選択→算定条件→負担割合→カレンダー）
  const [homeStep, setHomeStep] = useState<1 | 2 | 3 | 4>(1);
  const [isHydrated, setIsHydrated] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const applyPersistedState = useCallback((data: PersistedAppData) => {
    const restored = normalizePersistedState(data);
    setYear(restored.year);
    setMonth(restored.month);
    setGlobalInsuranceMode(restored.globalInsuranceMode);
    setVisitDays(restored.visitDays);
    setSelectedDate(restored.selectedDate);
    setPatientName(restored.patientName);
    setStationName(restored.stationName);
    setGlobalMedicalInput(restored.globalMedicalInput);
    setGlobalCareInput(restored.globalCareInput);
    setGlobalPreventiveCareInput(restored.globalPreventiveCareInput);
    setGlobalPsychInput(restored.globalPsychInput);
    setGlobalCopayInput(restored.globalCopayInput);
    setGlobalBukkaTaiouType(restored.globalBukkaTaiouType);
    setGlobalBaseupConfig(restored.globalBaseupConfig);
    setGlobalApplyShoguKaizen(restored.globalApplyShoguKaizen);
    setHomeStep(restored.homeStep);
  }, []);

  // 最初の1回だけ端末内データを復元。旧試作版のlocalStorageデータも見つかれば移行する。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadPersistedAppData();
        const legacy = saved ? null : readLegacyLocalStorageData();
        if (!cancelled && (saved ?? legacy)) {
          applyPersistedState(saved ?? legacy!);
        }
      } catch (error) {
        if (!cancelled) {
          setPersistenceError(error instanceof Error ? error.message : "端末内データを読み込めませんでした。");
        }
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, [applyPersistedState]);

  // 復元後のすべての変更をIndexedDBへ保存。計算データはネットワークへ送信しない。
  useEffect(() => {
    if (!isHydrated) return;
    const data: PersistedAppData = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      year,
      month,
      globalInsuranceMode,
      visitDays,
      selectedDate,
      patientName,
      stationName,
      globalMedicalInput,
      globalCareInput,
      globalPreventiveCareInput,
      globalPsychInput,
      globalCopayInput,
      globalBukkaTaiouType,
      globalBaseupConfig,
      globalApplyShoguKaizen,
      homeStep,
    };
    const timeout = window.setTimeout(() => {
      savePersistedAppData(data).then(
        () => setPersistenceError(null),
        (error: unknown) => setPersistenceError(error instanceof Error ? error.message : "端末内データを保存できませんでした。")
      );
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [
    isHydrated, year, month, globalInsuranceMode, visitDays, selectedDate, patientName, stationName,
    globalMedicalInput, globalCareInput, globalPreventiveCareInput, globalPsychInput, globalCopayInput,
    globalBukkaTaiouType, globalBaseupConfig, globalApplyShoguKaizen, homeStep,
  ]);

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
            medicalBaseupConfig: { ...globalBaseupConfig },
            applyShoguKaizen: globalApplyShoguKaizen,
          };
          return [...prev, newDay];
        }

        const prevDay = sameMonthVisits[sameMonthVisits.length - 1];
        const newDay = createAutoCopiedVisitDay(date, prevDay, allWithNew, false);
        return [...prev, newDay];
      });
    },
    [globalInsuranceMode, globalMedicalInput, globalCareInput, globalPreventiveCareInput, globalPsychInput, globalCopayInput, globalBukkaTaiouType, globalBaseupConfig, globalApplyShoguKaizen]
  );

  const removeVisitDay = useCallback((date: string) => {
    setVisitDays((prev) => prev.filter((d) => d.date !== date));
    setSelectedDate((current) => current === date ? null : current);
  }, []);

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

  // 処遇改善加算は月合計単位数から計算（月1回のみ）
  // 介護保険・介護予防の月合計単位数を集計
  const careMonthlyTotalUnits = monthlyResults.reduce((sum, r) => {
    if ((r.insuranceMode === "care" || r.insuranceMode === "preventive") && r.applyShoguKaizen) {
      return sum + r.total;
    }
    return sum;
  }, 0);
  // 処遇改善加算を適用する訪問日が1件以上あれば計算
  const hasShoguKaizen = monthlyResults.some(r =>
    (r.insuranceMode === "care" || r.insuranceMode === "preventive") && r.applyShoguKaizen
  );
  // 地域単価は最初の介護保険訪問日の単価を使用
  const firstCareResult = monthlyResults.find(r => r.insuranceMode === "care" || r.insuranceMode === "preventive");
  const shoguKaizenRate = firstCareResult
    ? CARE_REGION_RATES[firstCareResult.insuranceMode === "care"
        ? firstCareResult.careInput.regionRate
        : firstCareResult.preventiveCareInput.regionRate]
    : 10.00;
  const monthlyShoguKaizen = hasShoguKaizen
    ? calcShoguKaizenKasan(careMonthlyTotalUnits, shoguKaizenRate)
    : { units: 0, yen: 0 };

  // 介護保険の自己負担割合（最初の介護保険訪問日から取得）
  const firstCareCopayRatio = firstCareResult ? parseInt(firstCareResult.copayInput.careCopayRatio) / 10 : 0.1;
  const shoguKaizenCopay = Math.floor(monthlyShoguKaizen.yen * firstCareCopayRatio);

  // ベースアップ評価料は月に1回定額（医療保険・精神科のみ適用）
  const hasBaseup = globalBaseupConfig.kind !== "none" &&
    monthlyResults.some(r => r.insuranceMode === "medical" || r.insuranceMode === "psychiatric");
  const monthlyBaseupYen = hasBaseup ? calcBaseupFee(globalBaseupConfig) : 0;
  // ベースアップ評価料の自己負担（医療保険の負担割合を最初の医療保険訪問日から取得）
  const firstMedicalResult = monthlyResults.find(r => r.insuranceMode === "medical" || r.insuranceMode === "psychiatric");
  const medicalCopayRatio = firstMedicalResult
    ? (firstMedicalResult.copayInput.copayRatio === "1" ? 0.1 : firstMedicalResult.copayInput.copayRatio === "2" ? 0.2 : 0.3)
    : 0.3;
  const baseupCopay = Math.floor(monthlyBaseupYen * medicalCopayRatio);

  const totalAmount = monthlyResults.reduce((sum, r) => sum + r.totalYen, 0) + monthlyShoguKaizen.yen + monthlyBaseupYen;
  const totalCopay = monthlyResults.reduce((sum, r) => sum + r.copayAmount, 0) + shoguKaizenCopay + baseupCopay;

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
    // グローバル算定条件もリセット
    setGlobalInsuranceMode("medical");
    setGlobalMedicalInput({ ...defaultInput });
    setGlobalCareInput({ ...defaultCareInput });
    setGlobalPreventiveCareInput({ ...defaultPreventiveCareInput });
    setGlobalPsychInput({ ...defaultPsychInput });
    setGlobalCopayInput({ ...defaultCopayInput });
    setGlobalBukkaTaiouType("type1");
    setGlobalBaseupConfig({ ...DEFAULT_BASEUP_CONFIG });
    setGlobalApplyShoguKaizen(false);
  }, []);

  const exportBackup = useCallback(() => {
    const data: PersistedAppData = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      year,
      month,
      globalInsuranceMode,
      visitDays,
      selectedDate,
      patientName,
      stationName,
      globalMedicalInput,
      globalCareInput,
      globalPreventiveCareInput,
      globalPsychInput,
      globalCopayInput,
      globalBukkaTaiouType,
      globalBaseupConfig,
      globalApplyShoguKaizen,
      homeStep,
    };
    downloadBackup(data);
  }, [
    year, month, globalInsuranceMode, visitDays, selectedDate, patientName, stationName,
    globalMedicalInput, globalCareInput, globalPreventiveCareInput, globalPsychInput, globalCopayInput,
    globalBukkaTaiouType, globalBaseupConfig, globalApplyShoguKaizen, homeStep,
  ]);

  const importBackup = useCallback(async (file: File) => {
    const imported = await readBackupFile(file);
    applyPersistedState(imported);
    setPersistenceError(null);
  }, [applyPersistedState]);

  return {
    year, month,
    globalInsuranceMode, setGlobalInsuranceMode,
    globalMedicalInput, setGlobalMedicalInput,
    globalCareInput, setGlobalCareInput,
    globalPreventiveCareInput, setGlobalPreventiveCareInput,
    globalPsychInput, setGlobalPsychInput,
    globalCopayInput, setGlobalCopayInput,
    globalBukkaTaiouType, setGlobalBukkaTaiouType,
    globalBaseupConfig, setGlobalBaseupConfig,
    globalApplyShoguKaizen, setGlobalApplyShoguKaizen,
    homeStep, setHomeStep,
    visitDays, currentMonthVisits, monthlyResults,
    totalAmount, totalCopay,
    // 処遇改善加算（月合計単位数から計算した月に1回の加算）
    monthlyShoguKaizenUnits: monthlyShoguKaizen.units,
    monthlyShoguKaizenYen: monthlyShoguKaizen.yen,
    monthlyShoguKaizenCopay: shoguKaizenCopay,
    careMonthlyTotalUnits,
    hasShoguKaizen,
    // ベースアップ評価料（月次集計・月に1回）
    monthlyBaseupYen,
    hasBaseup,
    baseupCopay,
    selectedDate, setSelectedDate,
    patientName, setPatientName,
    stationName, setStationName,
    isHydrated, persistenceError,
    getVisitDay, toggleVisitDay, removeVisitDay, updateVisitDay, copyPrevConditions, updateCopayForAll,
    prevMonth, nextMonth, clearAll, exportBackup, importBackup,
  };
}
