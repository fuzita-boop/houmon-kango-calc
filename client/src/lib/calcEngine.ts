/**
 * 訪問看護療養費 算定エンジン
 * 令和8年度（2026年度）診療報酬改定 準拠
 *
 * Design Philosophy: ダッシュボード・プロフェッショナル
 * - 全ての点数は「円」単位で管理（訪問看護療養費は点数ではなく円）
 * - 排他制御ロジックを明確に分離
 * - 計算結果は内訳付きで返却
 */

// ============================================================
// 型定義
// ============================================================

/** 算定方式 */
export type CalcMode = "traditional" | "comprehensive";

/** 職種区分 */
export type StaffType = "nurse" | "junkango" | "specialist" | "pt_ot_st";

/** 同一建物居住者の人数区分 */
export type BuildingResidentCount =
  | "1-2"   // 1人または2人
  | "3-9"   // 3人以上9人以下
  | "10-19" // 10人以上19人以下
  | "20-49" // 20人以上49人以下
  | "50+"   // 50人以上

/** 単一建物居住者の人数区分（管理療養費・包括型用） */
export type SingleBuildingResidentCount =
  | "under20"  // 20人未満
  | "20-49"    // 20人以上50人未満
  | "50+"      // 50人以上

/** 訪問時間区分（包括型用） */
export type VisitDuration =
  | "30-60"         // 30分以上60分未満
  | "60-90"         // 60分以上90分未満
  | "90+"           // 90分以上
  | "90+-special"   // 90分以上（特別な場合）

/** 時間帯区分 */
export type TimeZone =
  | "normal"      // 通常時間帯
  | "early_late"  // 早朝・夜間（6:00-8:00, 18:00-22:00）
  | "midnight"    // 深夜（22:00-6:00）

/** 複数名訪問の同行職種 */
export type CoVisitStaffType =
  | "nurse"       // 看護師等（准看護師を除く）
  | "junkango"    // 准看護師
  | "other"       // その他職員

/** 難病等複数回訪問の回数 */
export type MultipleVisitCount = "twice" | "three_plus";

/** 月の訪問日数区分（管理療養費の2日目以降用） */
export type MonthlyVisitDays =
  | "1-15"   // 月15日以下
  | "16-24"  // 月16日以上24日以下
  | "25+"    // 月25日以上

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
  | "kinoka1"   // 機能強化型1
  | "kinoka2"   // 機能強化型2
  | "kinoka3"   // 機能強化型3
  | "kinoka4"   // 機能強化型4（令和8年度新設）
  | "standard"; // 通常

/** ターミナルケア療養費の区分 */
export type TerminalCareType = "type1" | "type2";

/** 計算条件の入力 */
export interface CalcInput {
  // 算定方式
  mode: CalcMode;

  // ===== 従来型共通 =====
  /** 職種 */
  staffType: StaffType;
  /** 週の訪問日数（基本療養費Ⅰ用） */
  weeklyVisitDay: WeeklyVisitDay;
  /** 同一建物居住者の有無 */
  isSameBuilding: boolean;
  /** 同一建物居住者の人数区分 */
  buildingResidentCount: BuildingResidentCount;
  /** 月の訪問日数区分（基本療養費Ⅱ用） */
  monthlyVisitDayForBasic: MonthlyVisitDayForBasic;

  // ===== 訪問看護管理療養費 =====
  /** 月の初日の訪問かどうか */
  isFirstVisitOfMonth: boolean;
  /** 管理療養費の種別（月初日のみ） */
  managementFeeType: ManagementFeeType;
  /** 単一建物居住者の人数区分 */
  singleBuildingResidentCount: SingleBuildingResidentCount;
  /** 月の訪問日数区分（管理療養費2日目以降用） */
  monthlyVisitDays: MonthlyVisitDays;

  // ===== 包括型 =====
  /** 訪問時間区分（包括型） */
  visitDuration: VisitDuration;
  /** 包括型の単一建物居住者区分 */
  comprehensiveBuildingCount: SingleBuildingResidentCount;

  // ===== 加算 =====
  /** 難病等複数回訪問加算を算定するか */
  multipleVisit: boolean;
  /** 難病等複数回訪問の回数 */
  multipleVisitCount: MultipleVisitCount;
  /** 月の訪問日数（難病等複数回訪問加算の3回以上用） */
  multipleVisitMonthDay: "1-20" | "21+";

  /** 24時間対応体制加算を算定するか */
  h24Support: boolean;
  /** 24時間対応体制加算の種別（イ：負担軽減取組あり / ロ：通常） */
  h24SupportType: "ika" | "ro";

  /** 特別管理加算を算定するか */
  specialManagement: boolean;
  /** 特別管理加算の区分 */
  specialManagementType: SpecialManagementType;

  /** 訪問看護情報提供療養費を算定するか */
  infoProvision: boolean;
  /** 訪問看護情報提供療養費の区分 */
  infoProvisionType: InfoProvisionType;

  /** ターミナルケア療養費を算定するか */
  terminalCare: boolean;
  /** ターミナルケア療養費の区分 */
  terminalCareType: TerminalCareType;

  /** 複数名訪問加算を算定するか */
  coVisit: boolean;
  /** 複数名訪問の同行職種 */
  coVisitStaffType: CoVisitStaffType;

  /** 早朝・夜間加算 / 深夜加算 */
  timeZone: TimeZone;
  /** 月の訪問日数（早朝・夜間/深夜加算の人数区分用） */
  timeZoneMonthDay: "1-15" | "16+";
}

/** 計算結果の内訳 */
export interface CalcLineItem {
  label: string;
  amount: number;
  note?: string;
  disabled?: boolean; // 算定不可（グレーアウト）
}

/** 計算結果 */
export interface CalcResult {
  total: number;
  items: CalcLineItem[];
  warnings: string[];
}

// ============================================================
// 点数テーブル（令和8年度改定後）
// ============================================================

/** 訪問看護基本療養費Ⅰ（同一建物居住者以外） */
const BASIC_FEE_I: Record<StaffType, { "1-3": number; "4+": number }> = {
  nurse:      { "1-3": 5550, "4+": 6550 },
  junkango:   { "1-3": 5050, "4+": 6050 },
  specialist: { "1-3": 12850, "4+": 12850 }, // 専門看護師は週の日数区分なし
  pt_ot_st:   { "1-3": 5550, "4+": 5550 },   // PT/OT/STは週の日数区分なし
};

/** 訪問看護基本療養費Ⅱ（同一建物居住者） */
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

/** 訪問看護管理療養費（月の初日）- 機能強化型別 */
const MANAGEMENT_FEE_FIRST: Record<ManagementFeeType, number> = {
  kinoka1:  13760,
  kinoka2:  10460,
  kinoka3:   9030,
  kinoka4:   9030, // 令和8年度新設
  standard:  7710,
};

/** 訪問看護管理療養費（月の2日目以降） */
const MANAGEMENT_FEE_SUBSEQUENT: Record<SingleBuildingResidentCount, Record<MonthlyVisitDays, number>> = {
  under20: { "1-15": 3010, "16-24": 3010, "25+": 3010 },
  "20-49": { "1-15": 2510, "16-24": 2310, "25+": 2210 },
  "50+":   { "1-15": 2410, "16-24": 2210, "25+": 2010 },
};

/** 包括型訪問看護療養費（04）- 令和8年度新設 */
const COMPREHENSIVE_FEE: Record<SingleBuildingResidentCount, Record<VisitDuration, number>> = {
  under20: { "30-60": 7010, "60-90": 11010, "90+": 14010, "90+-special": 15510 },
  "20-49": { "30-60": 6310, "60-90":  9910, "90+": 13730, "90+-special": 15200 },
  "50+":   { "30-60": 5960, "60-90":  9360, "90+": 13450, "90+-special": 14890 },
};

/** 24時間対応体制加算（月1回）*/
const H24_SUPPORT_FEE: Record<"ika" | "ro", number> = {
  ika: 6800, // イ：負担軽減取組あり
  ro:  6520, // ロ：通常
};

/** 特別管理加算（月1回）*/
const SPECIAL_MANAGEMENT_FEE: Record<SpecialManagementType, number> = {
  type1: 5000, // 特別な管理が必要な者（重症度高い）
  type2: 2500, // 特別な管理が必要な者（通常）
};

/** 訪問看護情報提供療養費（月1回）*/
const INFO_PROVISION_FEE = 1500;

/** ターミナルケア療養費 */
const TERMINAL_CARE_FEE: Record<TerminalCareType, number> = {
  type1: 25000, // 在宅死亡
  type2: 10000, // 特養等
};

/** 難病等複数回訪問加算 */
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

/** 複数名訪問加算 */
const CO_VISIT_FEE: Record<CoVisitStaffType, Record<BuildingResidentCount, number>> = {
  nurse: {
    "1-2":  4500,
    "3-9":  4000,
    "10-19": 3400,
    "20-49": 3000,
    "50+":  2700,
  },
  junkango: {
    "1-2":  3800,
    "3-9":  3400,
    "10-19": 2800,
    "20-49": 2500,
    "50+":  2200,
  },
  other: {
    "1-2":  3000,
    "3-9":  2700,
    "10-19": 2100,
    "20-49": 1900,
    "50+":  1600,
  },
};

/** 早朝・夜間加算 */
const EARLY_LATE_FEE: Record<BuildingResidentCount, number | Record<"1-15" | "16+", number>> = {
  "1-2":  2100,
  "3-9":  { "1-15": 2100, "16+": 1900 },
  "10-19":{ "1-15": 1800, "16+": 1300 },
  "20-49":{ "1-15": 1200, "16+":  950 },
  "50+":  { "1-15": 1000, "16+":  800 },
};

/** 深夜加算 */
const MIDNIGHT_FEE: Record<BuildingResidentCount, number | Record<"1-15" | "16+", number>> = {
  "1-2":  4200,
  "3-9":  { "1-15": 4200, "16+": 4000 },
  "10-19":{ "1-15": 3900, "16+": 2300 },
  "20-49":{ "1-15": 2100, "16+": 1500 },
  "50+":  { "1-15": 1800, "16+": 1300 },
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

/** 特定の条件下でグレーアウトすべきフィールドを返す */
export function getDisabledFields(input: CalcInput): Set<keyof CalcInput> {
  const disabled = new Set<keyof CalcInput>();

  if (input.mode === "comprehensive") {
    // 包括型では以下の加算は算定不可
    disabled.add("multipleVisit");
    disabled.add("multipleVisitCount");
    disabled.add("multipleVisitMonthDay");
    disabled.add("coVisit");
    disabled.add("coVisitStaffType");
    disabled.add("timeZone");
    disabled.add("timeZoneMonthDay");
    // 包括型では基本療養費・管理療養費の設定は不要
    disabled.add("staffType");
    disabled.add("weeklyVisitDay");
    disabled.add("isSameBuilding");
    disabled.add("buildingResidentCount");
    disabled.add("monthlyVisitDayForBasic");
    disabled.add("isFirstVisitOfMonth");
    disabled.add("managementFeeType");
    disabled.add("singleBuildingResidentCount");
    disabled.add("monthlyVisitDays");
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
// メイン計算関数
// ============================================================

export function calculate(input: CalcInput): CalcResult {
  const items: CalcLineItem[] = [];
  const warnings: string[] = [];

  if (input.mode === "traditional") {
    // ===== 従来型（出来高）算定 =====

    // 1. 訪問看護基本療養費
    let basicFee = 0;
    let basicFeeLabel = "";

    if (!input.isSameBuilding) {
      // 基本療養費Ⅰ（同一建物居住者以外）
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
      // 基本療養費Ⅱ（同一建物居住者）
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

    items.push({ label: basicFeeLabel, amount: basicFee });

    // 2. 訪問看護管理療養費
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

    items.push({ label: managementFeeLabel, amount: managementFee });

    // 3. 難病等複数回訪問加算
    if (input.multipleVisit) {
      const effectiveBuildingCount = input.isSameBuilding ? input.buildingResidentCount : "1-2";
      const fee = getMultipleVisitFee(
        input.multipleVisitCount,
        effectiveBuildingCount,
        input.multipleVisitMonthDay
      );
      const countLabel = input.multipleVisitCount === "twice" ? "1日2回" : "1日3回以上";
      items.push({
        label: `難病等複数回訪問加算（${countLabel}）`,
        amount: fee,
      });
    }

    // 4. 複数名訪問加算
    if (input.coVisit) {
      const effectiveBuildingCount = input.isSameBuilding ? input.buildingResidentCount : "1-2";
      const fee = CO_VISIT_FEE[input.coVisitStaffType][effectiveBuildingCount];
      const staffLabel: Record<CoVisitStaffType, string> = {
        nurse:    "看護師等",
        junkango: "准看護師",
        other:    "その他職員",
      };
      items.push({
        label: `複数名訪問加算（${staffLabel[input.coVisitStaffType]}との同行）`,
        amount: fee,
      });
    }

    // 5. 早朝・夜間加算 / 深夜加算
    if (input.timeZone === "early_late") {
      const effectiveBuildingCount = input.isSameBuilding ? input.buildingResidentCount : "1-2";
      const fee = getEarlyLateFee(effectiveBuildingCount, input.timeZoneMonthDay);
      items.push({ label: "夜間・早朝訪問看護加算", amount: fee });
    } else if (input.timeZone === "midnight") {
      const effectiveBuildingCount = input.isSameBuilding ? input.buildingResidentCount : "1-2";
      const fee = getMidnightFee(effectiveBuildingCount, input.timeZoneMonthDay);
      items.push({ label: "深夜訪問看護加算", amount: fee });
    }

    // 6. 24時間対応体制加算（従来型のみ・月1回）
    if (input.h24Support) {
      const fee = H24_SUPPORT_FEE[input.h24SupportType];
      const typeLabel = input.h24SupportType === "ika"
        ? "イ（負担軽減取組あり）"
        : "ロ（通常）";
      items.push({
        label: `24時間対応体制加算${typeLabel}`,
        amount: fee,
        note: "月1回算定",
      });
    }

  } else {
    // ===== 包括型訪問看護療養費（04）=====

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
      note: "1日単位の包括評価",
    });

    // 包括型では算定不可の加算をグレーアウト表示
    if (input.multipleVisit) {
      items.push({
        label: "難病等複数回訪問加算",
        amount: 0,
        note: "包括型では算定不可（包括評価に含まれます）",
        disabled: true,
      });
      warnings.push("包括型では難病等複数回訪問加算は算定できません（包括評価に含まれます）。");
    }

    if (input.coVisit) {
      items.push({
        label: "複数名訪問加算",
        amount: 0,
        note: "包括型では算定不可",
        disabled: true,
      });
      warnings.push("包括型では複数名訪問加算は算定できません。");
    }

    if (input.timeZone !== "normal") {
      items.push({
        label: input.timeZone === "early_late" ? "夜間・早朝訪問看護加算" : "深夜訪問看護加算",
        amount: 0,
        note: "包括型では算定不可（包括評価に含まれます）",
        disabled: true,
      });
      warnings.push("包括型では夜間・早朝加算・深夜加算は算定できません（包括評価に含まれます）。");
    }

    if (input.h24Support) {
      items.push({
        label: "24時間対応体制加算",
        amount: 0,
        note: "包括型では算定不可（包括型の算定要件のため）",
        disabled: true,
      });
      warnings.push("包括型では24時間対応体制加算は算定できません（包括型の算定要件のため）。");
    }
  }

  // ===== 共通加算（従来型・包括型両方で算定可能） =====

  // 特別管理加算（月1回）
  if (input.specialManagement) {
    const fee = SPECIAL_MANAGEMENT_FEE[input.specialManagementType];
    const typeLabel = input.specialManagementType === "type1"
      ? "（1）重症度の高い者"
      : "（2）特別な管理が必要な者";
    items.push({
      label: `特別管理加算${typeLabel}`,
      amount: fee,
      note: "月1回算定",
    });
  }

  // 訪問看護情報提供療養費（月1回）
  if (input.infoProvision) {
    const typeLabel: Record<InfoProvisionType, string> = {
      type1: "1（市町村等への情報提供）",
      type2: "2（学校等への情報提供）",
      type3: "3（保険医療機関への情報提供）",
    };
    items.push({
      label: `訪問看護情報提供療養費${typeLabel[input.infoProvisionType]}`,
      amount: INFO_PROVISION_FEE,
      note: "月1回算定",
    });
  }

  // ターミナルケア療養費
  if (input.terminalCare) {
    const fee = TERMINAL_CARE_FEE[input.terminalCareType];
    const typeLabel = input.terminalCareType === "type1"
      ? "1（在宅死亡）"
      : "2（特養等での死亡）";
    items.push({
      label: `訪問看護ターミナルケア療養費${typeLabel}`,
      amount: fee,
      note: "死亡月に算定",
    });
  }

  const total = items.filter(i => !i.disabled).reduce((sum, item) => sum + item.amount, 0);

  return { total, items, warnings };
}

// ============================================================
// ユーティリティ
// ============================================================

/** 円を「X,XXX円」形式にフォーマット */
export function formatYen(amount: number): string {
  return amount.toLocaleString("ja-JP") + "円";
}

/** デフォルト入力値 */
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
};
