/**
 * 訪問看護療養費 算定エンジン
 * 令和8年度（2026年度）診療報酬改定 準拠
 * 令和6年度（2024年度）介護報酬改定 準拠
 *
 * Design Theme: ウォームアンバー・プロフェッショナル
 * - 全ての点数は「円」単位で管理（訪問看護療養費は点数ではなく円）
 * - 介護保険は「単位数」で管理し、地域単価で円換算
 * - 排他制御ロジックを明確に分離
 * - 計算結果は内訳付きで返却
 */

// ============================================================
// 型定義
// ============================================================

/** 保険種別 */
export type InsuranceType = "medical" | "care";

/** 算定方式（医療保険） */
export type CalcMode = "traditional" | "comprehensive";

/** 職種区分（医療保険） */
export type StaffType = "nurse" | "junkango" | "specialist" | "pt_ot_st";

/** 同一建物居住者の人数区分 */
export type BuildingResidentCount =
  | "1-2"
  | "3-9"
  | "10-19"
  | "20-49"
  | "50+";

/** 単一建物居住者の人数区分（管理療養費・包括型用） */
export type SingleBuildingResidentCount =
  | "under20"
  | "20-49"
  | "50+";

/** 訪問時間区分（包括型用） */
export type VisitDuration =
  | "30-60"
  | "60-90"
  | "90+"
  | "90+-special";

/** 時間帯区分 */
export type TimeZone =
  | "normal"
  | "early_late"
  | "midnight";

/** 複数名訪問の同行職種 */
export type CoVisitStaffType =
  | "nurse"
  | "junkango"
  | "other";

/** 難病等複数回訪問の回数 */
export type MultipleVisitCount = "twice" | "three_plus";

/** 月の訪問日数区分（管理療養費の2日目以降用） */
export type MonthlyVisitDays =
  | "1-15"
  | "16-24"
  | "25+";

/** 特別管理加算の区分 */
export type SpecialManagementType = "type1" | "type2";

/** 訪問看護情報提供療養費の区分 */
export type InfoProvisionType = "type1" | "type2" | "type3";

/** 週の訪問日数（基本療養費用） */
export type WeeklyVisitDay = "1-3" | "4+";

/** 月の訪問日数（基本療養費Ⅱ用） */
export type MonthlyVisitDayForBasic = "1-20" | "21+";

/** 訪問看護管理療養費の種別 */
export type ManagementFeeType =
  | "kinoka1"
  | "kinoka2"
  | "kinoka3"
  | "kinoka4"
  | "standard";

/** ターミナルケア療養費の区分 */
export type TerminalCareType = "type1" | "type2";

/** 患者負担割合 */
export type CopayRatio = "1" | "2" | "3";

/** 公費負担種別 */
export type KohiType =
  | "none"
  | "nanbyou"       // 指定難病（原則2割・上限あり）
  | "seishin"       // 自立支援医療（精神通院）（原則1割）
  | "seikatsu"      // 生活保護（自己負担なし）
  | "genpatsu"      // 原爆被爆者援護法（自己負担なし）
  | "jidou";        // こども医療費助成（自治体による）

/** 難病・自立支援の所得区分 */
export type KohiIncomeClass =
  | "seikatsu_hogo"  // 生活保護
  | "teishotoku1"    // 低所得1（非課税・本人年収80万以下）
  | "teishotoku2"    // 低所得2（非課税・本人年収80万超）
  | "ippan1"         // 一般所得1（7.1万円未満）
  | "ippan2"         // 一般所得2（25.1万円未満）
  | "jyoshotoku";    // 上位所得（25.1万円以上）

/** 介護保険の訪問看護費 - 事業所種別 */
export type CareProviderType = "station" | "hospital";

/** 介護保険の訪問看護費 - 訪問時間区分 */
export type CareVisitDuration =
  | "20min"     // 20分未満
  | "30min"     // 30分未満
  | "60min"     // 30分以上1時間未満
  | "90min"     // 1時間以上1時間30分未満
  | "pt_ot_st"; // 理学療法士等

/** 介護保険の地域区分単価（1単位あたりの円） */
export type CareRegionRate =
  | "10.90" // 1級地（東京23区等）
  | "10.72" // 2級地
  | "10.68" // 3級地
  | "10.54" // 4級地
  | "10.45" // 5級地
  | "10.42" // 6級地
  | "10.27" // 7級地
  | "10.00"; // その他

/** 月次集計の1訪問記録 */
export interface VisitRecord {
  id: string;
  date: string;
  label: string;
  amount: number;   // 医療保険の場合は円、介護保険の場合は単位数
  note?: string;
}

/** 計算条件の入力（医療保険） */
export interface CalcInput {
  mode: CalcMode;
  staffType: StaffType;
  weeklyVisitDay: WeeklyVisitDay;
  isSameBuilding: boolean;
  buildingResidentCount: BuildingResidentCount;
  monthlyVisitDayForBasic: MonthlyVisitDayForBasic;
  isFirstVisitOfMonth: boolean;
  managementFeeType: ManagementFeeType;
  singleBuildingResidentCount: SingleBuildingResidentCount;
  monthlyVisitDays: MonthlyVisitDays;
  visitDuration: VisitDuration;
  comprehensiveBuildingCount: SingleBuildingResidentCount;
  multipleVisit: boolean;
  multipleVisitCount: MultipleVisitCount;
  multipleVisitMonthDay: "1-20" | "21+";
  h24Support: boolean;
  h24SupportType: "ika" | "ro";
  specialManagement: boolean;
  specialManagementType: SpecialManagementType;
  infoProvision: boolean;
  infoProvisionType: InfoProvisionType;
  terminalCare: boolean;
  terminalCareType: TerminalCareType;
  coVisit: boolean;
  coVisitStaffType: CoVisitStaffType;
  timeZone: TimeZone;
  timeZoneMonthDay: "1-15" | "16+";
  bukkaTaiou: boolean;             // 訪問看護物価対応料1（医療保険）
  medicalInfoLinkage: boolean;      // 訪問看護医療情報連携加算（月1回・1,000円）
}

/** 計算条件の入力（介護保険） */
export interface CareCalcInput {
  providerType: CareProviderType;
  visitDuration: CareVisitDuration;
  regionRate: CareRegionRate;
  // 加算
  emergencyVisit: boolean;           // 緊急時訪問看護加算（Ⅰ）600単位/月
  specialManagement: boolean;        // 特別管理加算
  specialManagementType: "type1" | "type2"; // 500/250単位
  terminalCare: boolean;             // ターミナルケア加算 2500単位
  initialAdd: boolean;               // 初回加算（月1回）
  initialAddType: "type1" | "type2"; // 350/300単位
  multipleVisit: boolean;            // 複数名訪問看護加算（Ⅰ）
  multipleVisitType: "nurse" | "other"; // 看護師等/その他
  earlyLate: boolean;                // 夜間・早朝加算
  midnight: boolean;                 // 深夜加算
}

/** 患者負担設定 */
export interface PatientCopayInput {
  insuranceType: InsuranceType;
  // 医療保険
  copayRatio: CopayRatio;
  kohiType: KohiType;
  kohiIncomeClass: KohiIncomeClass;
  // 介護保険
  careCopayRatio: "1" | "2" | "3";
}

/** 計算結果の内訳 */
export interface CalcLineItem {
  label: string;
  amount: number;
  unit?: string;    // "円" or "単位"
  note?: string;
  disabled?: boolean;
}

/** 計算結果 */
export interface CalcResult {
  total: number;
  totalUnit?: number;   // 介護保険の場合の合計単位数
  totalYen?: number;    // 介護保険の場合の合計円換算
  items: CalcLineItem[];
  warnings: string[];
  copayAmount?: number;      // 患者自己負担額
  copayNote?: string;        // 負担額の注記
}

// ============================================================
// 点数テーブル（令和8年度改定後・医療保険）
// ============================================================

const BASIC_FEE_I: Record<StaffType, { "1-3": number; "4+": number }> = {
  nurse:      { "1-3": 5550, "4+": 6550 },
  junkango:   { "1-3": 5050, "4+": 6050 },
  specialist: { "1-3": 12850, "4+": 12850 },
  pt_ot_st:   { "1-3": 5550, "4+": 5550 },
};

const BASIC_FEE_II: Record<
  "nurse" | "junkango" | "pt_ot_st",
  Record<BuildingResidentCount, Record<WeeklyVisitDay, number | Record<MonthlyVisitDayForBasic, number>>>
> = {
  nurse: {
    "1-2":  { "1-3": 5550, "4+": 6550 },
    "3-9":  { "1-3": 2780, "4+": 3280 },
    "10-19":{ "1-3": { "1-20": 2760, "21+": 2660 }, "4+": { "1-20": 2760, "21+": 2660 } },
    "20-49":{ "1-3": { "1-20": 2710, "21+": 2610 }, "4+": { "1-20": 2710, "21+": 2610 } },
    "50+":  { "1-3": { "1-20": 2610, "21+": 2510 }, "4+": { "1-20": 2610, "21+": 2510 } },
  },
  junkango: {
    "1-2":  { "1-3": 5050, "4+": 6050 },
    "3-9":  { "1-3": 2530, "4+": 3030 },
    "10-19":{ "1-3": { "1-20": 2520, "21+": 2420 }, "4+": { "1-20": 2520, "21+": 2420 } },
    "20-49":{ "1-3": { "1-20": 2470, "21+": 2370 }, "4+": { "1-20": 2470, "21+": 2370 } },
    "50+":  { "1-3": { "1-20": 2370, "21+": 2270 }, "4+": { "1-20": 2370, "21+": 2270 } },
  },
  pt_ot_st: {
    "1-2":  { "1-3": 5550, "4+": 5550 },
    "3-9":  { "1-3": 2780, "4+": 2780 },
    "10-19":{ "1-3": { "1-20": 2760, "21+": 2660 }, "4+": { "1-20": 2760, "21+": 2660 } },
    "20-49":{ "1-3": { "1-20": 2710, "21+": 2610 }, "4+": { "1-20": 2710, "21+": 2610 } },
    "50+":  { "1-3": { "1-20": 2610, "21+": 2510 }, "4+": { "1-20": 2610, "21+": 2510 } },
  },
};

const MANAGEMENT_FEE_FIRST: Record<ManagementFeeType, number> = {
  kinoka1:  13760,
  kinoka2:  10460,
  kinoka3:   9030,
  kinoka4:   9030,
  standard:  7710,
};

const MANAGEMENT_FEE_SUBSEQUENT: Record<SingleBuildingResidentCount, Record<MonthlyVisitDays, number>> = {
  under20: { "1-15": 3010, "16-24": 3010, "25+": 3010 },
  "20-49": { "1-15": 2510, "16-24": 2310, "25+": 2210 },
  "50+":   { "1-15": 2410, "16-24": 2210, "25+": 2010 },
};

const COMPREHENSIVE_FEE: Record<SingleBuildingResidentCount, Record<VisitDuration, number>> = {
  under20: { "30-60": 7010, "60-90": 11010, "90+": 14010, "90+-special": 15510 },
  "20-49": { "30-60": 6310, "60-90":  9910, "90+": 13730, "90+-special": 15200 },
  "50+":   { "30-60": 5960, "60-90":  9360, "90+": 13450, "90+-special": 14890 },
};

const H24_SUPPORT_FEE: Record<"ika" | "ro", number> = {
  ika: 6800,
  ro:  6520,
};

const SPECIAL_MANAGEMENT_FEE: Record<SpecialManagementType, number> = {
  type1: 5000,
  type2: 2500,
};

const INFO_PROVISION_FEE = 1500;

const TERMINAL_CARE_FEE: Record<TerminalCareType, number> = {
  type1: 25000,
  type2: 10000,
};

const MULTIPLE_VISIT_FEE: Record<
  MultipleVisitCount,
  Record<BuildingResidentCount, number | Record<"1-20" | "21+", number>>
> = {
  twice: {
    "1-2":  4500,
    "3-9":  4000,
    "10-19": 3700,
    "20-49": 3500,
    "50+":  3300,
  },
  three_plus: {
    "1-2":  8000,
    "3-9":  { "1-20": 7200, "21+": 6900 },
    "10-19":{ "1-20": 6300, "21+": 5200 },
    "20-49":{ "1-20": 4800, "21+": 3500 },
    "50+":  { "1-20": 4100, "21+": 3000 },
  },
};

const CO_VISIT_FEE: Record<CoVisitStaffType, Record<BuildingResidentCount, number>> = {
  nurse: {
    "1-2":  4500, "3-9":  4000, "10-19": 3400, "20-49": 3000, "50+":  2700,
  },
  junkango: {
    "1-2":  3800, "3-9":  3400, "10-19": 2800, "20-49": 2500, "50+":  2200,
  },
  other: {
    "1-2":  3000, "3-9":  2700, "10-19": 2100, "20-49": 1900, "50+":  1600,
  },
};

const EARLY_LATE_FEE: Record<BuildingResidentCount, number | Record<"1-15" | "16+", number>> = {
  "1-2":  2100,
  "3-9":  { "1-15": 2100, "16+": 1900 },
  "10-19":{ "1-15": 1800, "16+": 1300 },
  "20-49":{ "1-15": 1200, "16+":  950 },
  "50+":  { "1-15": 1000, "16+":  800 },
};

const MIDNIGHT_FEE: Record<BuildingResidentCount, number | Record<"1-15" | "16+", number>> = {
  "1-2":  4200,
  "3-9":  { "1-15": 4200, "16+": 4000 },
  "10-19":{ "1-15": 3900, "16+": 2300 },
  "20-49":{ "1-15": 2100, "16+": 1500 },
  "50+":  { "1-15": 1800, "16+": 1300 },
};

// ============================================================
// 点数テーブル（令和6年度改定後・介護保険）
// ============================================================

/** 介護保険 訪問看護費 基本単位数（訪問看護ステーション） */
const CARE_BASIC_STATION: Record<CareVisitDuration, number> = {
  "20min":   314,
  "30min":   471,
  "60min":   823,
  "90min":  1128,
  "pt_ot_st": 294,
};

/** 介護保険 訪問看護費 基本単位数（病院・診療所） */
const CARE_BASIC_HOSPITAL: Record<CareVisitDuration, number> = {
  "20min":   266,
  "30min":   399,
  "60min":   574,
  "90min":   844,
  "pt_ot_st": 266, // 病院・診療所のPT等は20分未満と同単位
};

/** 介護保険 地域区分単価 */
export const CARE_REGION_RATES: Record<CareRegionRate, number> = {
  "10.90": 10.90,
  "10.72": 10.72,
  "10.68": 10.68,
  "10.54": 10.54,
  "10.45": 10.45,
  "10.42": 10.42,
  "10.27": 10.27,
  "10.00": 10.00,
};

/** 介護保険 加算単位数 */
const CARE_ADDITIONS = {
  emergencyVisitI:    600,   // 緊急時訪問看護加算（Ⅰ）/月
  emergencyVisitII:   574,   // 緊急時訪問看護加算（Ⅱ）/月
  specialMgmt1:       500,   // 特別管理加算（1）/月
  specialMgmt2:       250,   // 特別管理加算（2）/月
  terminalCare:      2500,   // ターミナルケア加算/月
  initialAddI:        350,   // 初回加算（Ⅰ）/月
  initialAddII:       300,   // 初回加算（Ⅱ）/月
  multipleVisitNurse: 254,   // 複数名訪問看護加算（Ⅰ）看護師等/回
  multipleVisitOther: 201,   // 複数名訪問看護加算（Ⅱ）その他/回
  earlyLate:          210,   // 夜間・早朝加算/回（所定単位数の25%相当）
  midnight:           420,   // 深夜加算/回（所定単位数の50%相当）
};

// ============================================================
// 公費負担 自己負担上限額テーブル
// ============================================================

/** 指定難病 月額自己負担上限額（一般） */
const NANBYOU_COPAY_LIMIT: Record<KohiIncomeClass, number> = {
  seikatsu_hogo: 0,
  teishotoku1:   2500,
  teishotoku2:   5000,
  ippan1:        10000,
  ippan2:        20000,
  jyoshotoku:    30000,
};

/** 自立支援医療（精神通院）月額自己負担上限額（重度かつ継続） */
const SEISHIN_COPAY_LIMIT_JYUDO: Record<KohiIncomeClass, number | null> = {
  seikatsu_hogo: 0,
  teishotoku1:   2500,
  teishotoku2:   5000,
  ippan1:        5000,
  ippan2:        10000,
  jyoshotoku:    20000,
};

// ============================================================
// ヘルパー関数
// ============================================================

function getEarlyLateFee(count: BuildingResidentCount, monthDay: "1-15" | "16+"): number {
  const fee = EARLY_LATE_FEE[count];
  if (typeof fee === "number") return fee;
  return fee[monthDay];
}

function getMidnightFee(count: BuildingResidentCount, monthDay: "1-15" | "16+"): number {
  const fee = MIDNIGHT_FEE[count];
  if (typeof fee === "number") return fee;
  return fee[monthDay];
}

function getMultipleVisitFee(
  count: MultipleVisitCount,
  buildingCount: BuildingResidentCount,
  monthDay: "1-20" | "21+"
): number {
  const fee = MULTIPLE_VISIT_FEE[count][buildingCount];
  if (typeof fee === "number") return fee;
  return fee[monthDay];
}

function getBasicFeeII(
  staffType: "nurse" | "junkango" | "pt_ot_st",
  buildingCount: BuildingResidentCount,
  weeklyDay: WeeklyVisitDay,
  monthlyDay: MonthlyVisitDayForBasic
): number {
  const feeByStaff = BASIC_FEE_II[staffType][buildingCount];
  const feeByWeekly = feeByStaff[weeklyDay];
  if (typeof feeByWeekly === "number") return feeByWeekly;
  return feeByWeekly[monthlyDay];
}

// ============================================================
// 排他制御ロジック
// ============================================================

export function getDisabledFields(input: CalcInput): Set<keyof CalcInput> {
  const disabled = new Set<keyof CalcInput>();

  if (input.mode === "comprehensive") {
    disabled.add("multipleVisit");
    disabled.add("multipleVisitCount");
    disabled.add("multipleVisitMonthDay");
    disabled.add("coVisit");
    disabled.add("coVisitStaffType");
    disabled.add("timeZone");
    disabled.add("timeZoneMonthDay");
    disabled.add("staffType");
    disabled.add("weeklyVisitDay");
    disabled.add("isSameBuilding");
    disabled.add("buildingResidentCount");
    disabled.add("monthlyVisitDayForBasic");
    disabled.add("isFirstVisitOfMonth");
    disabled.add("managementFeeType");
    disabled.add("singleBuildingResidentCount");
    disabled.add("monthlyVisitDays");
    disabled.add("h24Support");
    disabled.add("h24SupportType");
  }

  if (input.mode === "traditional") {
    disabled.add("visitDuration");
    disabled.add("comprehensiveBuildingCount");
  }

  if (!input.multipleVisit || input.mode === "comprehensive") {
    disabled.add("multipleVisitCount");
    disabled.add("multipleVisitMonthDay");
  }

  if (!input.coVisit || input.mode === "comprehensive") {
    disabled.add("coVisitStaffType");
  }

  if (!input.specialManagement) {
    disabled.add("specialManagementType");
  }

  if (!input.infoProvision) {
    disabled.add("infoProvisionType");
  }

  if (!input.terminalCare) {
    disabled.add("terminalCareType");
  }

  if (!input.h24Support) {
    disabled.add("h24SupportType");
  }

  if (!input.isSameBuilding) {
    disabled.add("buildingResidentCount");
    disabled.add("monthlyVisitDayForBasic");
  }

  if (!input.isFirstVisitOfMonth) {
    disabled.add("managementFeeType");
  }

  if (input.isFirstVisitOfMonth) {
    disabled.add("singleBuildingResidentCount");
    disabled.add("monthlyVisitDays");
  }

  return disabled;
}

// ============================================================
// 患者自己負担額計算
// ============================================================

export function calcCopay(
  totalAmount: number,
  copayInput: PatientCopayInput
): { amount: number; note: string } {
  const { insuranceType, copayRatio, kohiType, kohiIncomeClass, careCopayRatio } = copayInput;

  if (insuranceType === "care") {
    // 介護保険の自己負担
    const ratio = parseInt(careCopayRatio) / 10;
    const amount = Math.floor(totalAmount * ratio);
    return {
      amount,
      note: `介護保険 ${careCopayRatio}割負担`,
    };
  }

  // 医療保険の自己負担
  if (kohiType === "seikatsu" || kohiType === "genpatsu") {
    return { amount: 0, note: "公費負担（自己負担なし）" };
  }

  if (kohiType === "seishin") {
    // 自立支援医療（精神通院）：原則1割
    const baseAmount = Math.floor(totalAmount * 0.1);
    // 一定所得以上（上限なし）の場合は1割負担のみ
    if (kohiIncomeClass === "jyoshotoku") {
      return { amount: baseAmount, note: "自立支援医療（精神通院）1割負担（上限なし・一定所得以上）" };
    }
    const limit = SEISHIN_COPAY_LIMIT_JYUDO[kohiIncomeClass];
    if (limit === null || limit === undefined) {
      return { amount: baseAmount, note: "自立支援医療（精神通院）1割負担" };
    }
    const amount = Math.min(baseAmount, limit);
    return {
      amount,
      note: `自立支援医療（精神通院）1割負担・月額上限${limit.toLocaleString()}円（重度かつ継続）`,
    };
  }

  if (kohiType === "nanbyou") {
    // 指定難病：原則2割・月額上限あり
    const baseAmount = Math.floor(totalAmount * 0.2);
    const limit = NANBYOU_COPAY_LIMIT[kohiIncomeClass];
    const amount = Math.min(baseAmount, limit);
    return {
      amount,
      note: `指定難病医療費助成 2割負担・月額上限${limit.toLocaleString()}円`,
    };
  }

  if (kohiType === "jidou") {
    return { amount: 0, note: "こども医療費助成（自治体による・概算0円）" };
  }

  // 通常の医療保険
  const ratio = parseInt(copayRatio) / 10;
  const amount = Math.floor(totalAmount * ratio);
  const label = copayRatio === "1" ? "後期高齢者1割" : copayRatio === "2" ? "後期高齢者2割" : "3割";
  return { amount, note: `${label}負担` };
}

// ============================================================
// 介護保険 訪問看護費 計算
// ============================================================

export function calculateCare(input: CareCalcInput): CalcResult {
  const items: CalcLineItem[] = [];
  const warnings: string[] = [];
  const rate = CARE_REGION_RATES[input.regionRate];

  // 基本単位数
  const basicUnits = input.providerType === "station"
    ? CARE_BASIC_STATION[input.visitDuration]
    : CARE_BASIC_HOSPITAL[input.visitDuration];

  const durationLabel: Record<CareVisitDuration, string> = {
    "20min":    "20分未満",
    "30min":    "30分未満",
    "60min":    "30分以上1時間未満",
    "90min":    "1時間以上1時間30分未満",
    "pt_ot_st": "理学療法士等による訪問",
  };
  const providerLabel = input.providerType === "station" ? "訪問看護ステーション" : "病院・診療所";

  items.push({
    label: `訪問看護費（${providerLabel}・${durationLabel[input.visitDuration]}）`,
    amount: basicUnits,
    unit: "単位",
  });

  // 緊急時訪問看護加算（Ⅰ）
  if (input.emergencyVisit) {
    items.push({
      label: "緊急時訪問看護加算（Ⅰ）",
      amount: CARE_ADDITIONS.emergencyVisitI,
      unit: "単位",
      note: "月1回算定",
    });
  }

  // 特別管理加算
  if (input.specialManagement) {
    const units = input.specialManagementType === "type1"
      ? CARE_ADDITIONS.specialMgmt1
      : CARE_ADDITIONS.specialMgmt2;
    const typeLabel = input.specialManagementType === "type1" ? "（1）" : "（2）";
    items.push({
      label: `特別管理加算${typeLabel}`,
      amount: units,
      unit: "単位",
      note: "月1回算定",
    });
  }

  // 初回加算（Ⅰ・Ⅱは同一月に併算定不可）
  if (input.initialAdd) {
    const units = input.initialAddType === "type1"
      ? CARE_ADDITIONS.initialAddI
      : CARE_ADDITIONS.initialAddII;
    const typeLabel = input.initialAddType === "type1"
      ? "（Ⅰ）退院当日の初回訪問"
      : "（Ⅱ）その他の初回訪問";
    items.push({
      label: `初回加算${typeLabel}`,
      amount: units,
      unit: "単位",
      note: "月1回算定・ⅠとⅡは併算定不可",
    });
  }

  // ターミナルケア加算
  if (input.terminalCare) {
    items.push({
      label: "ターミナルケア加算",
      amount: CARE_ADDITIONS.terminalCare,
      unit: "単位",
      note: "死亡月に算定",
    });
  }

  // 複数名訪問看護加算
  if (input.multipleVisit) {
    const units = input.multipleVisitType === "nurse"
      ? CARE_ADDITIONS.multipleVisitNurse
      : CARE_ADDITIONS.multipleVisitOther;
    const typeLabel = input.multipleVisitType === "nurse" ? "（Ⅰ）看護師等" : "（Ⅱ）その他";
    items.push({
      label: `複数名訪問看護加算${typeLabel}`,
      amount: units,
      unit: "単位",
    });
  }

  // 夜間・早朝加算
  if (input.earlyLate) {
    const units = Math.round(basicUnits * 0.25);
    items.push({
      label: "夜間・早朝加算（所定単位数の25%）",
      amount: units,
      unit: "単位",
    });
  }

  // 深夜加算
  if (input.midnight) {
    const units = Math.round(basicUnits * 0.50);
    items.push({
      label: "深夜加算（所定単位数の50%）",
      amount: units,
      unit: "単位",
    });
  }

  const totalUnits = items.filter(i => !i.disabled).reduce((sum, i) => sum + i.amount, 0);
  const totalYen = Math.floor(totalUnits * rate);

  return {
    total: totalUnits,
    totalUnit: totalUnits,
    totalYen,
    items,
    warnings,
  };
}

// ============================================================
// 医療保険 メイン計算関数
// ============================================================

export function calculate(input: CalcInput): CalcResult {
  const items: CalcLineItem[] = [];
  const warnings: string[] = [];

  if (input.mode === "traditional") {
    // 訪問看護基本療養費
    let basicFee = 0;
    let basicFeeLabel = "";

    if (!input.isSameBuilding) {
      if (input.staffType === "specialist") {
        basicFee = 12850;
        basicFeeLabel = "訪問看護基本療養費（Ⅰ）ハ 専門看護師（緩和ケア等）";
      } else {
        const weekKey = input.weeklyVisitDay === "4+" ? "4+" : "1-3";
        basicFee = BASIC_FEE_I[input.staffType][weekKey];
        const staffLabel = input.staffType === "nurse" ? "保健師・助産師・看護師"
          : input.staffType === "junkango" ? "准看護師"
          : "PT・OT・ST";
        const dayLabel = input.weeklyVisitDay === "4+" ? "週4日目以降" : "週3日目まで";
        const subLabel = input.staffType === "nurse" ? "イ"
          : input.staffType === "junkango" ? "ロ" : "ニ";
        basicFeeLabel = `訪問看護基本療養費（Ⅰ）${subLabel} ${staffLabel}・${dayLabel}`;
      }
    } else {
      if (input.staffType === "specialist") {
        basicFee = 12850;
        basicFeeLabel = "訪問看護基本療養費（Ⅱ）ハ 専門看護師（同一建物）";
      } else {
        const staffTypeForFee = input.staffType as "nurse" | "junkango" | "pt_ot_st";
        basicFee = getBasicFeeII(
          staffTypeForFee,
          input.buildingResidentCount,
          input.weeklyVisitDay,
          input.monthlyVisitDayForBasic
        );
        const countLabel: Record<BuildingResidentCount, string> = {
          "1-2":  "同一建物2人",
          "3-9":  "同一建物3〜9人",
          "10-19":"同一建物10〜19人",
          "20-49":"同一建物20〜49人",
          "50+":  "同一建物50人以上",
        };
        const staffLabel = input.staffType === "nurse" ? "保健師・助産師・看護師"
          : input.staffType === "junkango" ? "准看護師"
          : "PT・OT・ST";
        const subLabel = input.staffType === "nurse" ? "イ"
          : input.staffType === "junkango" ? "ロ" : "ニ";
        const dayLabel = input.weeklyVisitDay === "4+" ? "週4日目以降" : "週3日目まで";
        const monthLabel = input.monthlyVisitDayForBasic === "21+" ? "月21日目以降" : "月20日目まで";
        const needsMonthLabel = ["10-19","20-49","50+"].includes(input.buildingResidentCount);
        basicFeeLabel = `訪問看護基本療養費（Ⅱ）${subLabel} ${staffLabel}・${countLabel[input.buildingResidentCount]}・${dayLabel}${needsMonthLabel ? `・${monthLabel}` : ""}`;
      }
    }

    items.push({ label: basicFeeLabel, amount: basicFee, unit: "円" });

    // 訪問看護管理療養費
    let managementFee = 0;
    let managementFeeLabel = "";

    if (input.isFirstVisitOfMonth) {
      managementFee = MANAGEMENT_FEE_FIRST[input.managementFeeType];
      const typeLabel: Record<ManagementFeeType, string> = {
        kinoka1:  "機能強化型1",
        kinoka2:  "機能強化型2",
        kinoka3:  "機能強化型3",
        kinoka4:  "機能強化型4（新設）",
        standard: "通常",
      };
      managementFeeLabel = `訪問看護管理療養費（月初日・${typeLabel[input.managementFeeType]}）`;
    } else {
      managementFee = MANAGEMENT_FEE_SUBSEQUENT[input.singleBuildingResidentCount][input.monthlyVisitDays];
      const countLabel: Record<SingleBuildingResidentCount, string> = {
        under20: "単一建物20人未満",
        "20-49": "単一建物20〜49人",
        "50+":   "単一建物50人以上",
      };
      const dayLabel: Record<MonthlyVisitDays, string> = {
        "1-15":  "月15日以下",
        "16-24": "月16〜24日",
        "25+":   "月25日以上",
      };
      managementFeeLabel = `訪問看護管理療養費（2日目以降・${countLabel[input.singleBuildingResidentCount]}・${dayLabel[input.monthlyVisitDays]}）`;
    }

    items.push({ label: managementFeeLabel, amount: managementFee, unit: "円" });

    // 難病等複数回訪問加算
    if (input.multipleVisit) {
      const effectiveBuildingCount = input.isSameBuilding ? input.buildingResidentCount : "1-2";
      const fee = getMultipleVisitFee(
        input.multipleVisitCount,
        effectiveBuildingCount,
        input.multipleVisitMonthDay
      );
      const countLabel = input.multipleVisitCount === "twice" ? "1日2回" : "1日3回以上";
      items.push({ label: `難病等複数回訪問加算（${countLabel}）`, amount: fee, unit: "円" });
    }

    // 複数名訪問加算
    if (input.coVisit) {
      const effectiveBuildingCount = input.isSameBuilding ? input.buildingResidentCount : "1-2";
      const fee = CO_VISIT_FEE[input.coVisitStaffType][effectiveBuildingCount];
      const staffLabel: Record<CoVisitStaffType, string> = {
        nurse:    "看護師等",
        junkango: "准看護師",
        other:    "その他職員",
      };
      items.push({ label: `複数名訪問加算（${staffLabel[input.coVisitStaffType]}との同行）`, amount: fee, unit: "円" });
    }

    // 早朝・夜間加算 / 深夜加算
    if (input.timeZone === "early_late") {
      const effectiveBuildingCount = input.isSameBuilding ? input.buildingResidentCount : "1-2";
      const fee = getEarlyLateFee(effectiveBuildingCount, input.timeZoneMonthDay);
      items.push({ label: "夜間・早朝訪問看護加算", amount: fee, unit: "円" });
    } else if (input.timeZone === "midnight") {
      const effectiveBuildingCount = input.isSameBuilding ? input.buildingResidentCount : "1-2";
      const fee = getMidnightFee(effectiveBuildingCount, input.timeZoneMonthDay);
      items.push({ label: "深夜訪問看護加算", amount: fee, unit: "円" });
    }

    // 24時間対応体制加算
    if (input.h24Support) {
      const fee = H24_SUPPORT_FEE[input.h24SupportType];
      const typeLabel = input.h24SupportType === "ika" ? "イ（負担軽減取組あり）" : "ロ（通常）";
      items.push({ label: `24時間対応体制加算${typeLabel}`, amount: fee, unit: "円", note: "月1回算定" });
    }

  } else {
    // 包括型訪問看護療養費
    const fee = COMPREHENSIVE_FEE[input.comprehensiveBuildingCount][input.visitDuration];
    const countLabel: Record<SingleBuildingResidentCount, string> = {
      under20: "単一建物20人未満",
      "20-49": "単一建物20〜49人",
      "50+":   "単一建物50人以上",
    };
    const durationLabel: Record<VisitDuration, string> = {
      "30-60":       "30分以上60分未満",
      "60-90":       "60分以上90分未満",
      "90+":         "90分以上",
      "90+-special": "90分以上（特別な場合）",
    };
    items.push({
      label: `包括型訪問看護療養費（${countLabel[input.comprehensiveBuildingCount]}・${durationLabel[input.visitDuration]}）`,
      amount: fee,
      unit: "円",
      note: "1日単位の包括評価",
    });

    if (input.multipleVisit) {
      items.push({ label: "難病等複数回訪問加算", amount: 0, unit: "円", note: "包括型では算定不可（包括評価に含まれます）", disabled: true });
      warnings.push("包括型では難病等複数回訪問加算は算定できません。");
    }
    if (input.coVisit) {
      items.push({ label: "複数名訪問加算", amount: 0, unit: "円", note: "包括型では算定不可", disabled: true });
      warnings.push("包括型では複数名訪問加算は算定できません。");
    }
    if (input.timeZone !== "normal") {
      items.push({
        label: input.timeZone === "early_late" ? "夜間・早朝訪問看護加算" : "深夜訪問看護加算",
        amount: 0, unit: "円", note: "包括型では算定不可（包括評価に含まれます）", disabled: true,
      });
      warnings.push("包括型では夜間・早朝加算・深夜加算は算定できません。");
    }
    if (input.h24Support) {
      items.push({ label: "24時間対応体制加算", amount: 0, unit: "円", note: "包括型では算定不可", disabled: true });
      warnings.push("包括型では24時間対応体制加算は算定できません。");
    }
  }

  // 共通加算
  if (input.specialManagement) {
    const fee = SPECIAL_MANAGEMENT_FEE[input.specialManagementType];
    const typeLabel = input.specialManagementType === "type1" ? "（1）重症度の高い者" : "（2）特別な管理が必要な者";
    items.push({ label: `特別管理加算${typeLabel}`, amount: fee, unit: "円", note: "月1回算定" });
  }

  if (input.infoProvision) {
    const typeLabel: Record<InfoProvisionType, string> = {
      type1: "1（市町村等への情報提供）",
      type2: "2（学校等への情報提供）",
      type3: "3（保険医療機関への情報提供）",
    };
    items.push({ label: `訪問看護情報提供療養費${typeLabel[input.infoProvisionType]}`, amount: INFO_PROVISION_FEE, unit: "円", note: "月1回算定" });
  }

  if (input.terminalCare) {
    const fee = TERMINAL_CARE_FEE[input.terminalCareType];
    const typeLabel = input.terminalCareType === "type1" ? "1（在宅死亡）" : "2（特養等での死亡）";
    items.push({ label: `訪問看護ターミナルケア療養費${typeLabel}`, amount: fee, unit: "円", note: "死亡月に算定" });
  }

  // 訪問看護物価対応料1（医療保険）
  if (input.bukkaTaiou) {
    const fee = input.isFirstVisitOfMonth ? BUKKA_TAIOU_RYO.type1_first : BUKKA_TAIOU_RYO.type1_subsequent;
    items.push({
      label: `訪問看護物価対応料1（${input.isFirstVisitOfMonth ? "月初日60円" : "2日目以降20円"}）`,
      amount: fee,
      unit: "円",
      note: "令和9年6月以降2倍に引上げ予定",
    });
  }

  // 訪問看護医療情報連携加算（令和8年6月〜新設）
  if (input.medicalInfoLinkage) {
    items.push({
      label: "訪問看護医療情報連携加算",
      amount: 1000,
      unit: "円",
      note: "月1回算定・ICT活用による多職種連携",
    });
  }

  const total = items.filter(i => !i.disabled).reduce((sum, item) => sum + item.amount, 0);
  return { total, items, warnings };
}

// ============================================================
// 月次集計
// ============================================================

export interface MonthlyRecord {
  id: string;
  date: string;         // YYYY-MM-DD
  visitLabel: string;   // 表示用ラベル
  total: number;        // 1回の訪問の合計額（円 or 単位）
  copayAmount: number;  // 患者自己負担額
  items: CalcLineItem[];
}

export interface MonthlySummary {
  records: MonthlyRecord[];
  totalAmount: number;
  totalCopay: number;
  visitCount: number;
}

export function calcMonthlySummary(records: MonthlyRecord[]): MonthlySummary {
  const totalAmount = records.reduce((sum, r) => sum + r.total, 0);
  const totalCopay = records.reduce((sum, r) => sum + r.copayAmount, 0);
  return {
    records,
    totalAmount,
    totalCopay,
    visitCount: records.length,
  };
}

// ============================================================
// ユーティリティ
// ============================================================

export function formatYen(amount: number): string {
  return amount.toLocaleString("ja-JP") + "円";
}

export function formatUnits(units: number, rate: number): string {
  const yen = Math.floor(units * rate);
  return `${units.toLocaleString()}単位（${yen.toLocaleString()}円）`;
}

/** デフォルト入力値（医療保険） */
export const defaultInput: CalcInput = {
  mode: "traditional",
  staffType: "nurse",
  weeklyVisitDay: "1-3",
  isSameBuilding: false,
  buildingResidentCount: "1-2",
  monthlyVisitDayForBasic: "1-20",
  isFirstVisitOfMonth: true,
  managementFeeType: "standard",
  singleBuildingResidentCount: "under20",
  monthlyVisitDays: "1-15",
  visitDuration: "30-60",
  comprehensiveBuildingCount: "under20",
  multipleVisit: false,
  multipleVisitCount: "twice",
  multipleVisitMonthDay: "1-20",
  h24Support: false,
  h24SupportType: "ika",
  specialManagement: false,
  specialManagementType: "type1",
  infoProvision: false,
  infoProvisionType: "type1",
  terminalCare: false,
  terminalCareType: "type1",
  coVisit: false,
  coVisitStaffType: "nurse",
  timeZone: "normal",
  timeZoneMonthDay: "1-15",
  bukkaTaiou: false,
  medicalInfoLinkage: false,
};

/** デフォルト入力値（介護保険） */
export const defaultCareInput: CareCalcInput = {
  providerType: "station",
  visitDuration: "60min",
  regionRate: "10.00",
  emergencyVisit: false,
  specialManagement: false,
  specialManagementType: "type1",
  terminalCare: false,
  initialAdd: false,
  initialAddType: "type2",
  multipleVisit: false,
  multipleVisitType: "nurse",
  earlyLate: false,
  midnight: false,
};

/** デフォルト患者負担設定 */
export const defaultCopayInput: PatientCopayInput = {
  insuranceType: "medical",
  copayRatio: "1",
  kohiType: "none",
  kohiIncomeClass: "ippan1",
  careCopayRatio: "1",
};

/** 地域区分の選択肢 */
export const CARE_REGION_OPTIONS: { value: CareRegionRate; label: string }[] = [
  { value: "10.90", label: "1級地（東京23区等）10.90円" },
  { value: "10.72", label: "2級地 10.72円" },
  { value: "10.68", label: "3級地 10.68円" },
  { value: "10.54", label: "4級地 10.54円" },
  { value: "10.45", label: "5級地 10.45円" },
  { value: "10.42", label: "6級地 10.42円" },
  { value: "10.27", label: "7級地 10.27円" },
  { value: "10.00", label: "その他 10.00円" },
];

// ============================================================
// 精神科訪問看護 型定義
// ============================================================

/** 精神科訪問看護基本療養費の区分 */
export type PsychBasicFeeType =
  | "type1"    // 基本療養費Ⅰ（通常・同一建物1人）
  | "type2"    // 基本療養費Ⅱ（同一建物2人）
  | "type3"    // 基本療養費Ⅲ（同一建物3人以上）
  | "type4";   // 基本療養費Ⅳ（外泊中）

/** 精神科訪問看護の訪問時間区分 */
export type PsychVisitDuration = "under30" | "over30";

/** 精神科複数回訪問加算の回数 */
export type PsychMultipleVisitCount = "twice" | "three_plus";

/** 精神科訪問看護 計算入力 */
export interface PsychCalcInput {
  basicFeeType: PsychBasicFeeType;
  visitDuration: PsychVisitDuration;
  weeklyVisitDay: WeeklyVisitDay;
  isFirstVisitOfMonth: boolean;
  managementFeeType: ManagementFeeType;
  singleBuildingResidentCount: SingleBuildingResidentCount;
  monthlyVisitDays: MonthlyVisitDays;
  // 加算
  emergencyVisit: boolean;        // 精神科緊急訪問看護加算 2,650円
  longTimeVisit: boolean;         // 長時間精神科訪問看護加算 5,200円
  timeZone: TimeZone;
  multipleStaff: boolean;         // 複数名精神科訪問看護加算
  multipleStaffType: "nurse" | "junkanshi" | "helper"; // 看護師等/准看護師/看護補助者・精神保健福祉士
  multipleStaffBuildingCount: PsychBuildingCount; // 同一建物居住者区分
  multipleStaffDailyCount: "once" | "twice" | "three"; // 1日1回/2回/3回以上（看護師等・准看護師のみ）
  multipleVisit: boolean;         // 精神科複数回訪問加算
  multipleVisitCount: PsychMultipleVisitCount;
  multipleVisitBuildingCount: PsychBuildingCount; // 同一建物居住者区分
  multipleVisitIsAfter21: boolean; // 3回以上の場合：月21日目以降か否か
  h24Support: boolean;            // 24時間対応体制加算
  h24SupportType: "ika" | "ro";
  specialManagement: boolean;
  specialManagementType: SpecialManagementType;
  infoProvision: boolean;         // 訪問看護情報提供療養費
  infoProvisionType: InfoProvisionType;
  terminalCare: boolean;
  terminalCareType: TerminalCareType;
  bukkaTaiou: boolean;             // 訪問看護物価対応料1（区分番号02を算定する精神科訪問看護）
  medicalInfoLinkage: boolean;      // 訪問看護医療情報連携加算（月1回・1,000円）
}

/** 自立支援医療の月額上限管理入力 */
export interface SeishinCopayTracker {
  monthlyLimit: number;      // 月額上限額（円）0=上限なし
  alreadyPaid: number;       // 今月すでに支払った累計額（円）
  noLimit: boolean;          // 上限なし（自立支援医療の対象外・一定所得以上等）
}

// ============================================================
// 介護予防訪問看護 型定義
// ============================================================

/** 介護予防訪問看護費の訪問時間区分 */
export type PreventiveCareVisitDuration =
  | "20min"      // 20分未満
  | "30min"      // 30分未満
  | "60min"      // 30分以上1時間未満
  | "90min"      // 1時間以上1時間30分未満
  | "pt_ot_st";  // 理学療法士等

/** 介護予防訪問看護 計算入力 */
export interface PreventiveCareCalcInput {
  providerType: CareProviderType;
  visitDuration: PreventiveCareVisitDuration;
  regionRate: CareRegionRate;
  // 加算
  emergencyVisit: boolean;           // 緊急時訪問看護加算（Ⅰ）600単位/月
  specialManagement: boolean;        // 特別管理加算
  specialManagementType: "type1" | "type2"; // 500/250単位
  terminalCare: boolean;             // ターミナルケア加算 2500単位
  multipleVisit: boolean;            // 複数名訪問看護加算（Ⅰ）
  multipleVisitType: "nurse" | "other";
  earlyLate: boolean;                // 夜間・早朝加算
  midnight: boolean;                 // 深夜加算
  initialAdd: boolean;               // 初回加算
  initialAddType: "type1" | "type2"; // 350/300単位
}

// ============================================================
// 精神科訪問看護 点数テーブル（令和6年度改定後）
// ============================================================

/** 精神科基本療養費Ⅰ・Ⅱ（通常・同一建物2人） */
const PSYCH_BASIC_FEE_I_II: Record<WeeklyVisitDay, Record<PsychVisitDuration, number>> = {
  "1-3": { under30: 4250, over30: 5550 },
  "4+":  { under30: 5100, over30: 6550 },
};

/** 精神科基本療養費Ⅲ（同一建物3人以上） */
const PSYCH_BASIC_FEE_III: Record<WeeklyVisitDay, Record<PsychVisitDuration, number>> = {
  "1-3": { under30: 2130, over30: 2780 },
  "4+":  { under30: 2550, over30: 3280 },
};

/** 精神科基本療養費Ⅳ（外泊中） */
const PSYCH_BASIC_FEE_IV = 8500;

/** 精神科訪問看護 加算（固定金額） */
const PSYCH_ADDITIONS = {
  emergencyVisit:      2650,  // 精神科緊急訪問看護加算
  longTimeVisit:       5200,  // 長時間精神科訪問看護加算
  earlyLate:           2100,  // 夜間・早朝訪問看護加算
  midnight:            4200,  // 深夜訪問看護加算
};

/** 同一建物居住者区分（精神科複数名・複数回加算用） */
export type PsychBuildingCount = "1-2" | "10-19" | "20-49" | "50+";

/**
 * 複数名精神科訪問看護加算（令和8年度改定）
 * 1-2人（通常）は1日1回・2回・3回以上で区分あり
 * 10-19人以上は建物区分のみ（回数区分なし）
 */
export const PSYCH_MULTIPLE_STAFF_NURSE_FEES: Record<PsychBuildingCount, { once: number; twice: number; three: number }> = {
  "1-2":   { once: 4500, twice: 9000, three: 13500 }, // 1-2人（通常）
  "10-19": { once: 3400, twice: 6880, three: 11050 }, // 同一建物10-19人
  "20-49": { once: 3000, twice: 6070, three:  9750 }, // 同一建物20-49人
  "50+":   { once: 2700, twice: 5460, three:  8770 }, // 同一建物50人以上
};

export const PSYCH_MULTIPLE_STAFF_JUNKANSHI_FEES: Record<PsychBuildingCount, { once: number; twice: number; three: number }> = {
  "1-2":   { once: 3800, twice: 7600, three: 11400 }, // 1-2人（通常）
  "10-19": { once: 2800, twice: 5600, three:  9220 }, // 同一建物10-19人
  "20-49": { once: 2500, twice: 5000, three:  8230 }, // 同一建物20-49人
  "50+":   { once: 2200, twice: 4400, three:  7240 }, // 同一建物50人以上
};

/** 複数名精神科訪問看護加算（看護補助者・精神保健福祉士）建物区分のみ・回数区分なし */
export const PSYCH_MULTIPLE_STAFF_HELPER_FEES: Record<PsychBuildingCount, number> = {
  "1-2":   3000, // 1-2人（通常）
  "10-19": 2100, // 同一建物10-19人
  "20-49": 1900, // 同一建物20-49人
  "50+":   1600, // 同一建物50人以上
};

/**
 * 精神科複数回訪問加算（令和8年度改定）
 * 2回：建物区分のみ（月日区分なし）
 * 3回以上：建物区分×月20日目まで/21日目以降
 */
export const PSYCH_MULTIPLE_VISIT_TWICE_FEES: Record<PsychBuildingCount, number> = {
  "1-2":   7200, // 1-2人（通常）
  "10-19": 3700, // 同一建物10-19人
  "20-49": 3500, // 同一建物20-49人
  "50+":   3300, // 同一建物50人以上
};

export const PSYCH_MULTIPLE_VISIT_THREE_FEES: Record<PsychBuildingCount, { upto20: number; from21: number }> = {
  "1-2":   { upto20: 7200, from21: 7200 }, // 1-2人（通常）※月日区分なし
  "10-19": { upto20: 6300, from21: 5200 }, // 同一建物10-19人
  "20-49": { upto20: 4800, from21: 3500 }, // 同一建物20-49人
  "50+":   { upto20: 4100, from21: 3000 }, // 同一建物50人以上
};

// ============================================================
// 介護予防訪問看護 点数テーブル（令和6年度改定後）
// ============================================================

/** 介護予防訪問看護費 基本単位数（訪問看護ステーション） */
const PREVENTIVE_CARE_BASIC_STATION: Record<PreventiveCareVisitDuration, number> = {
  "20min":    303,
  "30min":    451,
  "60min":    794,
  "90min":   1087,
  "pt_ot_st": 294,
};

/** 介護予防訪問看護費 基本単位数（病院・診療所） */
const PREVENTIVE_CARE_BASIC_HOSPITAL: Record<PreventiveCareVisitDuration, number> = {
  "20min":    266,
  "30min":    399,
  "60min":    574,
  "90min":    844,
  "pt_ot_st": 266,
};

/** 介護予防訪問看護 加算単位数 */
const PREVENTIVE_CARE_ADDITIONS = {
  emergencyVisitI:    600,   // 緊急時訪問看護加算（Ⅰ）/月
  specialMgmt1:       500,   // 特別管理加算（1）/月
  specialMgmt2:       250,   // 特別管理加算（2）/月
  terminalCare:      2500,   // ターミナルケア加算/月
  initialAddI:        350,   // 初回加算（Ⅰ）/月（新設）
  initialAddII:       300,   // 初回加算（Ⅱ）/月
  multipleVisitNurse: 254,   // 複数名訪問看護加算（Ⅰ）看護師等/回
  multipleVisitOther: 201,   // 複数名訪問看護加算（Ⅱ）その他/回
};

// ============================================================
// 自立支援医療 月額上限管理
// ============================================================

/**
 * 自立支援医療（精神通院）の今回の実際の支払額を計算する。
 * 月の累計支払済み額と月額上限から、今回の訪問で実際に支払う額を返す。
 *
 * @param baseAmount    今回の訪問の本来の自己負担額（1割計算後）
 * @param tracker       月額上限と累計支払済み額
 * @returns             実際の支払額と注記
 */
export function calcSeishinCopayWithTracker(
  baseAmount: number,
  tracker: SeishinCopayTracker
): { actualPayment: number; note: string; remainingBudget: number } {
  const { monthlyLimit, alreadyPaid } = tracker;

  // 上限なし設定の場合
  if (tracker.noLimit || monthlyLimit <= 0) {
    return {
      actualPayment: baseAmount,
      note: "自立支援医療（精神通院）1割負担（月額上限なし）",
      remainingBudget: -1,
    };
  }

  const remainingBudget = Math.max(0, monthlyLimit - alreadyPaid);

  if (remainingBudget <= 0) {
    // すでに上限に達している
    return {
      actualPayment: 0,
      note: `自立支援医療 月額上限${monthlyLimit.toLocaleString()}円に達しているため自己負担なし`,
      remainingBudget: 0,
    };
  }

  const actualPayment = Math.min(baseAmount, remainingBudget);
  const newTotal = alreadyPaid + actualPayment;
  const isAtLimit = newTotal >= monthlyLimit;

  return {
    actualPayment,
    note: isAtLimit
      ? `自立支援医療 1割負担・今回で月額上限${monthlyLimit.toLocaleString()}円に到達`
      : `自立支援医療 1割負担・今回支払後累計${newTotal.toLocaleString()}円（上限${monthlyLimit.toLocaleString()}円まで残${(monthlyLimit - newTotal).toLocaleString()}円）`,
    remainingBudget: Math.max(0, monthlyLimit - newTotal),
  };
}

// ============================================================
// 精神科訪問看護 メイン計算関数
// ============================================================

export function calculatePsychiatric(input: PsychCalcInput): CalcResult {
  const items: CalcLineItem[] = [];
  const warnings: string[] = [];

  // 基本療養費
  let basicFee = 0;
  let basicFeeLabel = "";

  if (input.basicFeeType === "type4") {
    basicFee = PSYCH_BASIC_FEE_IV;
    basicFeeLabel = "精神科訪問看護基本療養費Ⅳ（外泊中）";
  } else if (input.basicFeeType === "type3") {
    basicFee = PSYCH_BASIC_FEE_III[input.weeklyVisitDay][input.visitDuration];
    const dayLabel = input.weeklyVisitDay === "4+" ? "週4日目以降" : "週3日目まで";
    const timeLabel = input.visitDuration === "over30" ? "30分以上" : "30分未満";
    basicFeeLabel = `精神科訪問看護基本療養費Ⅲ（同一建物3人以上・${dayLabel}・${timeLabel}）`;
  } else {
    basicFee = PSYCH_BASIC_FEE_I_II[input.weeklyVisitDay][input.visitDuration];
    const dayLabel = input.weeklyVisitDay === "4+" ? "週4日目以降" : "週3日目まで";
    const timeLabel = input.visitDuration === "over30" ? "30分以上" : "30分未満";
    const typeLabel = input.basicFeeType === "type2" ? "Ⅱ（同一建物2人）" : "Ⅰ（通常）";
    basicFeeLabel = `精神科訪問看護基本療養費${typeLabel}・${dayLabel}・${timeLabel}`;
  }

  items.push({ label: basicFeeLabel, amount: basicFee, unit: "円" });

  // 訪問看護管理療養費（精神科でも同じ管理療養費を算定）
  let managementFee = 0;
  let managementFeeLabel = "";

  if (input.isFirstVisitOfMonth) {
    managementFee = MANAGEMENT_FEE_FIRST[input.managementFeeType];
    const typeLabel: Record<ManagementFeeType, string> = {
      kinoka1:  "機能強化型1",
      kinoka2:  "機能強化型2",
      kinoka3:  "機能強化型3",
      kinoka4:  "機能強化型4（新設）",
      standard: "通常",
    };
    managementFeeLabel = `訪問看護管理療養費（月初日・${typeLabel[input.managementFeeType]}）`;
  } else {
    managementFee = MANAGEMENT_FEE_SUBSEQUENT[input.singleBuildingResidentCount][input.monthlyVisitDays];
    const countLabel: Record<SingleBuildingResidentCount, string> = {
      under20: "単一建物20人未満",
      "20-49": "単一建物20〜49人",
      "50+":   "単一建物50人以上",
    };
    const dayLabel: Record<MonthlyVisitDays, string> = {
      "1-15":  "月15日以下",
      "16-24": "月16〜24日",
      "25+":   "月25日以上",
    };
    managementFeeLabel = `訪問看護管理療養費（2日目以降・${countLabel[input.singleBuildingResidentCount]}・${dayLabel[input.monthlyVisitDays]}）`;
  }

  items.push({ label: managementFeeLabel, amount: managementFee, unit: "円" });

  // 精神科緊急訪問看護加算
  if (input.emergencyVisit) {
    items.push({
      label: "精神科緊急訪問看護加算",
      amount: PSYCH_ADDITIONS.emergencyVisit,
      unit: "円",
      note: "定期外の緊急訪問",
    });
  }

  // 長時間精神科訪問看護加算
  if (input.longTimeVisit) {
    items.push({
      label: "長時間精神科訪問看護加算",
      amount: PSYCH_ADDITIONS.longTimeVisit,
      unit: "円",
      note: "週1回（条件下では週3回）",
    });
  }

  // 夜間・早朝 / 深夜加算
  if (input.timeZone === "early_late") {
    items.push({
      label: "夜間・早朝訪問看護加算",
      amount: PSYCH_ADDITIONS.earlyLate,
      unit: "円",
    });
  } else if (input.timeZone === "midnight") {
    items.push({
      label: "深夜訪問看護加算",
      amount: PSYCH_ADDITIONS.midnight,
      unit: "円",
    });
  }

  // 複数名精神科訪問看護加算
  if (input.multipleStaff) {
    const bc = input.multipleStaffBuildingCount;
    const dc = input.multipleStaffDailyCount;
    let fee = 0;
    let typeLabel = "";
    if (input.multipleStaffType === "nurse") {
      fee = PSYCH_MULTIPLE_STAFF_NURSE_FEES[bc][dc];
      typeLabel = "仙6の保健師・看護師又は作業療法士と同時";
    } else if (input.multipleStaffType === "junkanshi") {
      fee = PSYCH_MULTIPLE_STAFF_JUNKANSHI_FEES[bc][dc];
      typeLabel = "准看護師と同時";
    } else {
      fee = PSYCH_MULTIPLE_STAFF_HELPER_FEES[bc];
      typeLabel = "看護補助者・精神保健福祉士と同時";
    }
    const bcLabel: Record<PsychBuildingCount, string> = {
      "1-2": "建物内1-2人",
      "10-19": "建物内10-19人",
      "20-49": "建物内20-49人",
      "50+": "建物内50人以上",
    };
    const dcLabel = input.multipleStaffType !== "helper"
      ? `・1日${dc === "once" ? "1" : dc === "twice" ? "2" : "3以上"}回`
      : "";
    items.push({
      label: `複数名精神科訪問看護加算（${typeLabel}・${bcLabel[bc]}${dcLabel}）`,
      amount: fee,
      unit: "円",
    });
  }

  // 精神科複数回訪問加算
  if (input.multipleVisit) {
    const bc = input.multipleVisitBuildingCount;
    const bcLabel: Record<PsychBuildingCount, string> = {
      "1-2": "建物内1-2人",
      "10-19": "建物内10-19人",
      "20-49": "建物内20-49人",
      "50+": "建物内50人以上",
    };
    let fee = 0;
    let countLabel = "";
    if (input.multipleVisitCount === "twice") {
      fee = PSYCH_MULTIPLE_VISIT_TWICE_FEES[bc];
      countLabel = `1日2回・${bcLabel[bc]}`;
    } else {
      const dayKey = input.multipleVisitIsAfter21 ? "from21" : "upto20";
      fee = PSYCH_MULTIPLE_VISIT_THREE_FEES[bc][dayKey];
      const dayLabel = input.multipleVisitIsAfter21 ? "月21日目以降" : "月20日目まで";
      countLabel = `1日3回以上・${bcLabel[bc]}・${dayLabel}`;
    }
    items.push({
      label: `精神科複数回訪問加算（${countLabel}）`,
      amount: fee,
      unit: "円",
    });
  }

  // 24時間対応体制加算
  if (input.h24Support) {
    const fee = H24_SUPPORT_FEE[input.h24SupportType];
    const typeLabel = input.h24SupportType === "ika" ? "イ（負担軽減取組あり）" : "ロ（通常）";
    items.push({
      label: `24時間対応体制加算${typeLabel}`,
      amount: fee,
      unit: "円",
      note: "月1回算定",
    });
  }

  // 特別管理加算
  if (input.specialManagement) {
    const fee = SPECIAL_MANAGEMENT_FEE[input.specialManagementType];
    const typeLabel = input.specialManagementType === "type1" ? "（1）重症度の高い者" : "（2）特別な管理が必要な者";
    items.push({
      label: `特別管理加算${typeLabel}`,
      amount: fee,
      unit: "円",
      note: "月1回算定",
    });
  }

  // 訪問看護情報提供療養費（精神科）
  if (input.infoProvision) {
    const typeLabel: Record<InfoProvisionType, string> = {
      type1: "Ⅰ（市町村等への情報提供）",
      type2: "Ⅱ（学校等への情報提供）",
      type3: "Ⅲ（保険医療機関への情報提供）",
    };
    items.push({
      label: `精神科訪問看護情報提供療養費${typeLabel[input.infoProvisionType]}`,
      amount: INFO_PROVISION_FEE,
      unit: "円",
      note: "月1回算定",
    });
  }

  // ターミナルケア療養費
  if (input.terminalCare) {
    const fee = TERMINAL_CARE_FEE[input.terminalCareType];
    const typeLabel = input.terminalCareType === "type1" ? "1（在宅死亡）" : "2（特養等での死亡）";
    items.push({
      label: `訪問看護ターミナルケア療養費${typeLabel}`,
      amount: fee,
      unit: "円",
      note: "死亡月に算定",
    });
  }

  // 訪問看護物価対応料1（精神科訪問看護は区分番号02を合わせて算定）
  if (input.bukkaTaiou) {
    const amount = input.isFirstVisitOfMonth ? 60 : 20;
    items.push({
      label: `訪問看護物価対応料1（${input.isFirstVisitOfMonth ? "月初日60円" : "2日目以降20円"}）`,
      amount,
      unit: "円",
      note: "区分番号02算定者が対象。令和9年6月以降は月初日120円・2日目以降40円",
    });
  }

  // 訪問看護医療情報連携加算（令和8年6月〜新設）
  if (input.medicalInfoLinkage) {
    items.push({
      label: "訪問看護医療情報連携加算",
      amount: 1000,
      unit: "円",
      note: "月1回算定・ICT活用による多職種連携",
    });
  }

  const total = items.filter(i => !i.disabled).reduce((sum, item) => sum + item.amount, 0);
  return { total, items, warnings };
}

// ============================================================
// 介護予防訪問看護 メイン計算関数
// ============================================================

export function calculatePreventiveCare(input: PreventiveCareCalcInput): CalcResult {
  const items: CalcLineItem[] = [];
  const warnings: string[] = [];
  const rate = CARE_REGION_RATES[input.regionRate];

  // 基本単位数
  const basicUnits = input.providerType === "station"
    ? PREVENTIVE_CARE_BASIC_STATION[input.visitDuration]
    : PREVENTIVE_CARE_BASIC_HOSPITAL[input.visitDuration];

  const durationLabel: Record<PreventiveCareVisitDuration, string> = {
    "20min":    "20分未満",
    "30min":    "30分未満",
    "60min":    "30分以上1時間未満",
    "90min":    "1時間以上1時間30分未満",
    "pt_ot_st": "理学療法士等による訪問",
  };
  const providerLabel = input.providerType === "station" ? "訪問看護ステーション" : "病院・診療所";

  items.push({
    label: `介護予防訪問看護費（${providerLabel}・${durationLabel[input.visitDuration]}）`,
    amount: basicUnits,
    unit: "単位",
  });

  // 緊急時訪問看護加算（Ⅰ）
  if (input.emergencyVisit) {
    items.push({
      label: "緊急時訪問看護加算（Ⅰ）",
      amount: PREVENTIVE_CARE_ADDITIONS.emergencyVisitI,
      unit: "単位",
      note: "月1回算定",
    });
  }

  // 特別管理加算
  if (input.specialManagement) {
    const units = input.specialManagementType === "type1"
      ? PREVENTIVE_CARE_ADDITIONS.specialMgmt1
      : PREVENTIVE_CARE_ADDITIONS.specialMgmt2;
    const typeLabel = input.specialManagementType === "type1" ? "（1）" : "（2）";
    items.push({
      label: `特別管理加算${typeLabel}`,
      amount: units,
      unit: "単位",
      note: "月1回算定",
    });
  }

  // ターミナルケア加算
  if (input.terminalCare) {
    items.push({
      label: "ターミナルケア加算",
      amount: PREVENTIVE_CARE_ADDITIONS.terminalCare,
      unit: "単位",
      note: "死亡月に算定",
    });
  }

  // 初回加算
  if (input.initialAdd) {
    const units = input.initialAddType === "type1"
      ? PREVENTIVE_CARE_ADDITIONS.initialAddI
      : PREVENTIVE_CARE_ADDITIONS.initialAddII;
    const typeLabel = input.initialAddType === "type1" ? "（Ⅰ）退院・施設退所後" : "（Ⅱ）通常";
    items.push({
      label: `初回加算${typeLabel}`,
      amount: units,
      unit: "単位",
      note: "月1回算定",
    });
  }

  // 複数名訪問看護加算
  if (input.multipleVisit) {
    const units = input.multipleVisitType === "nurse"
      ? PREVENTIVE_CARE_ADDITIONS.multipleVisitNurse
      : PREVENTIVE_CARE_ADDITIONS.multipleVisitOther;
    const typeLabel = input.multipleVisitType === "nurse" ? "（Ⅰ）看護師等" : "（Ⅱ）その他";
    items.push({
      label: `複数名訪問看護加算${typeLabel}`,
      amount: units,
      unit: "単位",
    });
  }

  // 夜間・早朝加算
  if (input.earlyLate) {
    const units = Math.round(basicUnits * 0.25);
    items.push({
      label: "夜間・早朝加算（所定単位数の25%）",
      amount: units,
      unit: "単位",
    });
  }

  // 深夜加算
  if (input.midnight) {
    const units = Math.round(basicUnits * 0.50);
    items.push({
      label: "深夜加算（所定単位数の50%）",
      amount: units,
      unit: "単位",
    });
  }

  const totalUnits = items.filter(i => !i.disabled).reduce((sum, i) => sum + i.amount, 0);
  const totalYen = Math.floor(totalUnits * rate);

  return {
    total: totalUnits,
    totalUnit: totalUnits,
    totalYen,
    items,
    warnings,
  };
}

/** デフォルト入力値（精神科訪問看護） */
export const defaultPsychInput: PsychCalcInput = {
  basicFeeType: "type1",
  visitDuration: "over30",
  weeklyVisitDay: "1-3",
  isFirstVisitOfMonth: true,
  managementFeeType: "standard",
  singleBuildingResidentCount: "under20",
  monthlyVisitDays: "1-15",
  emergencyVisit: false,
  longTimeVisit: false,
  timeZone: "normal",
  multipleStaff: false,
  multipleStaffType: "nurse",
  multipleStaffBuildingCount: "1-2",
  multipleStaffDailyCount: "once",
  multipleVisit: false,
  multipleVisitCount: "twice",
  multipleVisitBuildingCount: "1-2",
  multipleVisitIsAfter21: false,
  h24Support: false,
  h24SupportType: "ika",
  specialManagement: false,
  specialManagementType: "type1",
  infoProvision: false,
  infoProvisionType: "type1",
  terminalCare: false,
  terminalCareType: "type1",
  bukkaTaiou: false,
  medicalInfoLinkage: false,
};

/** デフォルト入力値（介護予防訪問看護） */
export const defaultPreventiveCareInput: PreventiveCareCalcInput = {
  providerType: "station",
  visitDuration: "60min",
  regionRate: "10.00",
  emergencyVisit: false,
  specialManagement: false,
  specialManagementType: "type1",
  terminalCare: false,
  initialAdd: false,
  initialAddType: "type2",
  multipleVisit: false,
  multipleVisitType: "nurse",
  earlyLate: false,
  midnight: false,
};

/** デフォルト自立支援医療上限管理 */
export const defaultSeishinCopayTracker: SeishinCopayTracker = {
  monthlyLimit: 5000,
  alreadyPaid: 0,
  noLimit: false,
};

// ============================================================
// 処遇改善加算・ベースアップ評価料（令和8年度改定）
// ============================================================

/**
 * 介護保険 訪問看護・介護予防訪問看護
 * 処遇改善加算（令和8年6月〜新設）
 * 加算率：1.8%（区分によらず一律）
 * 医療保険の訪問看護療養費は算定対象外
 */
export const CARE_SHOGU_KAIZEN_RATE = 0.018;

/**
 * 医療保険 訪問看護ベースアップ評価料（令和8年度改定・令和8年6月〜）
 * 評価料（Ⅰ）：月1回定額
 *   新規算定：1,050円/月
 *   継続的賃上げ実施：1,830円/月
 * 評価料（Ⅱ）：月1回定額（区分1〜18）
 *   新規算定：区分1=30円〜区分18=540円（30円刻み）
 *   継続的賃上げ実施：区分1=40円〜区分18=1,040円
 * ※令和9年6月〜：評価料（Ⅰ）は新規2,100円/継続2,880円、評価料（Ⅱ）は区分1〜36に拡大
 */

/** 評価料（Ⅰ）の金額 */
export const BASEUP_TYPE1_FEE = {
  new: 1050,        // 新規算定事業所
  continuing: 1830, // 継続的賃上げ実施事業所
} as const;

/** 評価料（Ⅱ）の区分1〜18の金額（新規算定） */
export const BASEUP_TYPE2_NEW_FEES: Record<number, number> = {
  1: 30, 2: 60, 3: 90, 4: 120, 5: 150,
  6: 180, 7: 210, 8: 240, 9: 270, 10: 300,
  11: 330, 12: 360, 13: 390, 14: 420, 15: 450,
  16: 480, 17: 510, 18: 540,
};

/** 評価料（Ⅱ）の区分1〜18の金額（継続的賃上げ実施） */
export const BASEUP_TYPE2_CONTINUING_FEES: Record<number, number> = {
  1: 40, 2: 80, 3: 120, 4: 160, 5: 200,
  6: 240, 7: 280, 8: 320, 9: 360, 10: 400,
  11: 440, 12: 480, 13: 520, 14: 560, 15: 600,
  16: 640, 17: 680, 18: 720,
  // 区分11〜18は継続的賃上げ実施の場合のみ算定可能（区分ソ=540円相当以上）
  // 実際の継続的賃上げ実施の区分11〜18は以下の通り
};

// 継続的賃上げ実施の場合の正確な金額（令和8年厚生労働省告示第74号より）
// 区分1〜10: 40円刻み（40〜400円）、区分11〜18: 80円刻み（480〜1,040円）
export const BASEUP_TYPE2_CONTINUING_FEES_CORRECT: Record<number, number> = {
  1: 40, 2: 80, 3: 120, 4: 160, 5: 200,
  6: 240, 7: 280, 8: 320, 9: 360, 10: 400,
  11: 480, 12: 560, 13: 640, 14: 720, 15: 800,
  16: 880, 17: 960, 18: 1040,
};

/** ベースアップ評価料の種別 */
export type MedicalBaseupKind = "none" | "type1" | "type2";
/** 継続的賃上げ実施かどうか */
export type BaseupContinuityType = "new" | "continuing";

/**
 * ベースアップ評価料の設定
 */
export interface MedicalBaseupConfig {
  kind: MedicalBaseupKind;         // 評価料の種別
  continuity: BaseupContinuityType; // 新規 or 継続的賃上げ実施
  type2Division: number;            // 評価料（Ⅱ）の区分番号（1〜18）
}

export const DEFAULT_BASEUP_CONFIG: MedicalBaseupConfig = {
  kind: "none",
  continuity: "new",
  type2Division: 1,
};

/**
 * ベースアップ評価料の月額を計算する
 * @param config ベースアップ評価料の設定
 * @returns 月額金額（円）
 */
export function calcBaseupFee(config: MedicalBaseupConfig): number {
  if (config.kind === "none") return 0;
  if (config.kind === "type1") {
    return config.continuity === "continuing"
      ? BASEUP_TYPE1_FEE.continuing
      : BASEUP_TYPE1_FEE.new;
  }
  // type2
  const div = Math.max(1, Math.min(18, config.type2Division));
  if (config.continuity === "continuing") {
    return BASEUP_TYPE2_CONTINUING_FEES_CORRECT[div] ?? BASEUP_TYPE2_NEW_FEES[div];
  }
  return BASEUP_TYPE2_NEW_FEES[div] ?? 30;
}

// 後方互換のために残す（旧コードが参照している場合）
export const MEDICAL_BASEUP_FEE = {
  type1: 1050,
  type2: 30,
} as const;
export type MedicalBaseupType = "none" | "type1" | "type2";

/**
 * 介護保険の処遇改善加算を計算する
 * @param totalUnits 処遇改善加算を除く総単位数
 * @param rate 地域単価
 * @returns 加算単位数と円換算
 */
export function calcShoguKaizenKasan(
  totalUnits: number,
  rate: number
): { units: number; yen: number } {
  const units = Math.round(totalUnits * CARE_SHOGU_KAIZEN_RATE);
  const yen = Math.floor(units * rate);
  return { units, yen };
}

// ============================================================
// 訪問看護物価対応料（令和8年6月〜新設）
// ============================================================

/**
 * 訪問看護物価対応料
 * 物価対応料1：区分番号02（訪問看護管理療養費）を算定している利用者が対象
 *   ※精神科訪問看護基本療養費（区分番号01-2）算定時も区分番号02を合わせて算定するため対象
 *   月初日：60円、2日目以降：20円
 * 物価対応料2：区分番号04（包括型訪問看護療養費）を算定している利用者が対象
 *   1日につき：20円
 * ※令和9年6月以降は2倍（月初日120円、2日目以降40円、物価対応料2は40円）
 */
export const BUKKA_TAIOU_RYO = {
  type1_first: 60,    // 物価対応料1・月初日
  type1_subsequent: 20, // 物価対応料1・2日目以降
  type2: 20,          // 物価対応料2（精神科）
} as const;

export type BukkaTaiouType = "none" | "type1" | "type2";

/**
 * 訪問看護物価対応料を計算する
 * @param type 物価対応料の種別（type1=区分番号02、type2=区分番号04・包括型）
 * @param isFirstVisitOfMonth 月初日の訪問かどうか
 * @returns 物価対応料の金額（円）
 */
export function calcBukkaTaiouRyo(
  type: BukkaTaiouType,
  isFirstVisitOfMonth: boolean
): number {
  if (type === "none") return 0;
  if (type === "type2") return BUKKA_TAIOU_RYO.type2;
  return isFirstVisitOfMonth ? BUKKA_TAIOU_RYO.type1_first : BUKKA_TAIOU_RYO.type1_subsequent;
}
