/**
 * 訪問看護療養費計算アプリ - メインページ
 * Design: ダッシュボード・プロフェッショナル
 * - 淡い青みがかったホワイト背景
 * - スカイブルーをプライマリカラー
 * - モバイルファースト、片手操作対応
 * - 令和8年度（2026年度）診療報酬改定 準拠
 */

import { useState, useMemo } from "react";
import {
  calculate,
  getDisabledFields,
  formatYen,
  defaultInput,
} from "@/lib/calcEngine";
import type {
  CalcInput,
  CalcMode,
  StaffType,
  BuildingResidentCount,
  SingleBuildingResidentCount,
  VisitDuration,
  WeeklyVisitDay,
  MonthlyVisitDayForBasic,
  MonthlyVisitDays,
  MultipleVisitCount,
  CoVisitStaffType,
  TimeZone,
  SpecialManagementType,
  InfoProvisionType,
  ManagementFeeType,
  TerminalCareType,
  CalcResult,
} from "@/lib/calcEngine";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  InfoIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  XCircleIcon,
  RotateCcwIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// ラジオグループコンポーネント
// ============================================================
interface RadioGroupProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; sublabel?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  tooltip?: string;
}

function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  tooltip,
}: RadioGroupProps<T>) {
  return (
    <div className={cn("space-y-1.5", disabled && "opacity-40 pointer-events-none")}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon className="w-3.5 h-3.5 text-slate-400 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium border transition-all duration-150 text-left",
              value === opt.value
                ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-sky-400 hover:text-sky-600"
            )}
          >
            <span>{opt.label}</span>
            {opt.sublabel && (
              <span className={cn("block text-xs mt-0.5", value === opt.value ? "text-sky-100" : "text-slate-400")}>
                {opt.sublabel}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// チェックボックス行コンポーネント
// ============================================================
interface CheckRowProps {
  id: string;
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
  children?: React.ReactNode;
}

function CheckRow({
  id,
  label,
  sublabel,
  checked,
  onChange,
  disabled,
  disabledReason,
  children,
}: CheckRowProps) {
  return (
    <div className={cn("space-y-2", disabled && "opacity-40")}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4 mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer disabled:cursor-not-allowed shrink-0"
        />
        <label
          htmlFor={id}
          className={cn(
            "text-sm font-medium text-slate-700 select-none leading-snug",
            disabled ? "cursor-not-allowed" : "cursor-pointer"
          )}
        >
          {label}
          {sublabel && <span className="block text-xs text-slate-400 font-normal mt-0.5">{sublabel}</span>}
        </label>
        {disabled && disabledReason && (
          <Tooltip>
            <TooltipTrigger asChild>
              <XCircleIcon className="w-4 h-4 text-slate-400 cursor-help shrink-0 mt-0.5" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px] text-xs">{disabledReason}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {checked && !disabled && children && (
        <div className="ml-7 pl-3 border-l-2 border-sky-200 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================
// セクションカードコンポーネント
// ============================================================
interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

function SectionCard({
  title,
  icon,
  children,
  defaultOpen = true,
  badge,
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader
        className="py-3 px-4 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <span className="text-sky-600">{icon}</span>}
            <CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
            {badge && (
              <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50">
                {badge}
              </Badge>
            )}
          </div>
          {open ? (
            <ChevronUpIcon className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="px-4 pb-4 space-y-4">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function Home() {
  const [input, setInput] = useState<CalcInput>(defaultInput);

  const update = <K extends keyof CalcInput>(key: K, value: CalcInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => setInput(defaultInput);

  const disabledFields = useMemo(() => getDisabledFields(input), [input]);
  const result = useMemo(() => calculate(input), [input]);

  const isComprehensive = input.mode === "comprehensive";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-tight">
              訪問看護療養費 計算アプリ
            </h1>
            <p className="text-xs text-slate-500">令和8年度（2026年度）診療報酬改定 準拠</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-sky-300 text-sky-700 bg-sky-50">
              医療保険
            </Badge>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-md px-2 py-1.5 bg-white hover:bg-slate-50 transition-colors"
            >
              <RotateCcwIcon className="w-3 h-3" />
              リセット
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-52">

        {/* ===== 算定方式の切り替え ===== */}
        <Card className="border-2 border-sky-200 bg-gradient-to-r from-sky-50 to-white shadow-sm">
          <CardContent className="px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 mb-0.5">算定方式</p>
                <p className="text-xs text-slate-500 leading-snug">
                  {isComprehensive
                    ? "包括型：1日単位の包括評価（令和8年度新設）"
                    : "従来型：出来高算定（基本療養費＋管理療養費＋各加算）"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "text-sm font-medium",
                    !isComprehensive ? "text-sky-700" : "text-slate-400"
                  )}
                >
                  従来型
                </span>
                <Switch
                  checked={isComprehensive}
                  onCheckedChange={(v) =>
                    update("mode", v ? "comprehensive" : "traditional")
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
                <span
                  className={cn(
                    "text-sm font-medium",
                    isComprehensive ? "text-emerald-600" : "text-slate-400"
                  )}
                >
                  包括型
                </span>
              </div>
            </div>
            {isComprehensive && (
              <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-md">
                <p className="text-xs text-emerald-700 font-medium leading-snug">
                  ⚠ 包括型算定日は、難病等複数回訪問加算・複数名訪問加算・早朝夜間加算・深夜加算・24時間対応体制加算は算定できません。
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ===== 従来型：訪問看護基本療養費 ===== */}
        {!isComprehensive && (
          <SectionCard title="訪問看護基本療養費">
            <RadioGroup<StaffType>
              label="訪問職種"
              value={input.staffType}
              onChange={(v) => update("staffType", v)}
              options={[
                { value: "nurse", label: "看護師等", sublabel: "保健師・助産師・看護師" },
                { value: "junkango", label: "准看護師" },
                {
                  value: "specialist",
                  label: "専門看護師",
                  sublabel: "緩和ケア・褥瘡ケア等",
                },
                { value: "pt_ot_st", label: "PT・OT・ST" },
              ]}
              tooltip="保健師・助産師・看護師は「看護師等」を選択。緩和ケア・褥瘡ケア・人工肛門ケア等の専門研修修了看護師は「専門看護師」を選択してください。"
            />

            {input.staffType !== "specialist" && (
              <RadioGroup<WeeklyVisitDay>
                label="週の訪問日数"
                value={input.weeklyVisitDay}
                onChange={(v) => update("weeklyVisitDay", v)}
                options={[
                  { value: "1-3", label: "週3日目まで" },
                  { value: "4+", label: "週4日目以降" },
                ]}
                tooltip="同一利用者への同一週の訪問回数です。"
              />
            )}

            {/* 同一建物居住者スイッチ */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="same-building"
                  checked={input.isSameBuilding}
                  onCheckedChange={(v) => update("isSameBuilding", v)}
                />
                <Label
                  htmlFor="same-building"
                  className="text-sm font-medium text-slate-700 cursor-pointer"
                >
                  同一建物居住者への訪問（基本療養費Ⅱ）
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs">
                    同一の建物に居住する他の利用者に対して、同一日に訪問看護を行う場合に選択してください。
                  </TooltipContent>
                </Tooltip>
              </div>

              {input.isSameBuilding && (
                <div className="ml-7 pl-3 border-l-2 border-sky-200 space-y-3">
                  <RadioGroup<BuildingResidentCount>
                    label="同一建物内の同一日訪問人数"
                    value={input.buildingResidentCount}
                    onChange={(v) => update("buildingResidentCount", v)}
                    options={[
                      { value: "1-2", label: "2人" },
                      { value: "3-9", label: "3〜9人" },
                      { value: "10-19", label: "10〜19人" },
                      { value: "20-49", label: "20〜49人" },
                      { value: "50+", label: "50人以上" },
                    ]}
                  />
                  {["10-19", "20-49", "50+"].includes(
                    input.buildingResidentCount
                  ) && (
                    <RadioGroup<MonthlyVisitDayForBasic>
                      label="月の訪問日数"
                      value={input.monthlyVisitDayForBasic}
                      onChange={(v) => update("monthlyVisitDayForBasic", v)}
                      options={[
                        { value: "1-20", label: "月20日目まで" },
                        { value: "21+", label: "月21日目以降" },
                      ]}
                    />
                  )}
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* ===== 包括型：基本情報 ===== */}
        {isComprehensive && (
          <SectionCard title="包括型訪問看護療養費" badge="令和8年度新設">
            <RadioGroup<SingleBuildingResidentCount>
              label="単一建物居住者の人数"
              value={input.comprehensiveBuildingCount}
              onChange={(v) => update("comprehensiveBuildingCount", v)}
              options={[
                { value: "under20", label: "20人未満" },
                { value: "20-49", label: "20〜49人" },
                { value: "50+", label: "50人以上" },
              ]}
              tooltip="当該訪問看護ステーションが同一建物に居住する利用者に訪問看護を行う場合の人数区分です。"
            />
            <RadioGroup<VisitDuration>
              label="1日の訪問時間合計"
              value={input.visitDuration}
              onChange={(v) => update("visitDuration", v)}
              options={[
                {
                  value: "30-60",
                  label: "30〜60分未満",
                  sublabel: "1日1回・30分以上",
                },
                {
                  value: "60-90",
                  label: "60〜90分未満",
                  sublabel: "1日3回以上・60分以上",
                },
                {
                  value: "90+",
                  label: "90分以上",
                  sublabel: "1日3回以上・90分以上",
                },
                {
                  value: "90+-special",
                  label: "90分以上（特別）",
                  sublabel: "特別訪問看護指示書等",
                },
              ]}
              tooltip="1日に行った複数回の訪問看護の実施時間を合算した時間区分です。「特別」は特別訪問看護指示書が交付された場合等に該当します。"
            />
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
              <p className="text-xs text-slate-600 leading-relaxed">
                <span className="font-semibold">算定要件：</span>
                日中・夜間帯（18:00〜8:00）に少なくともそれぞれ1回ずつ訪問が必要。
                60分以上の場合は1日3回以上の訪問が必要。
                1日1回以上、看護職員（准看護師を除く）による訪問が必要。
              </p>
            </div>
          </SectionCard>
        )}

        {/* ===== 訪問看護管理療養費（従来型のみ） ===== */}
        {!isComprehensive && (
          <SectionCard title="訪問看護管理療養費">
            <div className="flex items-center gap-3">
              <Switch
                id="first-visit"
                checked={input.isFirstVisitOfMonth}
                onCheckedChange={(v) => update("isFirstVisitOfMonth", v)}
              />
              <Label
                htmlFor="first-visit"
                className="text-sm font-medium text-slate-700 cursor-pointer"
              >
                月の初日の訪問
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoIcon className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px] text-xs">
                  月の初日の訪問の場合は機能強化型の種別に応じた点数、2日目以降は単一建物居住者数と月の訪問日数に応じた点数となります。
                </TooltipContent>
              </Tooltip>
            </div>

            {input.isFirstVisitOfMonth && (
              <RadioGroup<ManagementFeeType>
                label="管理療養費の種別"
                value={input.managementFeeType}
                onChange={(v) => update("managementFeeType", v)}
                options={[
                  {
                    value: "standard",
                    label: "通常",
                    sublabel: "7,710円",
                  },
                  {
                    value: "kinoka1",
                    label: "機能強化型1",
                    sublabel: "13,760円",
                  },
                  {
                    value: "kinoka2",
                    label: "機能強化型2",
                    sublabel: "10,460円",
                  },
                  {
                    value: "kinoka3",
                    label: "機能強化型3",
                    sublabel: "9,030円",
                  },
                  {
                    value: "kinoka4",
                    label: "機能強化型4",
                    sublabel: "9,030円（新設）",
                  },
                ]}
                tooltip="機能強化型は別途届出が必要です。令和8年度より機能強化型4が新設されました。"
              />
            )}

            {!input.isFirstVisitOfMonth && (
              <div className="space-y-3">
                <RadioGroup<SingleBuildingResidentCount>
                  label="単一建物居住者の人数"
                  value={input.singleBuildingResidentCount}
                  onChange={(v) => update("singleBuildingResidentCount", v)}
                  options={[
                    { value: "under20", label: "20人未満", sublabel: "3,010円" },
                    { value: "20-49", label: "20〜49人" },
                    { value: "50+", label: "50人以上" },
                  ]}
                  tooltip="当該訪問看護ステーションが同一建物に居住する利用者に訪問看護を行う場合の人数区分です。"
                />
                {input.singleBuildingResidentCount !== "under20" && (
                  <RadioGroup<MonthlyVisitDays>
                    label="月の訪問日数"
                    value={input.monthlyVisitDays}
                    onChange={(v) => update("monthlyVisitDays", v)}
                    options={[
                      {
                        value: "1-15",
                        label: "月15日以下",
                        sublabel:
                          input.singleBuildingResidentCount === "20-49"
                            ? "2,510円"
                            : "2,410円",
                      },
                      {
                        value: "16-24",
                        label: "月16〜24日",
                        sublabel:
                          input.singleBuildingResidentCount === "20-49"
                            ? "2,310円"
                            : "2,210円",
                      },
                      {
                        value: "25+",
                        label: "月25日以上",
                        sublabel:
                          input.singleBuildingResidentCount === "20-49"
                            ? "2,210円"
                            : "2,010円",
                      },
                    ]}
                  />
                )}
              </div>
            )}
          </SectionCard>
        )}

        {/* ===== 各種加算 ===== */}
        <SectionCard title="各種加算">

          {/* 難病等複数回訪問加算 */}
          <CheckRow
            id="multiple-visit"
            label="難病等複数回訪問加算"
            sublabel="1日に2回以上訪問した場合"
            checked={input.multipleVisit}
            onChange={(v) => update("multipleVisit", v)}
            disabled={disabledFields.has("multipleVisit")}
            disabledReason="包括型訪問看護療養費算定日は算定できません。"
          >
            <RadioGroup<MultipleVisitCount>
              label="1日の訪問回数"
              value={input.multipleVisitCount}
              onChange={(v) => update("multipleVisitCount", v)}
              options={[
                { value: "twice", label: "1日2回" },
                { value: "three_plus", label: "1日3回以上" },
              ]}
            />
            {/* 3回以上かつ同一建物3人以上の場合は月の訪問日数が必要 */}
            {input.multipleVisitCount === "three_plus" &&
              input.isSameBuilding &&
              ["3-9", "10-19", "20-49", "50+"].includes(
                input.buildingResidentCount
              ) && (
                <RadioGroup<"1-20" | "21+">
                  label="月の訪問日数"
                  value={input.multipleVisitMonthDay}
                  onChange={(v) => update("multipleVisitMonthDay", v)}
                  options={[
                    { value: "1-20", label: "月20日目まで" },
                    { value: "21+", label: "月21日目以降" },
                  ]}
                />
              )}
          </CheckRow>

          <Separator className="my-1" />

          {/* 24時間対応体制加算 */}
          <CheckRow
            id="h24-support"
            label="24時間対応体制加算"
            sublabel="月1回算定"
            checked={input.h24Support}
            onChange={(v) => update("h24Support", v)}
            disabled={disabledFields.has("h24Support")}
            disabledReason="包括型訪問看護療養費算定日は算定できません。"
          >
            <RadioGroup<"ika" | "ro">
              label="区分"
              value={input.h24SupportType}
              onChange={(v) => update("h24SupportType", v)}
              options={[
                {
                  value: "ika",
                  label: "イ（負担軽減取組あり）",
                  sublabel: "6,800円",
                },
                {
                  value: "ro",
                  label: "ロ（通常）",
                  sublabel: "6,520円",
                },
              ]}
              tooltip="イ：看護業務の負担軽減の取組を行っている場合（別途届出が必要）"
            />
          </CheckRow>

          <Separator className="my-1" />

          {/* 特別管理加算 */}
          <CheckRow
            id="special-management"
            label="特別管理加算"
            sublabel="月1回算定"
            checked={input.specialManagement}
            onChange={(v) => update("specialManagement", v)}
          >
            <RadioGroup<SpecialManagementType>
              label="区分"
              value={input.specialManagementType}
              onChange={(v) => update("specialManagementType", v)}
              options={[
                {
                  value: "type1",
                  label: "（1）重症度の高い者",
                  sublabel: "5,000円（人工呼吸器等）",
                },
                {
                  value: "type2",
                  label: "（2）特別な管理が必要な者",
                  sublabel: "2,500円（カテーテル管理等）",
                },
              ]}
              tooltip="（1）：人工呼吸器・気管切開・ドレーン管理・在宅中心静脈栄養等の重症度の高い者　（2）：留置カテーテル・在宅酸素療法等の特別な管理が必要な者"
            />
          </CheckRow>

          <Separator className="my-1" />

          {/* 訪問看護情報提供療養費 */}
          <CheckRow
            id="info-provision"
            label="訪問看護情報提供療養費"
            sublabel="1,500円 / 月1回"
            checked={input.infoProvision}
            onChange={(v) => update("infoProvision", v)}
          >
            <RadioGroup<InfoProvisionType>
              label="区分"
              value={input.infoProvisionType}
              onChange={(v) => update("infoProvisionType", v)}
              options={[
                { value: "type1", label: "1（市町村等）" },
                { value: "type2", label: "2（学校等）" },
                { value: "type3", label: "3（保険医療機関）" },
              ]}
            />
          </CheckRow>

          <Separator className="my-1" />

          {/* ターミナルケア療養費 */}
          <CheckRow
            id="terminal-care"
            label="訪問看護ターミナルケア療養費"
            sublabel="死亡月に算定"
            checked={input.terminalCare}
            onChange={(v) => update("terminalCare", v)}
          >
            <RadioGroup<TerminalCareType>
              label="区分"
              value={input.terminalCareType}
              onChange={(v) => update("terminalCareType", v)}
              options={[
                {
                  value: "type1",
                  label: "1（在宅・特養等）",
                  sublabel: "25,000円",
                },
                {
                  value: "type2",
                  label: "2（特養等・看取り介護加算算定）",
                  sublabel: "10,000円",
                },
              ]}
              tooltip="1：在宅で死亡した利用者または特別養護老人ホーム等で死亡した利用者（看取り介護加算等を算定していない場合）　2：特別養護老人ホーム等で死亡した利用者（看取り介護加算等を算定している場合）"
            />
          </CheckRow>

          <Separator className="my-1" />

          {/* 複数名訪問加算 */}
          <CheckRow
            id="co-visit"
            label="複数名訪問加算"
            sublabel="複数の看護師等が同時訪問"
            checked={input.coVisit}
            onChange={(v) => update("coVisit", v)}
            disabled={disabledFields.has("coVisit")}
            disabledReason="包括型訪問看護療養費算定日は算定できません。"
          >
            <RadioGroup<CoVisitStaffType>
              label="同行職種"
              value={input.coVisitStaffType}
              onChange={(v) => update("coVisitStaffType", v)}
              options={[
                { value: "nurse", label: "看護師等", sublabel: "准看護師を除く" },
                { value: "junkango", label: "准看護師" },
                { value: "other", label: "その他職員", sublabel: "看護補助者等" },
              ]}
            />
          </CheckRow>

          <Separator className="my-1" />

          {/* 早朝・夜間加算 / 深夜加算 */}
          <div className={cn("space-y-2", isComprehensive && "opacity-40")}>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-slate-700">時間帯加算</span>
              {isComprehensive ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <XCircleIcon className="w-4 h-4 text-slate-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px] text-xs">
                    包括型訪問看護療養費算定日は算定できません。
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="w-3.5 h-3.5 text-slate-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs">
                    早朝：6:00〜8:00 / 夜間：18:00〜22:00 / 深夜：22:00〜翌6:00
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(["normal", "early_late", "midnight"] as TimeZone[]).map((tz) => {
                const label =
                  tz === "normal"
                    ? "通常時間帯"
                    : tz === "early_late"
                    ? "早朝・夜間"
                    : "深夜";
                const sublabel =
                  tz === "normal"
                    ? ""
                    : tz === "early_late"
                    ? "6:00-8:00 / 18:00-22:00"
                    : "22:00-翌6:00";
                return (
                  <button
                    key={tz}
                    type="button"
                    onClick={() => !isComprehensive && update("timeZone", tz)}
                    disabled={isComprehensive}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium border transition-all duration-150 text-left",
                      input.timeZone === tz
                        ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-sky-400 hover:text-sky-600",
                      isComprehensive && "cursor-not-allowed"
                    )}
                  >
                    <span>{label}</span>
                    {sublabel && (
                      <span
                        className={cn(
                          "block text-xs mt-0.5",
                          input.timeZone === tz ? "text-sky-100" : "text-slate-400"
                        )}
                      >
                        {sublabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {input.timeZone !== "normal" && !isComprehensive && (
              <div className="pl-3 border-l-2 border-sky-200">
                <RadioGroup<"1-15" | "16+">
                  label="月の訪問日数"
                  value={input.timeZoneMonthDay}
                  onChange={(v) => update("timeZoneMonthDay", v)}
                  options={[
                    { value: "1-15", label: "月15日以下" },
                    { value: "16+", label: "月16日以上" },
                  ]}
                  tooltip="同一建物居住者が3人以上の場合に月の訪問日数で点数が変動します。"
                />
              </div>
            )}
          </div>
        </SectionCard>

        {/* 注釈 */}
        <div className="px-1">
          <p className="text-xs text-slate-400 leading-relaxed">
            ※ 本アプリは令和8年度診療報酬改定の算定ルールに基づいて計算を行います。
            実際の算定にあたっては、各種届出要件・算定要件を必ずご確認ください。
          </p>
        </div>
      </div>

      {/* ===== 計算結果（固定フッター） ===== */}
      <div className="fixed bottom-0 left-0 right-0 z-20">
        <ResultPanel result={result} />
      </div>
    </div>
  );
}

// ============================================================
// 計算結果パネル
// ============================================================
function ResultPanel({ result }: { result: CalcResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      {/* 展開時の内訳 */}
      {expanded && (
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-2 max-h-[55vh] overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
            <CheckCircle2Icon className="w-4 h-4 text-sky-600" />
            算定内訳
          </h3>
          <div className="space-y-0">
            {result.items.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start justify-between gap-2 py-2 border-b border-slate-100 last:border-0",
                  item.disabled && "opacity-40"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {item.disabled && (
                      <XCircleIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <p className="text-sm text-slate-700 leading-snug">{item.label}</p>
                  </div>
                  {item.note && (
                    <p className="text-xs text-slate-400 mt-0.5 ml-0">{item.note}</p>
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold shrink-0 tabular-nums",
                    item.disabled ? "text-slate-400 line-through" : "text-slate-800"
                  )}
                >
                  {item.disabled ? "算定不可" : formatYen(item.amount)}
                </span>
              </div>
            ))}
          </div>

          {result.warnings.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md"
                >
                  <AlertCircleIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">{w}</p>
                </div>
              ))}
            </div>
          )}

          <Separator className="mt-3 mb-2" />
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm font-semibold text-slate-700">合計</span>
            <span className="text-xl font-bold text-sky-700 tabular-nums">
              {formatYen(result.total)}
            </span>
          </div>
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs text-slate-400">参考点数（1点＝10円換算）</span>
            <span className="text-xs text-slate-500 tabular-nums">
              {Math.floor(result.total / 10).toLocaleString("ja-JP")} 点
            </span>
          </div>
        </div>
      )}

      {/* 合計表示バー */}
      <div
        className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-sky-600 font-medium"
          >
            {expanded ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronUpIcon className="w-4 h-4" />
            )}
            {expanded
              ? "内訳を閉じる"
              : `内訳を見る（${result.items.filter((i) => !i.disabled).length}項目）`}
          </button>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 leading-none mb-0.5">合計金額</p>
          <p className="text-2xl font-bold text-sky-700 tabular-nums leading-none">
            {formatYen(result.total)}
          </p>
        </div>
      </div>
    </div>
  );
}
