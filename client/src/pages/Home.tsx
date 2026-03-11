/**
 * 訪問看護療養費計算アプリ - メインページ
 * Design: ウォームアンバー・プロフェッショナル
 * - テラコッタ/アンバーオレンジをプライマリカラー
 * - ウィザード形式: 保険種別選択 → 算定条件 → 負担割合 → 完了
 * - カレンダーで訪問日を選択、タップ順に初回・2回目・3回目と自動カウント
 * - 訪問日が1件以上で月次集計ボタンを表示
 * - 医療保険・介護保険・介護予防・精神科訪問看護の4種対応
 * - 処遇改善加算（介護保険）・ベースアップ評価料（医療保険）対応
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
  calcShoguKaizenKasan,
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
  CheckIcon,
  ArrowRightIcon,
  HeartPulseIcon,
  BriefcaseMedicalIcon,
  ShieldIcon,
  BrainIcon,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// ============================================================
// 保険種別のカラー・ラベル定義
// ============================================================

const MODE_CONFIG: Record<InsuranceMode, {
  label: string; shortLabel: string; color: string; bgColor: string;
  borderColor: string; badgeBg: string; badgeText: string; icon: React.ReactNode;
}> = {
  medical: {
    label: "医療保険",
    shortLabel: "医療",
    color: "bg-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-700",
    icon: <HeartPulseIcon className="w-6 h-6" />,
  },
  care: {
    label: "介護保険",
    shortLabel: "介護",
    color: "bg-teal-600",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-700",
    icon: <BriefcaseMedicalIcon className="w-6 h-6" />,
  },
  preventive: {
    label: "介護予防",
    shortLabel: "予防",
    color: "bg-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
    icon: <ShieldIcon className="w-6 h-6" />,
  },
  psychiatric: {
    label: "精神科",
    shortLabel: "精神",
    color: "bg-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-700",
    icon: <BrainIcon className="w-6 h-6" />,
  },
};

// ============================================================
// カレンダーコンポーネント
// ============================================================
interface CalendarProps {
  year: number;
  month: number;
  visitDays: Array<{ date: string; insuranceMode: InsuranceMode }>;
  selectedDate: string | null;
  onToggle: (date: string) => void;
  onSelect: (date: string) => void;
}

function Calendar({ year, month, visitDays, selectedDate, onToggle, onSelect }: CalendarProps) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  // 訪問日をdateでインデックス化（何回目か）
  const sortedVisits = [...visitDays].sort((a, b) => a.date.localeCompare(b.date));
  const visitIndexMap = new Map<string, number>();
  sortedVisits.forEach((v, i) => visitIndexMap.set(v.date, i + 1));
  const visitModeMap = new Map<string, InsuranceMode>();
  visitDays.forEach(v => visitModeMap.set(v.date, v.insuranceMode));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const visitCountLabels = ["初","②","③","④","⑤","⑥","⑦","⑧","⑨","⑩"];

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
              const visitIndex = visitIndexMap.get(dateStr);
              const isVisit = visitIndex !== undefined;
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === today;
              const dayOfWeek = (firstDay + (day - 1)) % 7;
              const visitMode = visitModeMap.get(dateStr);
              const modeConf = visitMode ? MODE_CONFIG[visitMode] : null;

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
                      : isVisit && modeConf
                      ? `${modeConf.color} text-white shadow-sm`
                      : isToday
                      ? "border-2 border-amber-400 text-amber-700 hover:bg-amber-50"
                      : "hover:bg-stone-100 text-stone-700",
                    dayOfWeek === 0 && !isVisit && !isSelected && "text-red-500",
                    dayOfWeek === 6 && !isVisit && !isSelected && "text-blue-500",
                  )}
                >
                  <span className="text-xs leading-none">{day}</span>
                  {isVisit && visitIndex !== undefined && (
                    <span className="text-[9px] font-bold leading-none mt-0.5 opacity-90">
                      {visitCountLabels[visitIndex - 1] ?? `${visitIndex}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-stone-400 text-center">
        タップで訪問日追加 / 長押しで削除
      </div>
    </div>
  );
}

// ============================================================
// ウィザード形式 訪問日詳細パネル
// ============================================================
type WizardStep = "mode" | "calc" | "copay";

interface VisitDetailPanelProps {
  dateStr: string;
  store: ReturnType<typeof useVisitStore>;
  onClose: () => void;
  visitIndex: number; // 月内何回目か
}

function VisitDetailPanel({ dateStr, store, onClose, visitIndex }: VisitDetailPanelProps) {
  const visitDay = store.getVisitDay(dateStr);
  const [wizardStep, setWizardStep] = useState<WizardStep>("mode");
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

  const visitCountLabels = ["初回","2回目","3回目","4回目","5回目","6回目","7回目","8回目","9回目","10回目"];
  const visitLabel = visitCountLabels[visitIndex - 1] ?? `${visitIndex}回目`;

  // ウィザードのステップラベル
  const steps: { key: WizardStep; label: string }[] = [
    { key: "mode", label: "種別" },
    { key: "calc", label: "算定条件" },
    { key: "copay", label: "負担割合" },
  ];

  const stepIndex = steps.findIndex(s => s.key === wizardStep);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden" style={{height: '100dvh'}}>
      {/* ヘッダー */}
      <div className={cn("text-white px-4 py-3 flex items-center gap-3 shrink-0", modeConf.color)}>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors">
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="font-bold text-base">{dateLabel}（{dow}）</div>
          <div className="text-xs text-white/70">{visitLabel} · {modeConf.label}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/70">合計</div>
          <div className="font-bold text-lg">{formatYen(totalYen)}</div>
        </div>
      </div>

      {/* ウィザードステップインジケーター */}
      <div className="bg-stone-50 border-b border-stone-200 px-4 py-2 shrink-0">
        <div className="flex items-center justify-center gap-2">
          {steps.map((step, i) => (
            <div key={step.key} className="flex items-center gap-2">
              <button
                onClick={() => {
                  // 前のステップには戻れる
                  if (i <= stepIndex) setWizardStep(step.key);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all",
                  wizardStep === step.key
                    ? `${modeConf.color} text-white shadow-sm`
                    : i < stepIndex
                    ? "bg-stone-200 text-stone-600 hover:bg-stone-300"
                    : "bg-stone-100 text-stone-400"
                )}
              >
                {i < stepIndex ? (
                  <CheckIcon className="w-3 h-3" />
                ) : (
                  <span className="w-3 h-3 flex items-center justify-center font-bold">{i + 1}</span>
                )}
                {step.label}
              </button>
              {i < steps.length - 1 && (
                <ArrowRightIcon className="w-3 h-3 text-stone-300" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 自動コピー通知バナー */}
      {showAutoCopyBanner && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-xs text-green-700 font-medium">
              前回の訪問条件を自動引き継ぎ
              <span className="text-green-500 font-normal ml-1">（月1回加算は自動でOFF）</span>
            </span>
          </div>
          <button onClick={() => setShowAutoCopyBanner(false)} className="text-green-500 hover:text-green-700 p-1">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {/* ステップ1: 保険種別選択 */}
        {wizardStep === "mode" && (
          <div className="p-4 space-y-4">
            <div className="text-center">
              <p className="text-sm font-bold text-stone-700">保険種別を選択してください</p>
              <p className="text-xs text-stone-400 mt-1">{dateLabel}（{dow}）の訪問</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["medical", "care", "preventive", "psychiatric"] as InsuranceMode[]).map((m) => {
                const conf = MODE_CONFIG[m];
                const isActive = visitDay.insuranceMode === m;
                return (
                  <button
                    key={m}
                    onClick={() => store.updateVisitDay(dateStr, { insuranceMode: m })}
                    className={cn(
                      "flex flex-col items-center gap-2 py-5 rounded-xl font-bold text-sm transition-all border-2",
                      isActive
                        ? `${conf.color} text-white border-transparent shadow-lg scale-105`
                        : `bg-white text-stone-600 border-stone-200 hover:border-stone-400 hover:bg-stone-50`
                    )}
                  >
                    <span className={isActive ? "text-white" : "text-stone-400"}>
                      {conf.icon}
                    </span>
                    {conf.label}
                    {isActive && (
                      <span className="text-xs font-normal text-white/80">選択中</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 前回コピーボタン */}
            <button
              onClick={() => {
                store.copyPrevConditions(dateStr);
                setShowAutoCopyBanner(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-stone-100 text-stone-600 rounded-xl text-sm hover:bg-stone-200 transition-colors"
            >
              <CopyIcon className="w-4 h-4" />
              前回の訪問条件をコピー
            </button>
          </div>
        )}

        {/* ステップ2: 算定条件入力 */}
        {wizardStep === "calc" && (
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
        )}

        {/* ステップ3: 患者負担割合 */}
        {wizardStep === "copay" && (
          <div className="p-4 space-y-3">
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

      {/* 計算結果フッター（常に画面下部に固定） */}
      <div className="border-t border-stone-200 bg-stone-50 shrink-0">
        {/* 計算明細（算定条件・負担割合ステップのみ表示） */}
        {(wizardStep === "calc" || wizardStep === "copay") && (
          <>
            {warnings.length > 0 && (
              <div className="px-4 pt-2 space-y-1">
                {warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded p-2 border border-amber-200">
                    <AlertCircleIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 pt-2 pb-1">
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {resultItems.map((item, i) => (
                  <div key={i} className={cn(
                    "flex items-center justify-between text-xs",
                    item.disabled ? "opacity-40 line-through" : ""
                  )}>
                    <span className="text-stone-500 flex-1 pr-2 truncate">{item.label}</span>
                    <span className={cn("font-medium shrink-0", item.disabled ? "text-stone-400" : "text-stone-700")}>
                      {isUnitBased
                        ? `${item.amount.toLocaleString()}単位`
                        : formatYen(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 合計行 + ナビゲーションボタン */}
        <div className="px-4 pb-4 pt-1">
          {(wizardStep === "calc" || wizardStep === "copay") && (
            <>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-xs text-stone-500">合計金額</span>
                  {isUnitBased && (
                    <span className="text-xs text-stone-400 ml-1">{total.toLocaleString()}単位×{rateNum}円</span>
                  )}
                  {mode === "medical" && (
                    <span className="text-xs text-stone-400 ml-1">{Math.round(totalYen / 10)}点</span>
                  )}
                </div>
                <div className="text-xl font-bold text-amber-700">{formatYen(totalYen)}</div>
              </div>
              <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200 mb-3">
                <div>
                  <div className="text-xs text-stone-500">患者自己負担（概算）</div>
                  <div className="text-xs text-stone-400 leading-tight truncate max-w-[200px]">{copayNote}</div>
                </div>
                <div className="text-base font-bold text-amber-800">{formatYen(copayAmount)}</div>
              </div>
            </>
          )}

          {/* ボタン */}
          {wizardStep === "mode" && (
            <button
              onClick={() => setWizardStep("calc")}
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all",
                modeConf.color
              )}
            >
              次へ（算定条件の入力）
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          )}
          {wizardStep === "calc" && (
            <button
              onClick={() => setWizardStep("copay")}
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all",
                modeConf.color
              )}
            >
              次へ（負担割合の入力）
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          )}
          {wizardStep === "copay" && (
            <button
              onClick={onClose}
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all",
                modeConf.color
              )}
            >
              <CheckIcon className="w-5 h-5" />
              入力完了
            </button>
          )}
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
      <div className="text-center py-12 text-stone-400">
        <CalendarDaysIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <div className="text-sm font-medium">訪問日がありません</div>
        <div className="text-xs mt-1">カレンダーで訪問日をタップして追加してください</div>
      </div>
    );
  }

  const visitCountLabels = ["初回","2回目","3回目","4回目","5回目","6回目","7回目","8回目","9回目","10回目"];

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
          {monthlyResults.map((r, idx) => {
            const [y, m, d] = r.date.split("-").map(Number);
            const weekdays = ["日","月","火","水","木","金","土"];
            const dow = weekdays[new Date(y, m - 1, d).getDay()];
            const conf = MODE_CONFIG[r.insuranceMode];
            const visitLabel = visitCountLabels[idx] ?? `${idx + 1}回目`;
            return (
              <button
                key={r.id}
                onClick={() => onSelectDate(r.date)}
                className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-stone-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-left"
              >
                <div className={cn(
                  "w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 text-white",
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
                    <span className="text-xs text-stone-500 font-medium">{visitLabel}</span>
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
  const visitCountLabels = ["初回","2回目","3回目","4回目","5回目","6回目","7回目","8回目","9回目","10回目"];

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
                    <th className="border border-stone-300 px-2 py-1.5 text-left font-bold">回数</th>
                    <th className="border border-stone-300 px-2 py-1.5 text-left font-bold">種別</th>
                    <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">金額</th>
                    <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">ご負担額</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyResults.map((r, idx) => {
                    const [y, m, d] = r.date.split("-").map(Number);
                    const weekdays = ["日","月","火","水","木","金","土"];
                    const dow = weekdays[new Date(y, m - 1, d).getDay()];
                    const conf = MODE_CONFIG[r.insuranceMode];
                    const visitLabel = visitCountLabels[idx] ?? `${idx + 1}回目`;
                    return (
                      <tr key={r.id} className="hover:bg-stone-50">
                        <td className="border border-stone-300 px-2 py-1.5">{m}/{d}（{dow}）</td>
                        <td className="border border-stone-300 px-2 py-1.5">{visitLabel}</td>
                        <td className="border border-stone-300 px-2 py-1.5">{conf.label}</td>
                        <td className="border border-stone-300 px-2 py-1.5 text-right font-medium">{formatYen(r.totalYen)}</td>
                        <td className="border border-stone-300 px-2 py-1.5 text-right font-medium">{formatYen(r.copayAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-100 font-bold">
                    <td colSpan={3} className="border border-stone-300 px-2 py-1.5">合計</td>
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
              {(selectedMode === "care" || selectedMode === "preventive") && (
                <p>・介護保険の単位数は地域区分単価（1単位＝10.00〜10.90円）により円換算額が異なります。</p>
              )}
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
function TableCell({ children, right, colSpan, className }: { children: React.ReactNode; right?: boolean; colSpan?: number; className?: string }) {
  return <td colSpan={colSpan} className={cn("border border-stone-300 px-2 py-1.5 text-xs", right && "text-right", className)}>{children}</td>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-bold text-stone-800 text-sm border-l-4 border-amber-500 pl-2 mt-4 mb-2">{children}</h3>;
}

function MedicalFeeTable() {
  return (
    <div className="space-y-3">
      <SectionTitle>訪問看護基本療養費Ⅰ（同一建物以外・従来型）</SectionTitle>
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

      <SectionTitle>訪問看護基本療養費Ⅱ（同一建物内・従来型）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>区分</TableHeader>
            <TableHeader>週3日目まで</TableHeader>
            <TableHeader>週4日目以降</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>同一建物2人（看護師等）</TableCell><TableCell right>5,550円</TableCell><TableCell right>6,550円</TableCell></tr>
          <tr><TableCell>同一建物3人以上（看護師等）</TableCell><TableCell right>2,780円</TableCell><TableCell right>3,280円</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>包括型訪問看護療養費（訪問看護ステーション）</SectionTitle>
      <p className="text-xs text-stone-500 mb-1">※ 1日単位の包括評価。複数回・複数名・夜間加算は包括に含まれます。</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>単一建物20人未満</TableHeader>
            <TableHeader>20〜49人</TableHeader>
            <TableHeader>50人以上</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>30分以上60分未満</TableCell><TableCell right>12,850円</TableCell><TableCell right>10,280円</TableCell><TableCell right>9,000円</TableCell></tr>
          <tr><TableCell>60分以上90分未満</TableCell><TableCell right>17,130円</TableCell><TableCell right>13,700円</TableCell><TableCell right>12,000円</TableCell></tr>
          <tr><TableCell>90分以上</TableCell><TableCell right>20,560円</TableCell><TableCell right>16,450円</TableCell><TableCell right>14,400円</TableCell></tr>
          <tr><TableCell>90分以上（特別な場合）</TableCell><TableCell right>25,700円</TableCell><TableCell right>20,560円</TableCell><TableCell right>18,000円</TableCell></tr>
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
          <tr><TableCell>訪問看護ベースアップ評価料（Ⅰ）</TableCell><TableCell right>100円/日</TableCell><TableCell>職員処遇改善</TableCell></tr>
          <tr><TableCell>訪問看護ベースアップ評価料（Ⅱ）</TableCell><TableCell right>200円/日</TableCell><TableCell>ステーションのみ</TableCell></tr>
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
          <tr><TableCell>1時間以上1時間30分未満</TableCell><TableCell right>838単位</TableCell><TableCell right>8,380円</TableCell></tr>
          <tr><TableCell>理学療法士等による訪問</TableCell><TableCell right>265単位</TableCell><TableCell right>2,650円</TableCell></tr>
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
          <tr><TableCell className="font-medium text-teal-700">処遇改善加算（令和8年6月〜）</TableCell><TableCell right className="text-teal-700">所定単位数の1.8%</TableCell><TableCell>月単位で算定</TableCell></tr>
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
          <tr><TableCell className="font-medium text-emerald-700">処遇改善加算（令和8年6月〜）</TableCell><TableCell right className="text-emerald-700">所定単位数の1.8%</TableCell><TableCell>月単位で算定</TableCell></tr>
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

  const visitDaysForCalendar = useMemo(
    () => store.currentMonthVisits.map(v => ({ date: v.date, insuranceMode: v.insuranceMode })),
    [store.currentMonthVisits]
  );

  // 選択日の月内インデックス（何回目か）
  const selectedVisitIndex = useMemo(() => {
    if (!store.selectedDate) return 1;
    const sorted = [...store.currentMonthVisits].sort((a, b) => a.date.localeCompare(b.date));
    const idx = sorted.findIndex(v => v.date === store.selectedDate);
    return idx >= 0 ? idx + 1 : 1;
  }, [store.selectedDate, store.currentMonthVisits]);

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

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="p-4 space-y-4">
          {/* デフォルト保険種別 */}
          <div className="bg-white rounded-xl border border-stone-200 p-3">
            <div className="text-xs text-stone-500 mb-2 font-medium">新規訪問日のデフォルト種別</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(["medical", "care", "preventive", "psychiatric"] as InsuranceMode[]).map((m) => {
                const conf = MODE_CONFIG[m];
                const isActive = store.globalInsuranceMode === m;
                return (
                  <button
                    key={m}
                    onClick={() => store.setGlobalInsuranceMode(m)}
                    className={cn(
                      "py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5",
                      isActive ? `${conf.color} text-white shadow-sm` : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                    )}
                  >
                    <span className={cn("w-4 h-4", isActive ? "text-white" : "text-stone-400")}>
                      {conf.icon}
                    </span>
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
              visitDays={visitDaysForCalendar}
              selectedDate={store.selectedDate}
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
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded font-medium",
                      MODE_CONFIG[selectedVisitDay.insuranceMode].badgeBg,
                      MODE_CONFIG[selectedVisitDay.insuranceMode].badgeText
                    )}>
                      {MODE_CONFIG[selectedVisitDay.insuranceMode].label}
                    </span>
                    <span className="text-xs text-stone-500">{selectedVisitIndex}回目</span>
                  </div>
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
          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 justify-center">
            {(["medical", "care", "preventive", "psychiatric"] as InsuranceMode[]).map(m => (
              <div key={m} className="flex items-center gap-1">
                <div className={cn("w-3 h-3 rounded", MODE_CONFIG[m].color)} />
                <span>{MODE_CONFIG[m].label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 月次集計 固定ボタン（訪問日が1件以上の時） */}
      {store.monthlyResults.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 pb-4 pt-2 bg-gradient-to-t from-stone-100 to-transparent z-20">
          <button
            onClick={() => setShowPrint(true)}
            className="w-full py-4 bg-amber-600 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
          >
            <ClipboardListIcon className="w-5 h-5" />
            月次集計を確認する（{store.monthlyResults.length}回 / {formatYen(store.totalAmount)}）
          </button>
        </div>
      )}

      {/* 訪問日詳細パネル（ウィザード） */}
      {store.selectedDate && selectedVisitDay && (
        <VisitDetailPanel
          dateStr={store.selectedDate}
          store={store}
          onClose={() => store.setSelectedDate(null)}
          visitIndex={selectedVisitIndex}
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
