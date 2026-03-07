/**
 * 訪問看護療養費計算アプリ - メインページ
 * Design: ウォームアンバー・プロフェッショナル
 * - テラコッタ/アンバーオレンジをプライマリカラー
 * - カレンダーで訪問日を選択して月次集計
 * - 医療保険・介護保険・介護予防・精神科訪問看護の4種対応
 * - 患者負担額計算・自立支援医療月額上限管理・印刷機能付き
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useVisitStore } from "@/hooks/useVisitStore";
import type { InsuranceMode } from "@/hooks/useVisitStore";
import {
  calculate,
  calculateCare,
  calculatePsychiatric,
  calculatePreventiveCare,
  calcCopay,
  calcSeishinCopayWithTracker,
  formatYen,
  CARE_REGION_OPTIONS,
} from "@/lib/calcEngine";
import MedicalForm from "@/components/MedicalForm";
import CareForm from "@/components/CareForm";
import CopayForm from "@/components/CopayForm";
import PsychiatricForm, { SeishinCopayTrackerWidget } from "@/components/PsychiatricForm";
import PreventiveCareForm from "@/components/PreventiveCareForm";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PrinterIcon,
  XIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  UserIcon,
  BuildingIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  CopyIcon,
  SparklesIcon,
  InfoIcon,
  FileTextIcon,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// ============================================================
// 保険種別のカラー・ラベル定義
// ============================================================

const MODE_CONFIG: Record<InsuranceMode, { label: string; shortLabel: string; color: string; bgColor: string; borderColor: string; badgeBg: string; badgeText: string }> = {
  medical: {
    label: "医療保険",
    shortLabel: "医療",
    color: "bg-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
  },
  care: {
    label: "介護保険",
    shortLabel: "介護",
    color: "bg-teal-600",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-700",
  },
  preventive: {
    label: "介護予防",
    shortLabel: "予防",
    color: "bg-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
  },
  psychiatric: {
    label: "精神科",
    shortLabel: "精神",
    color: "bg-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-700",
  },
};

// ============================================================
// カレンダーコンポーネント
// ============================================================
interface CalendarProps {
  year: number;
  month: number;
  visitDates: Set<string>;
  selectedDate: string | null;
  firstVisitDate: string | null;
  onToggle: (date: string) => void;
  onSelect: (date: string) => void;
}

function Calendar({ year, month, visitDates, selectedDate, firstVisitDate, onToggle, onSelect }: CalendarProps) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 mb-1">
        {["日","月","火","水","木","金","土"].map((d, i) => (
          <div key={d} className={cn(
            "text-center text-xs font-medium py-1",
            i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-stone-500"
          )}>{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.map((day, di) => {
              if (!day) return <div key={di} />;
              const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const isVisit = visitDates.has(dateStr);
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === today;
              const isFirst = firstVisitDate === dateStr;
              const dayOfWeek = (firstDay + (day - 1)) % 7;
              return (
                <button
                  key={di}
                  type="button"
                  onClick={() => {
                    if (isVisit) {
                      onSelect(dateStr);
                    } else {
                      onToggle(dateStr);
                      onSelect(dateStr);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (isVisit) onToggle(dateStr);
                  }}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm font-medium transition-all duration-150 select-none",
                    isSelected && isVisit
                      ? "bg-amber-600 text-white shadow-md ring-2 ring-amber-400 ring-offset-1"
                      : isFirst
                      ? "bg-amber-500 text-white border-2 border-amber-600 shadow-sm hover:bg-amber-600"
                      : isVisit
                      ? "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200"
                      : isToday
                      ? "border-2 border-amber-400 text-amber-700 hover:bg-amber-50"
                      : "hover:bg-stone-100 text-stone-700",
                    dayOfWeek === 0 && !isVisit && !isSelected && "text-red-500",
                    dayOfWeek === 6 && !isVisit && !isSelected && "text-blue-500",
                  )}
                >
                  <span>{day}</span>
                  {isFirst && (
                    <span className="absolute top-0.5 right-0.5 text-[8px] font-bold bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">初</span>
                  )}
                  {isVisit && !isFirst && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-amber-500" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-stone-400 text-center">
        タップで訪問日を追加 / 長押しで削除
      </div>
    </div>
  );
}

// ============================================================
// 訪問日詳細パネル
// ============================================================
interface VisitDetailPanelProps {
  dateStr: string;
  store: ReturnType<typeof useVisitStore>;
  onClose: () => void;
}

function VisitDetailPanel({ dateStr, store, onClose }: VisitDetailPanelProps) {
  const visitDay = store.getVisitDay(dateStr);
  const [activeTab, setActiveTab] = useState<"calc" | "copay">("calc");
  const [showAutoCopyBanner, setShowAutoCopyBanner] = useState(visitDay?.wasAutoCopied ?? false);

  if (!visitDay) return null;

  const [y, m, d] = dateStr.split("-").map(Number);
  const dateLabel = `${y}年${m}月${d}日`;
  const weekdays = ["日","月","火","水","木","金","土"];
  const dow = weekdays[new Date(y, m - 1, d).getDay()];

  const mode = visitDay.insuranceMode;
  const modeConf = MODE_CONFIG[mode];

  // リアルタイム計算
  let total = 0;
  let totalYen = 0;
  let copayAmount = 0;
  let copayNote = "";
  let resultItems: { label: string; amount: number; unit?: string; note?: string; disabled?: boolean }[] = [];
  let warnings: string[] = [];
  let isUnitBased = false;

  if (mode === "medical") {
    const result = calculate(visitDay.medicalInput);
    total = result.total;
    totalYen = result.total;
    resultItems = result.items;
    warnings = result.warnings;
    const copay = calcCopay(result.total, visitDay.copayInput);
    copayAmount = copay.amount;
    copayNote = copay.note;
  } else if (mode === "care") {
    const result = calculateCare(visitDay.careInput);
    total = result.totalUnit ?? 0;
    totalYen = result.totalYen ?? 0;
    resultItems = result.items;
    warnings = result.warnings;
    isUnitBased = true;
    const copay = calcCopay(totalYen, { ...visitDay.copayInput, insuranceType: "care" });
    copayAmount = copay.amount;
    copayNote = copay.note;
  } else if (mode === "preventive") {
    const result = calculatePreventiveCare(visitDay.preventiveCareInput);
    total = result.totalUnit ?? 0;
    totalYen = result.totalYen ?? 0;
    resultItems = result.items;
    warnings = result.warnings;
    isUnitBased = true;
    const copay = calcCopay(totalYen, { ...visitDay.copayInput, insuranceType: "care" });
    copayAmount = copay.amount;
    copayNote = copay.note;
  } else if (mode === "psychiatric") {
    const result = calculatePsychiatric(visitDay.psychInput);
    total = result.total;
    totalYen = result.total;
    resultItems = result.items;
    warnings = result.warnings;
    const baseCopay = calcCopay(result.total, visitDay.copayInput);
    if (visitDay.copayInput.kohiType === "seishin") {
      const tracked = calcSeishinCopayWithTracker(baseCopay.amount, visitDay.seishinCopayTracker);
      copayAmount = tracked.actualPayment;
      copayNote = tracked.note;
    } else {
      copayAmount = baseCopay.amount;
      copayNote = baseCopay.note;
    }
  }

  const rateNum = parseFloat(
    mode === "care" ? visitDay.careInput.regionRate : visitDay.preventiveCareInput.regionRate
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ヘッダー */}
      <div className={cn("text-white px-4 py-3 flex items-center gap-3 shrink-0", modeConf.color)}>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors">
          <XIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="font-bold text-base">{dateLabel}（{dow}）</div>
          <div className="text-xs text-white/70">訪問算定条件の設定</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/70">合計</div>
          <div className="font-bold text-lg">{formatYen(totalYen)}</div>
        </div>
      </div>

      {/* 自動コピー通知バナー */}
      {showAutoCopyBanner && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-xs text-green-700 font-medium">
              前回の訪問条件を自動引き継ぎしました
              <span className="text-green-500 font-normal ml-1">（月1回加算は自動でOFF）</span>
            </span>
          </div>
          <button onClick={() => setShowAutoCopyBanner(false)} className="text-green-500 hover:text-green-700 p-1">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 保険種別切替 */}
      <div className="bg-stone-50 border-b border-stone-200 px-3 py-2 shrink-0">
        <div className="grid grid-cols-4 gap-1">
          {(["medical", "care", "preventive", "psychiatric"] as InsuranceMode[]).map((m) => {
            const conf = MODE_CONFIG[m];
            const isActive = visitDay.insuranceMode === m;
            return (
              <button
                key={m}
                onClick={() => store.updateVisitDay(dateStr, { insuranceMode: m })}
                className={cn(
                  "py-2 rounded-lg text-xs font-bold transition-all",
                  isActive ? `${conf.color} text-white shadow-sm` : "bg-white text-stone-600 border border-stone-200 hover:border-stone-400"
                )}
              >
                {conf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* タブ */}
      <div className="border-b border-stone-200 flex shrink-0">
        <button
          onClick={() => setActiveTab("calc")}
          className={cn(
            "flex-1 py-2.5 text-sm font-medium transition-colors",
            activeTab === "calc" ? "border-b-2 border-amber-600 text-amber-700" : "text-stone-500 hover:text-stone-700"
          )}
        >算定条件</button>
        <button
          onClick={() => setActiveTab("copay")}
          className={cn(
            "flex-1 py-2.5 text-sm font-medium transition-colors",
            activeTab === "copay" ? "border-b-2 border-amber-600 text-amber-700" : "text-stone-500 hover:text-stone-700"
          )}
        >患者負担</button>
        <button
          onClick={() => {
            store.copyPrevConditions(dateStr);
            setShowAutoCopyBanner(true);
          }}
          title="前回の訪問条件をコピー"
          className="px-3 py-2.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-colors border-l border-stone-200"
        >
          <CopyIcon className="w-4 h-4" />
        </button>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "calc" ? (
          <div className="p-4">
            {visitDay.insuranceMode === "medical" && (
              <MedicalForm
                input={visitDay.medicalInput}
                onChange={(updates) => store.updateVisitDay(dateStr, {
                  medicalInput: { ...visitDay.medicalInput, ...updates }
                })}
              />
            )}
            {visitDay.insuranceMode === "care" && (
              <CareForm
                input={visitDay.careInput}
                onChange={(updates) => store.updateVisitDay(dateStr, {
                  careInput: { ...visitDay.careInput, ...updates }
                })}
              />
            )}
            {visitDay.insuranceMode === "preventive" && (
              <PreventiveCareForm
                input={visitDay.preventiveCareInput}
                onChange={(updates) => store.updateVisitDay(dateStr, {
                  preventiveCareInput: { ...visitDay.preventiveCareInput, ...updates }
                })}
              />
            )}
            {visitDay.insuranceMode === "psychiatric" && (
              <PsychiatricForm
                input={visitDay.psychInput}
                onChange={(updates) => store.updateVisitDay(dateStr, {
                  psychInput: { ...visitDay.psychInput, ...updates }
                })}
              />
            )}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* 患者負担の全日同期バナー */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <InfoIcon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                ここで変更した患者負担設定は、<strong>当月の全訪問日に自動で反映</strong>されます。
              </p>
            </div>
            <CopayForm
              input={visitDay.copayInput}
              insuranceMode={visitDay.insuranceMode}
              onChange={(updates) => {
                const newCopay = { ...visitDay.copayInput, ...updates };
                store.updateCopayForAll(newCopay);
              }}
            />
            {/* 精神科：自立支援医療月額上限管理 */}
            {visitDay.insuranceMode === "psychiatric" && visitDay.copayInput.kohiType === "seishin" && (
              <SeishinCopayTrackerWidget
                tracker={visitDay.seishinCopayTracker}
                onChange={(updates) => store.updateVisitDay(dateStr, {
                  seishinCopayTracker: { ...visitDay.seishinCopayTracker, ...updates }
                })}
                baseAmount={Math.round(totalYen * 0.1)}
              />
            )}
          </div>
        )}
      </div>

      {/* 計算結果フッター */}
      <div className="border-t border-stone-200 bg-stone-50 shrink-0">
        <div className="px-4 py-3">
          {warnings.length > 0 && (
            <div className="mb-2 space-y-1">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded p-2 border border-amber-200">
                  <AlertCircleIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1 mb-3">
            {resultItems.map((item, i) => (
              <div key={i} className={cn(
                "flex items-center justify-between text-xs",
                item.disabled ? "opacity-40 line-through" : ""
              )}>
                <span className="text-stone-600 flex-1 pr-2">{item.label}</span>
                <span className={cn("font-medium shrink-0", item.disabled ? "text-stone-400" : "text-stone-800")}>
                  {isUnitBased
                    ? `${item.amount.toLocaleString()}単位`
                    : formatYen(item.amount)}
                </span>
              </div>
            ))}
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-stone-500">合計金額</div>
              {isUnitBased && (
                <div className="text-xs text-stone-400">{total.toLocaleString()}単位 × {rateNum}円</div>
              )}
              {mode === "medical" && (
                <div className="text-xs text-stone-400">{Math.round(totalYen / 10)}点</div>
              )}
            </div>
            <div className="text-xl font-bold text-amber-700">{formatYen(totalYen)}</div>
          </div>
          <div className="mt-2 flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
            <div>
              <div className="text-xs text-stone-500">患者自己負担（概算）</div>
              <div className="text-xs text-stone-400 leading-tight">{copayNote}</div>
            </div>
            <div className="text-lg font-bold text-amber-800">{formatYen(copayAmount)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 月次集計パネル
// ============================================================
interface MonthlySummaryPanelProps {
  store: ReturnType<typeof useVisitStore>;
  onSelectDate: (date: string) => void;
}

function MonthlySummaryPanel({ store, onSelectDate }: MonthlySummaryPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const { monthlyResults, totalAmount, totalCopay, year, month } = store;

  if (monthlyResults.length === 0) {
    return (
      <div className="text-center py-8 text-stone-400">
        <CalendarDaysIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <div className="text-sm">カレンダーで訪問日をタップして追加してください</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-amber-600 rounded-xl p-4 text-white">
        <div className="text-xs text-amber-100 mb-1">{year}年{month}月 月次合計</div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-bold">{formatYen(totalAmount)}</div>
            <div className="text-xs text-amber-100 mt-0.5">{monthlyResults.length}回訪問</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-amber-100">患者自己負担（概算）</div>
            <div className="text-lg font-bold">{formatYen(totalCopay)}</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 bg-stone-100 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-200 transition-colors"
      >
        <span>訪問日の内訳（{monthlyResults.length}件）</span>
        {expanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="space-y-2">
          {monthlyResults.map((r) => {
            const [y, m, d] = r.date.split("-").map(Number);
            const weekdays = ["日","月","火","水","木","金","土"];
            const dow = weekdays[new Date(y, m - 1, d).getDay()];
            const conf = MODE_CONFIG[r.insuranceMode];
            return (
              <button
                key={r.id}
                onClick={() => onSelectDate(r.date)}
                className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-stone-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-left"
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 text-white",
                  conf.color
                )}>
                  <span className="text-xs font-bold leading-none">{m}/{d}</span>
                  <span className="text-xs opacity-80">{dow}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", conf.badgeBg, conf.badgeText)}>
                      {conf.shortLabel}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5 truncate">
                    {r.insuranceMode === "medical" && (r.medicalInput.mode === "comprehensive" ? "包括型" : "従来型")}
                    {r.insuranceMode === "care" && `${r.careInput.providerType === "station" ? "ステーション" : "病院"}`}
                    {r.insuranceMode === "preventive" && `${r.preventiveCareInput.providerType === "station" ? "ステーション" : "病院"}・介護予防`}
                    {r.insuranceMode === "psychiatric" && "精神科訪問看護基本療養費"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-stone-800">{formatYen(r.totalYen)}</div>
                  <div className="text-xs text-stone-400">負担 {formatYen(r.copayAmount)}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 印刷プレビュー（月次明細）
// ============================================================
interface PrintPreviewProps {
  store: ReturnType<typeof useVisitStore>;
  onClose: () => void;
  onShowFeeTable: () => void;
}

function PrintPreview({ store, onClose, onShowFeeTable }: PrintPreviewProps) {
  const { year, month, monthlyResults, totalAmount, totalCopay, patientName, stationName } = store;
  const printDate = new Date().toLocaleDateString("ja-JP");
  const handlePrint = () => window.print();

  return (
    <div id="print-root" className="fixed inset-0 z-50 bg-stone-800/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col print:shadow-none print:rounded-none print:max-h-none print:w-full print:max-w-none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 shrink-0">
          <h2 className="font-bold text-stone-800">印刷プレビュー</h2>
          <div className="flex gap-2">
            <button
              onClick={onShowFeeTable}
              className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-200 transition-colors"
            >
              <FileTextIcon className="w-4 h-4" />
              料金表
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              <PrinterIcon className="w-4 h-4" />
              印刷する
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div id="print-content" className="bg-white border border-stone-200 rounded-lg p-6 space-y-4 text-sm">
            <div className="text-center border-b-2 border-stone-800 pb-3">
              <h1 className="text-lg font-bold text-stone-900">訪問看護 料金概算のお知らせ</h1>
              <p className="text-xs text-stone-500 mt-1">令和8年度（2026年度）診療報酬改定 準拠</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div><span className="text-stone-500">ご利用者様：</span><span className="font-bold ml-1">{patientName || "　　　　　　　　　"} 様</span></div>
              <div><span className="text-stone-500">算定月：</span><span className="font-bold ml-1">{year}年{month}月</span></div>
              <div><span className="text-stone-500">事業所名：</span><span className="font-bold ml-1">{stationName || "　　　　　　　　　"}</span></div>
              <div><span className="text-stone-500">発行日：</span><span className="font-bold ml-1">{printDate}</span></div>
            </div>

            <Separator />

            <div className="bg-stone-50 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-stone-800">訪問回数</span>
                <span className="font-bold">{monthlyResults.length}回</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="font-bold text-stone-800">合計金額（概算）</span>
                <span className="font-bold text-base">{formatYen(totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center mt-1 text-amber-700">
                <span className="font-bold">患者様ご負担額（概算）</span>
                <span className="font-bold text-base">{formatYen(totalCopay)}</span>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-stone-800 mb-2">訪問日別内訳</h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100">
                    <th className="border border-stone-300 px-2 py-1.5 text-left font-bold">訪問日</th>
                    <th className="border border-stone-300 px-2 py-1.5 text-left font-bold">種別</th>
                    <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">金額</th>
                    <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">ご負担額</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyResults.map((r) => {
                    const [y, m, d] = r.date.split("-").map(Number);
                    const weekdays = ["日","月","火","水","木","金","土"];
                    const dow = weekdays[new Date(y, m - 1, d).getDay()];
                    const conf = MODE_CONFIG[r.insuranceMode];
                    return (
                      <tr key={r.id} className="hover:bg-stone-50">
                        <td className="border border-stone-300 px-2 py-1.5">{m}/{d}（{dow}）</td>
                        <td className="border border-stone-300 px-2 py-1.5">{conf.label}</td>
                        <td className="border border-stone-300 px-2 py-1.5 text-right font-medium">{formatYen(r.totalYen)}</td>
                        <td className="border border-stone-300 px-2 py-1.5 text-right font-medium">{formatYen(r.copayAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-100 font-bold">
                    <td colSpan={2} className="border border-stone-300 px-2 py-1.5">合計</td>
                    <td className="border border-stone-300 px-2 py-1.5 text-right">{formatYen(totalAmount)}</td>
                    <td className="border border-stone-300 px-2 py-1.5 text-right">{formatYen(totalCopay)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="text-xs text-stone-500 border border-stone-200 rounded p-3 space-y-1">
              <p className="font-bold text-stone-700">【ご注意】</p>
              <p>・本書は概算であり、実際の請求額と異なる場合があります。</p>
              <p>・患者様ご負担額は高額療養費制度等の適用前の概算です。</p>
              <p>・公費負担医療の月額上限額は、他の医療機関・薬局との合算で管理されます。</p>
              <p>・令和8年度（2026年度）診療報酬改定・令和6年度介護報酬改定に基づき算定しています。</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#print-root) { display: none !important; }
          #print-root { background: white !important; position: static !important; display: block !important; padding: 0 !important; }
          #print-root > div { box-shadow: none !important; border-radius: 0 !important; max-height: none !important; width: 100% !important; max-width: none !important; }
          #print-root > div > div:first-child { display: none !important; }
          #print-root > div > div:last-child { overflow: visible !important; padding: 0 !important; }
          #print-content { border: none !important; padding: 12mm 15mm !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// 契約書用料金表プレビュー
// ============================================================
interface FeeTablePreviewProps {
  stationName: string;
  onClose: () => void;
}

type FeeTableMode = "medical" | "care" | "preventive" | "psychiatric";

function FeeTablePreview({ stationName, onClose }: FeeTablePreviewProps) {
  const [selectedMode, setSelectedMode] = useState<FeeTableMode>("medical");
  const printDate = new Date().toLocaleDateString("ja-JP");
  const handlePrint = () => window.print();

  const modeLabels: Record<FeeTableMode, string> = {
    medical: "医療保険（訪問看護療養費）",
    care: "介護保険（訪問看護費）",
    preventive: "介護予防訪問看護費",
    psychiatric: "精神科訪問看護基本療養費",
  };

  return (
    <div id="print-root" className="fixed inset-0 z-50 bg-stone-800/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col print:shadow-none print:rounded-none print:max-h-none print:w-full print:max-w-none">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 shrink-0">
          <h2 className="font-bold text-stone-800">契約書用 利用料金表</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
            >
              <PrinterIcon className="w-4 h-4" />
              印刷する
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 種別タブ */}
        <div className="flex border-b border-stone-200 shrink-0 overflow-x-auto print:hidden">
          {(["medical", "care", "preventive", "psychiatric"] as FeeTableMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMode(m)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                selectedMode === m
                  ? "border-b-2 border-amber-600 text-amber-700"
                  : "text-stone-500 hover:text-stone-700"
              )}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>

        {/* 料金表コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          <div id="print-content" className="bg-white border border-stone-200 rounded-lg p-6 space-y-5 text-sm">
            {/* タイトル */}
            <div className="text-center border-b-2 border-stone-800 pb-3">
              <h1 className="text-lg font-bold text-stone-900">
                訪問看護 利用料金表
              </h1>
              <p className="text-sm font-medium text-stone-700 mt-1">{modeLabels[selectedMode]}</p>
              <p className="text-xs text-stone-500 mt-0.5">令和8年度（2026年度）診療報酬改定 準拠</p>
            </div>

            {/* 事業所情報 */}
            <div className="flex justify-between text-xs">
              <div><span className="text-stone-500">事業所名：</span><span className="font-bold">{stationName || "　　　　　　　　　　　　"}</span></div>
              <div><span className="text-stone-500">作成日：</span><span className="font-bold">{printDate}</span></div>
            </div>

            {/* 医療保険 料金表 */}
            {selectedMode === "medical" && <MedicalFeeTable />}
            {selectedMode === "care" && <CareFeeTable />}
            {selectedMode === "preventive" && <PreventiveFeeTable />}
            {selectedMode === "psychiatric" && <PsychiatricFeeTable />}

            {/* 注意書き */}
            <div className="text-xs text-stone-500 border border-stone-200 rounded p-3 space-y-1">
              <p className="font-bold text-stone-700">【ご注意】</p>
              <p>・上記料金は令和8年度（2026年度）診療報酬改定・令和6年度介護報酬改定に基づく算定額です。</p>
              <p>・患者様のご負担額は、保険の種別・負担割合・公費負担医療の適用等により異なります。</p>
              <p>・加算の算定は、訪問時の状況・指示書の内容等により異なります。詳細はご相談ください。</p>
              {selectedMode === "care" || selectedMode === "preventive" ? (
                <p>・介護保険の単位数は地域区分単価（1単位＝10.00〜10.90円）により円換算額が異なります。</p>
              ) : null}
              {selectedMode === "psychiatric" && (
                <p>・自立支援医療（精神通院）適用の場合、月額自己負担上限額の管理が必要です。</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > *:not(#print-root) { display: none !important; }
          #print-root { background: white !important; position: static !important; display: block !important; padding: 0 !important; }
          #print-root > div { box-shadow: none !important; border-radius: 0 !important; max-height: none !important; width: 100% !important; max-width: none !important; }
          #print-root > div > div:first-child { display: none !important; }
          #print-root > div > div:nth-child(2) { display: none !important; }
          #print-root > div > div:last-child { overflow: visible !important; padding: 0 !important; }
          #print-content { border: none !important; padding: 12mm 15mm !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// 料金表コンポーネント群
// ============================================================

function TableHeader({ children }: { children: React.ReactNode }) {
  return <th className="border border-stone-300 px-2 py-1.5 text-left font-bold bg-stone-100 text-xs">{children}</th>;
}
function TableCell({ children, right, colSpan }: { children: React.ReactNode; right?: boolean; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("border border-stone-300 px-2 py-1.5 text-xs", right && "text-right")}>{children}</td>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-bold text-stone-800 text-sm border-l-4 border-amber-500 pl-2 mt-4 mb-2">{children}</h3>;
}

function MedicalFeeTable() {
  return (
    <div className="space-y-3">
      <SectionTitle>訪問看護基本療養費Ⅰ（同一建物以外）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>職種</TableHeader>
            <TableHeader>週3日目まで</TableHeader>
            <TableHeader>週4日目以降</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>保健師・助産師・看護師</TableCell><TableCell right>5,550円</TableCell><TableCell right>6,550円</TableCell></tr>
          <tr><TableCell>准看護師</TableCell><TableCell right>5,050円</TableCell><TableCell right>6,050円</TableCell></tr>
          <tr><TableCell>理学療法士・作業療法士・言語聴覚士</TableCell><TableCell right>5,550円</TableCell><TableCell right>6,550円</TableCell></tr>
          <tr><TableCell>専門看護師（緩和ケア等）</TableCell><TableCell right colSpan={2}>12,850円（週1回）</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>訪問看護管理療養費</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>区分</TableHeader>
            <TableHeader>月初日</TableHeader>
            <TableHeader>2日目以降（20人未満）</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>通常</TableCell><TableCell right>7,710円</TableCell><TableCell right>3,010円</TableCell></tr>
          <tr><TableCell>機能強化型1</TableCell><TableCell right>13,760円</TableCell><TableCell right>3,010円</TableCell></tr>
          <tr><TableCell>機能強化型2</TableCell><TableCell right>10,460円</TableCell><TableCell right>3,010円</TableCell></tr>
          <tr><TableCell>機能強化型3</TableCell><TableCell right>9,030円</TableCell><TableCell right>3,010円</TableCell></tr>
          <tr><TableCell>機能強化型4（新設）</TableCell><TableCell right>9,030円</TableCell><TableCell right>3,010円</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>主な加算</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算名</TableHeader>
            <TableHeader>金額</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>24時間対応体制加算 イ</TableCell><TableCell right>6,800円</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>24時間対応体制加算 ロ</TableCell><TableCell right>6,520円</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>特別管理加算（1）</TableCell><TableCell right>5,000円</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>特別管理加算（2）</TableCell><TableCell right>2,500円</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>難病等複数回訪問加算（1日2回）</TableCell><TableCell right>4,500円</TableCell><TableCell>1日2回訪問</TableCell></tr>
          <tr><TableCell>難病等複数回訪問加算（1日3回以上）</TableCell><TableCell right>8,000円</TableCell><TableCell>1日3回以上</TableCell></tr>
          <tr><TableCell>複数名訪問加算（看護師等）</TableCell><TableCell right>4,500円</TableCell><TableCell>2名同行訪問</TableCell></tr>
          <tr><TableCell>夜間・早朝訪問看護加算</TableCell><TableCell right>2,100円</TableCell><TableCell>18〜22時/6〜8時</TableCell></tr>
          <tr><TableCell>深夜訪問看護加算</TableCell><TableCell right>4,200円</TableCell><TableCell>22〜6時</TableCell></tr>
          <tr><TableCell>訪問看護ターミナルケア療養費1</TableCell><TableCell right>25,000円</TableCell><TableCell>在宅死亡月</TableCell></tr>
          <tr><TableCell>訪問看護ターミナルケア療養費2</TableCell><TableCell right>10,000円</TableCell><TableCell>特養等死亡月</TableCell></tr>
        </tbody>
      </table>
    </div>
  );
}

function CareFeeTable() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">※ 単位数は令和6年度改定後。円換算は地域区分単価（1単位＝10.00〜10.90円）により異なります。</p>

      <SectionTitle>訪問看護費（訪問看護ステーション）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>目安金額（10円換算）</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>20分未満</TableCell><TableCell right>313単位</TableCell><TableCell right>3,130円</TableCell></tr>
          <tr><TableCell>30分未満</TableCell><TableCell right>470単位</TableCell><TableCell right>4,700円</TableCell></tr>
          <tr><TableCell>30分以上1時間未満</TableCell><TableCell right>821単位</TableCell><TableCell right>8,210円</TableCell></tr>
          <tr><TableCell>1時間以上1時間30分未満</TableCell><TableCell right>1,125単位</TableCell><TableCell right>11,250円</TableCell></tr>
          <tr><TableCell>理学療法士等による訪問</TableCell><TableCell right>293単位</TableCell><TableCell right>2,930円</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>訪問看護費（病院・診療所）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>目安金額（10円換算）</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>20分未満</TableCell><TableCell right>265単位</TableCell><TableCell right>2,650円</TableCell></tr>
          <tr><TableCell>30分未満</TableCell><TableCell right>398単位</TableCell><TableCell right>3,980円</TableCell></tr>
          <tr><TableCell>30分以上1時間未満</TableCell><TableCell right>573単位</TableCell><TableCell right>5,730円</TableCell></tr>
          <tr><TableCell>1時間以上1時間30分未満</TableCell><TableCell right>842単位</TableCell><TableCell right>8,420円</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>主な加算（単位数）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算名</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>緊急時訪問看護加算（Ⅰ）</TableCell><TableCell right>600単位</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>特別管理加算（1）</TableCell><TableCell right>500単位</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>特別管理加算（2）</TableCell><TableCell right>250単位</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>複数名訪問看護加算（Ⅰ）看護師等</TableCell><TableCell right>254単位</TableCell><TableCell>1回</TableCell></tr>
          <tr><TableCell>夜間・早朝加算</TableCell><TableCell right>所定単位数の25%</TableCell><TableCell>18〜22時/6〜8時</TableCell></tr>
          <tr><TableCell>深夜加算</TableCell><TableCell right>所定単位数の50%</TableCell><TableCell>22〜6時</TableCell></tr>
          <tr><TableCell>ターミナルケア加算</TableCell><TableCell right>2,500単位</TableCell><TableCell>死亡月</TableCell></tr>
          <tr><TableCell>初回加算（Ⅱ）</TableCell><TableCell right>300単位</TableCell><TableCell>月1回</TableCell></tr>
        </tbody>
      </table>
    </div>
  );
}

function PreventiveFeeTable() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">※ 要支援1・2の方が対象です。単位数は令和6年度改定後。</p>

      <SectionTitle>介護予防訪問看護費（訪問看護ステーション）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>目安金額（10円換算）</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>20分未満</TableCell><TableCell right>303単位</TableCell><TableCell right>3,030円</TableCell></tr>
          <tr><TableCell>30分未満</TableCell><TableCell right>451単位</TableCell><TableCell right>4,510円</TableCell></tr>
          <tr><TableCell>30分以上1時間未満</TableCell><TableCell right>794単位</TableCell><TableCell right>7,940円</TableCell></tr>
          <tr><TableCell>1時間以上1時間30分未満</TableCell><TableCell right>1,087単位</TableCell><TableCell right>10,870円</TableCell></tr>
          <tr><TableCell>理学療法士等による訪問</TableCell><TableCell right>294単位</TableCell><TableCell right>2,940円</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>介護予防訪問看護費（病院・診療所）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>目安金額（10円換算）</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>20分未満</TableCell><TableCell right>266単位</TableCell><TableCell right>2,660円</TableCell></tr>
          <tr><TableCell>30分未満</TableCell><TableCell right>399単位</TableCell><TableCell right>3,990円</TableCell></tr>
          <tr><TableCell>30分以上1時間未満</TableCell><TableCell right>574単位</TableCell><TableCell right>5,740円</TableCell></tr>
          <tr><TableCell>1時間以上1時間30分未満</TableCell><TableCell right>844単位</TableCell><TableCell right>8,440円</TableCell></tr>
          <tr><TableCell>理学療法士等による訪問</TableCell><TableCell right>266単位</TableCell><TableCell right>2,660円</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>主な加算（単位数）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算名</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>緊急時訪問看護加算（Ⅰ）</TableCell><TableCell right>600単位</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>特別管理加算（1）</TableCell><TableCell right>500単位</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>特別管理加算（2）</TableCell><TableCell right>250単位</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>初回加算（Ⅰ）退院・施設退所後</TableCell><TableCell right>350単位</TableCell><TableCell>月1回（新設）</TableCell></tr>
          <tr><TableCell>初回加算（Ⅱ）通常</TableCell><TableCell right>300単位</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>複数名訪問看護加算（Ⅰ）看護師等</TableCell><TableCell right>254単位</TableCell><TableCell>1回</TableCell></tr>
          <tr><TableCell>複数名訪問看護加算（Ⅱ）その他</TableCell><TableCell right>201単位</TableCell><TableCell>1回</TableCell></tr>
          <tr><TableCell>夜間・早朝加算</TableCell><TableCell right>所定単位数の25%</TableCell><TableCell>18〜22時/6〜8時</TableCell></tr>
          <tr><TableCell>深夜加算</TableCell><TableCell right>所定単位数の50%</TableCell><TableCell>22〜6時</TableCell></tr>
          <tr><TableCell>ターミナルケア加算</TableCell><TableCell right>2,500単位</TableCell><TableCell>死亡月</TableCell></tr>
        </tbody>
      </table>
    </div>
  );
}

function PsychiatricFeeTable() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">※ 精神疾患を有する者に対する訪問看護。令和8年度（2026年度）診療報酬改定後の点数です。</p>

      <SectionTitle>精神科訪問看護基本療養費Ⅰ（通常・同一建物1人）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>週3日目まで</TableHeader>
            <TableHeader>週4日目以降</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>30分以上</TableCell><TableCell right>5,550円</TableCell><TableCell right>6,550円</TableCell></tr>
          <tr><TableCell>30分未満</TableCell><TableCell right>4,250円</TableCell><TableCell right>5,100円</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>精神科訪問看護基本療養費Ⅱ（同一建物2人）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>週3日目まで</TableHeader>
            <TableHeader>週4日目以降</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>30分以上</TableCell><TableCell right>5,550円</TableCell><TableCell right>6,550円</TableCell></tr>
          <tr><TableCell>30分未満</TableCell><TableCell right>4,250円</TableCell><TableCell right>5,100円</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>精神科訪問看護基本療養費Ⅲ（同一建物3人以上）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>週3日目まで</TableHeader>
            <TableHeader>週4日目以降</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>30分以上</TableCell><TableCell right>2,780円</TableCell><TableCell right>3,280円</TableCell></tr>
          <tr><TableCell>30分未満</TableCell><TableCell right>2,130円</TableCell><TableCell right>2,550円</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>精神科訪問看護基本療養費Ⅳ（外泊中）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <tbody>
          <tr><TableCell>外泊中の訪問（週1回）</TableCell><TableCell right>8,500円</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>訪問看護管理療養費</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>区分</TableHeader>
            <TableHeader>月初日</TableHeader>
            <TableHeader>2日目以降（20人未満）</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>通常</TableCell><TableCell right>7,710円</TableCell><TableCell right>3,010円</TableCell></tr>
          <tr><TableCell>機能強化型1</TableCell><TableCell right>13,760円</TableCell><TableCell right>3,010円</TableCell></tr>
          <tr><TableCell>機能強化型2</TableCell><TableCell right>10,460円</TableCell><TableCell right>3,010円</TableCell></tr>
          <tr><TableCell>機能強化型3・4</TableCell><TableCell right>9,030円</TableCell><TableCell right>3,010円</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>主な加算</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算名</TableHeader>
            <TableHeader>金額</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>精神科緊急訪問看護加算</TableCell><TableCell right>2,650円</TableCell><TableCell>定期外緊急訪問</TableCell></tr>
          <tr><TableCell>長時間精神科訪問看護加算</TableCell><TableCell right>5,200円</TableCell><TableCell>週1回（条件下週3回）</TableCell></tr>
          <tr><TableCell>複数名精神科訪問看護加算（看護師等）</TableCell><TableCell right>4,500円</TableCell><TableCell>2名同行</TableCell></tr>
          <tr><TableCell>複数名精神科訪問看護加算（看護補助者）</TableCell><TableCell right>3,000円</TableCell><TableCell>週1回まで</TableCell></tr>
          <tr><TableCell>精神科複数回訪問加算（1日2回）</TableCell><TableCell right>4,500円</TableCell><TableCell>厚生労働大臣が定める状態</TableCell></tr>
          <tr><TableCell>精神科複数回訪問加算（1日3回以上）</TableCell><TableCell right>8,000円</TableCell><TableCell>特別訪問看護指示書</TableCell></tr>
          <tr><TableCell>夜間・早朝訪問看護加算</TableCell><TableCell right>2,100円</TableCell><TableCell>18〜22時/6〜8時</TableCell></tr>
          <tr><TableCell>深夜訪問看護加算</TableCell><TableCell right>4,200円</TableCell><TableCell>22〜6時</TableCell></tr>
          <tr><TableCell>24時間対応体制加算 イ</TableCell><TableCell right>6,800円</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>24時間対応体制加算 ロ</TableCell><TableCell right>6,520円</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>特別管理加算（1）</TableCell><TableCell right>5,000円</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>特別管理加算（2）</TableCell><TableCell right>2,500円</TableCell><TableCell>月1回</TableCell></tr>
          <tr><TableCell>訪問看護ターミナルケア療養費1</TableCell><TableCell right>25,000円</TableCell><TableCell>在宅死亡月</TableCell></tr>
          <tr><TableCell>訪問看護ターミナルケア療養費2</TableCell><TableCell right>10,000円</TableCell><TableCell>特養等死亡月</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>自立支援医療（精神通院）の自己負担上限額（月額）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>所得区分</TableHeader>
            <TableHeader>月額上限額</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>生活保護・低所得1</TableCell><TableCell right>2,500円</TableCell></tr>
          <tr><TableCell>低所得2</TableCell><TableCell right>5,000円</TableCell></tr>
          <tr><TableCell>一般所得1（重度かつ継続）</TableCell><TableCell right>5,000円</TableCell></tr>
          <tr><TableCell>一般所得2（重度かつ継続）</TableCell><TableCell right>10,000円</TableCell></tr>
          <tr><TableCell>上位所得（重度かつ継続）</TableCell><TableCell right>20,000円</TableCell></tr>
          <tr><TableCell>重度かつ継続に非該当</TableCell><TableCell right>上限なし（1割負担）</TableCell></tr>
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// メインページ
// ============================================================
export default function Home() {
  const store = useVisitStore();
  const [showPrint, setShowPrint] = useState(false);
  const [showFeeTable, setShowFeeTable] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<"calendar" | "summary">("calendar");

  const visitDates = useMemo(
    () => new Set(store.currentMonthVisits.map((v) => v.date)),
    [store.currentMonthVisits]
  );

  const firstVisitDate = useMemo(
    () => store.currentMonthVisits.length > 0 ? store.currentMonthVisits[0].date : null,
    [store.currentMonthVisits]
  );

  const selectedVisitDay = store.selectedDate ? store.getVisitDay(store.selectedDate) : null;

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col max-w-lg mx-auto">
      {/* ヘッダー */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 shrink-0 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-stone-900">訪問看護 料金計算</h1>
            <p className="text-xs text-stone-400">令和8年度改定準拠</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFeeTable(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-stone-50 text-stone-600 border border-stone-200 rounded-lg text-xs font-medium hover:bg-stone-100 transition-colors"
            >
              <FileTextIcon className="w-3.5 h-3.5" />
              料金表
            </button>
            {store.monthlyResults.length > 0 && (
              <button
                onClick={() => setShowPrint(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors"
              >
                <PrinterIcon className="w-3.5 h-3.5" />
                印刷
              </button>
            )}
          </div>
        </div>

        {/* 利用者・事業所名入力 */}
        <div className="mt-2 flex gap-2">
          <div className="flex items-center gap-1 flex-1 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5">
            <UserIcon className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <input
              type="text"
              placeholder="利用者名"
              value={store.patientName}
              onChange={(e) => store.setPatientName(e.target.value)}
              className="flex-1 text-xs bg-transparent outline-none text-stone-700 placeholder:text-stone-300"
            />
          </div>
          <div className="flex items-center gap-1 flex-1 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1.5">
            <BuildingIcon className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <input
              type="text"
              placeholder="事業所名"
              value={store.stationName}
              onChange={(e) => store.setStationName(e.target.value)}
              className="flex-1 text-xs bg-transparent outline-none text-stone-700 placeholder:text-stone-300"
            />
          </div>
        </div>
      </header>

      {/* 月ナビゲーション */}
      <div className="bg-white border-b border-stone-200 px-4 py-2 flex items-center justify-between shrink-0">
        <button onClick={store.prevMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
          <ChevronLeftIcon className="w-5 h-5 text-stone-600" />
        </button>
        <div className="text-center">
          <div className="font-bold text-stone-900">{store.year}年{store.month}月</div>
          {store.monthlyResults.length > 0 && (
            <div className="text-xs text-amber-600 font-medium">
              {store.monthlyResults.length}回 / {formatYen(store.totalAmount)}
            </div>
          )}
        </div>
        <button onClick={store.nextMonth} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
          <ChevronRightIcon className="w-5 h-5 text-stone-600" />
        </button>
      </div>

      {/* メインタブ */}
      <div className="bg-white border-b border-stone-200 flex shrink-0">
        <button
          onClick={() => setActiveMainTab("calendar")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
            activeMainTab === "calendar" ? "border-b-2 border-amber-600 text-amber-700" : "text-stone-500 hover:text-stone-700"
          )}
        >
          <CalendarDaysIcon className="w-4 h-4" />
          カレンダー
        </button>
        <button
          onClick={() => setActiveMainTab("summary")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
            activeMainTab === "summary" ? "border-b-2 border-amber-600 text-amber-700" : "text-stone-500 hover:text-stone-700"
          )}
        >
          <ClipboardListIcon className="w-4 h-4" />
          月次集計
          {store.monthlyResults.length > 0 && (
            <span className="bg-amber-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {store.monthlyResults.length}
            </span>
          )}
        </button>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {activeMainTab === "calendar" ? (
          <div className="p-4 space-y-4">
            {/* デフォルト保険種別 */}
            <div className="bg-white rounded-xl border border-stone-200 p-3">
              <div className="text-xs text-stone-500 mb-2">新規訪問日のデフォルト種別</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["medical", "care", "preventive", "psychiatric"] as InsuranceMode[]).map((m) => {
                  const conf = MODE_CONFIG[m];
                  const isActive = store.globalInsuranceMode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => store.setGlobalInsuranceMode(m)}
                      className={cn(
                        "py-2 rounded-lg text-sm font-bold transition-all",
                        isActive ? `${conf.color} text-white shadow-sm` : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      )}
                    >
                      {conf.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* カレンダー */}
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <Calendar
                year={store.year}
                month={store.month}
                visitDates={visitDates}
                selectedDate={store.selectedDate}
                firstVisitDate={firstVisitDate}
                onToggle={store.toggleVisitDay}
                onSelect={store.setSelectedDate}
              />
            </div>

            {/* 選択日のクイック情報 */}
            {store.selectedDate && selectedVisitDay && (
              <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
                <div className="bg-amber-50 px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-amber-800">
                    {store.selectedDate.split("-").slice(1).join("/")} の算定
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        store.toggleVisitDay(store.selectedDate!);
                        store.setSelectedDate(null);
                      }}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      削除
                    </button>
                    <button
                      onClick={() => store.setSelectedDate(store.selectedDate)}
                      className="text-xs text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-lg font-medium transition-colors"
                    >
                      詳細設定 →
                    </button>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded font-medium",
                      MODE_CONFIG[selectedVisitDay.insuranceMode].badgeBg,
                      MODE_CONFIG[selectedVisitDay.insuranceMode].badgeText
                    )}>
                      {MODE_CONFIG[selectedVisitDay.insuranceMode].label}
                    </span>
                    <span className="font-bold text-stone-800">
                      {(() => {
                        const r = store.monthlyResults.find(r => r.date === store.selectedDate);
                        return r ? formatYen(r.totalYen) : "—";
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 凡例 */}
            <div className="flex items-center gap-4 text-xs text-stone-500 justify-center">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded bg-amber-100 border border-amber-300" />
                <span>訪問日</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded border-2 border-amber-400" />
                <span>今日</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <MonthlySummaryPanel
              store={store}
              onSelectDate={(date) => {
                store.setSelectedDate(date);
                setActiveMainTab("calendar");
              }}
            />
          </div>
        )}
      </div>

      {/* 訪問日詳細パネル */}
      {store.selectedDate && selectedVisitDay && (
        <VisitDetailPanel
          dateStr={store.selectedDate}
          store={store}
          onClose={() => store.setSelectedDate(null)}
        />
      )}

      {/* 印刷プレビュー */}
      {showPrint && (
        <PrintPreview
          store={store}
          onClose={() => setShowPrint(false)}
          onShowFeeTable={() => { setShowPrint(false); setShowFeeTable(true); }}
        />
      )}

      {/* 契約書用料金表 */}
      {showFeeTable && (
        <FeeTablePreview
          stationName={store.stationName}
          onClose={() => setShowFeeTable(false)}
        />
      )}
    </div>
  );
}
