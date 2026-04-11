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
                      // 訪問済み日タップ→編集パネルを開く
                      onSelect(dateStr);
                    } else {
                      // 未訪問日タップ→即追加（確認画面なし）
                      onToggle(dateStr);
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
                  {/* 訪問済み日に鱛筆アイコン */}
                  {isVisit && (
                    <span className="absolute top-0.5 right-0.5 opacity-70">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-stone-400 text-center">
        タップで追加 / 訪問済みはタップで編集 / 長押しで削除
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
  // 2回目以降は前回内容を引き継いでいるのでステップ2（算定条件）から開始
  const initialStep: WizardStep = visitIndex >= 2 ? "calc" : "mode";
  const [wizardStep, setWizardStep] = useState<WizardStep>(initialStep);
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
              <div className="space-y-3">
                <CareForm
                  input={visitDay.careInput}
                  onChange={(updates) => store.updateVisitDay(dateStr, {
                    careInput: { ...visitDay.careInput, ...updates }
                  })}
                />
                {/* 処遇改善加算 */}
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-teal-800">処遇改善加算（1.8%）</div>
                      <div className="text-xs text-teal-600 mt-0.5">令和8年6月〜。所定単位数の1.8%を加算</div>
                    </div>
                    <button
                      onClick={() => store.updateVisitDay(dateStr, { applyShoguKaizen: !visitDay.applyShoguKaizen })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        visitDay.applyShoguKaizen ? "bg-teal-500" : "bg-stone-300"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                        visitDay.applyShoguKaizen ? "left-6" : "left-0.5"
                      )} />
                    </button>
                  </div>
                </div>
              </div>
            )}
            {visitDay.insuranceMode === "preventive" && (
              <div className="space-y-3">
                <PreventiveCareForm
                  input={visitDay.preventiveCareInput}
                  onChange={(updates) => store.updateVisitDay(dateStr, {
                    preventiveCareInput: { ...visitDay.preventiveCareInput, ...updates }
                  })}
                />
                {/* 処遇改善加算 */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-emerald-800">処遇改善加算（1.8%）</div>
                      <div className="text-xs text-emerald-600 mt-0.5">令和8年6月〜。所定単位数の1.8%を加算</div>
                    </div>
                    <button
                      onClick={() => store.updateVisitDay(dateStr, { applyShoguKaizen: !visitDay.applyShoguKaizen })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        visitDay.applyShoguKaizen ? "bg-emerald-500" : "bg-stone-300"
                      )}
                    >
                      <span className={cn(
                        "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                        visitDay.applyShoguKaizen ? "left-6" : "left-0.5"
                      )} />
                    </button>
                  </div>
                </div>
              </div>
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
        <div className="px-4 pb-20 pt-1">
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
  const { monthlyResults, totalAmount, totalCopay, year, month,
    hasShoguKaizen, monthlyShoguKaizenUnits, monthlyShoguKaizenYen, monthlyShoguKaizenCopay,
    careMonthlyTotalUnits } = store;

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
          {/* 処遇改善加算（月合計単位数から計算した月1回の加算） */}
          {hasShoguKaizen && monthlyShoguKaizenYen > 0 && (
            <div className="w-full flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 bg-emerald-600 text-white">
                <span className="text-xs font-bold leading-none">加算</span>
                <span className="text-[9px] opacity-80">月合計</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-emerald-800">処遇改善加算（1.8%）</div>
                <div className="text-xs text-emerald-600 mt-0.5">
                  月合計{careMonthlyTotalUnits.toLocaleString()}単位 × 1.8% = {monthlyShoguKaizenUnits.toLocaleString()}単位
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-emerald-800">{formatYen(monthlyShoguKaizenYen)}</div>
                <div className="text-xs text-emerald-600">負担 {formatYen(monthlyShoguKaizenCopay)}</div>
              </div>
            </div>
          )}
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
  const { year, month, monthlyResults, totalAmount, totalCopay,
    hasShoguKaizen, monthlyShoguKaizenUnits, monthlyShoguKaizenYen, monthlyShoguKaizenCopay,
    careMonthlyTotalUnits, globalMedicalInput, globalPsychInput, globalInsuranceMode } = store;
  const hasMedicalInfoLinkage = (globalInsuranceMode === "medical" && globalMedicalInput.medicalInfoLinkage)
    || (globalInsuranceMode === "psychiatric" && globalPsychInput.medicalInfoLinkage);
  const handlePrint = () => window.print();
  const visitCountLabels = ["初回","2回目","3回目","4回目","5回目","6回目","7回目","8回目","9回目","10回目"];

  return (
    <div id="print-root" className="fixed inset-0 z-50 bg-stone-800/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* ヘッダー（印刷非表示） */}
        <div className="no-print flex items-center justify-between px-4 py-3 border-b border-stone-200 shrink-0">
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
          <div id="print-content" className="bg-white border border-stone-200 rounded-lg p-5 text-sm">
            {/* タイトル */}
            <div className="text-center border-b-2 border-stone-800 pb-2 mb-3">
              <h1 className="text-base font-bold text-stone-900">訪問看護 診療報酬明細書（{year}年{month}月分）</h1>
            </div>

            {/* 月次サマリー（印刷時は横並び） */}
            <div className="print-summary flex gap-4 mb-3 text-xs">
              <div className="flex-1 bg-stone-50 rounded p-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">診療回数</span>
                  <span className="font-bold">{monthlyResults.length}回</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-stone-500">合計金額（概算）</span>
                  <span className="font-bold">{formatYen(totalAmount)}</span>
                </div>
              </div>
              <div className="flex-1 bg-amber-50 rounded p-2">
                <div className="flex justify-between">
                  <span className="text-stone-600 font-medium">患者様ご負担額（概算）</span>
                  <span className="font-bold text-amber-700 text-base">{formatYen(totalCopay)}</span>
                </div>
                <div className="text-xs text-stone-400 mt-1">高額療養費・公費負担制度適用前の概算</div>
              </div>
            </div>

            {/* 診療日別内訳 */}
            <div className="print-section">
              <h3 className="font-bold text-stone-800 text-xs mb-1.5 border-l-4 border-amber-500 pl-2">診療日別内訳</h3>
              {(() => {
                // 介護保険・介護予防が含まれるか判定
                const hasCare = monthlyResults.some(r => r.insuranceMode === "care" || r.insuranceMode === "preventive");
                const totalUnits = hasCare ? monthlyResults.reduce((sum, r) => sum + (r.insuranceMode === "care" || r.insuranceMode === "preventive" ? r.total : 0), 0) : 0;
                return (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100">
                    <th className="border border-stone-300 px-1.5 py-1 text-left font-bold" style={{width:'9%'}}>診療日</th>
                    <th className="border border-stone-300 px-1.5 py-1 text-left font-bold" style={{width:'7%'}}>回数</th>
                    <th className="border border-stone-300 px-1.5 py-1 text-left font-bold" style={{width:'9%'}}>種別</th>
                    <th className="border border-stone-300 px-1.5 py-1 text-left font-bold">料金内訳{hasCare && <span className="text-stone-400 font-normal">(単位数/円)</span>}</th>
                    {hasCare && <th className="border border-stone-300 px-1.5 py-1 text-right font-bold" style={{width:'11%'}}>合計単位</th>}
                    <th className="border border-stone-300 px-1.5 py-1 text-right font-bold" style={{width:'11%'}}>金額</th>
                    <th className="border border-stone-300 px-1.5 py-1 text-right font-bold" style={{width:'11%'}}>ご負担額</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyResults.map((r, idx) => {
                    const [y, m, d] = r.date.split("-").map(Number);
                    const weekdays = ["日","月","火","水","木","金","土"];
                    const dow = weekdays[new Date(y, m - 1, d).getDay()];
                    const conf = MODE_CONFIG[r.insuranceMode];
                    const visitLabel = visitCountLabels[idx] ?? `${idx + 1}回目`;
                    const isCare = r.insuranceMode === "care" || r.insuranceMode === "preventive";
                    const breakdownText = r.breakdown
                      .map(b => isCare && b.units != null
                        ? `${b.label}\u3000${b.units.toLocaleString()}単位（${formatYen(b.yen)}）`
                        : `${b.label}：${formatYen(b.yen)}`
                      )
                      .join("\n");
                    return (
                      <tr key={r.id}>
                        <td className="border border-stone-300 px-1.5 py-1 whitespace-nowrap">{m}/{d}（{dow}）</td>
                        <td className="border border-stone-300 px-1.5 py-1 whitespace-nowrap">{visitLabel}</td>
                        <td className="border border-stone-300 px-1.5 py-1 whitespace-nowrap">{conf.shortLabel}</td>
                        <td className="border border-stone-300 px-1.5 py-1">
                          <div className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">{breakdownText}</div>
                        </td>
                        {hasCare && <td className="border border-stone-300 px-1.5 py-1 text-right font-medium whitespace-nowrap">{isCare ? `${r.total.toLocaleString()}単位` : "-"}</td>}
                        <td className="border border-stone-300 px-1.5 py-1 text-right font-medium whitespace-nowrap">{formatYen(r.totalYen)}</td>
                        <td className="border border-stone-300 px-1.5 py-1 text-right font-medium whitespace-nowrap">{formatYen(r.copayAmount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {/* 処遇改善加算行（月合計単位数から計算した月1回の加算） */}
                  {hasShoguKaizen && monthlyShoguKaizenYen > 0 && (
                    <tr className="bg-emerald-50">
                      <td colSpan={3} className="border border-stone-300 px-1.5 py-1 text-xs">処遇改善加算（1.8%）</td>
                      <td className="border border-stone-300 px-1.5 py-1 text-xs text-emerald-700">月合計{careMonthlyTotalUnits.toLocaleString()}単位 × 1.8% = {monthlyShoguKaizenUnits.toLocaleString()}単位</td>
                      {hasCare && <td className="border border-stone-300 px-1.5 py-1 text-right text-xs text-emerald-700">{monthlyShoguKaizenUnits.toLocaleString()}単位</td>}
                      <td className="border border-stone-300 px-1.5 py-1 text-right text-xs font-medium text-emerald-700">{formatYen(monthlyShoguKaizenYen)}</td>
                      <td className="border border-stone-300 px-1.5 py-1 text-right text-xs text-emerald-700">{formatYen(monthlyShoguKaizenCopay)}</td>
                    </tr>
                  )}
                  <tr className="bg-stone-100 font-bold">
                    <td colSpan={hasCare ? 4 : 4} className="border border-stone-300 px-1.5 py-1">合計</td>
                    {hasCare && <td className="border border-stone-300 px-1.5 py-1 text-right">{totalUnits.toLocaleString()}単位</td>}
                    <td className="border border-stone-300 px-1.5 py-1 text-right">{formatYen(totalAmount)}</td>
                    <td className="border border-stone-300 px-1.5 py-1 text-right">{formatYen(totalCopay)}</td>
                  </tr>
                </tfoot>
              </table>
                );
              })()}
            </div>

            <div className="print-notice text-xs text-stone-500 border border-stone-200 rounded p-2 mt-3 space-y-0.5">
              <p className="font-bold text-stone-700">【ご注意】</p>
              <p>・本書は概算であり、実際の請求額と異なる場合があります。</p>
              <p>・患者様ご負担額は高額療養費制度等の適用前の概算です。</p>
              <p>・令和8年度（2026年度）診療報酬改定・令和6年度介護報酬改定に基づき算定しています。</p>
              {hasShoguKaizen && monthlyShoguKaizenYen > 0 && (
                <p>・処遇改善加算は「月の全訪問日の合計単位数 × 1.8%」を月末に1回算定しています（介護報酬改定第六期実績評価加算等に対応）。</p>
              )}
              {hasMedicalInfoLinkage && (
                <p>・訪問看護医療情報連携加算（1,000円/月）は、ICTを用いた多職種連携による計画的管理を行った場合に月1回算定できます（医療保険のみ）。</p>
              )}
            </div>
          </div>
        </div>
      </div>

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
  const handlePrint = () => {
    // 医療・精神科は9列あるため横向き印刷
    const isLandscape = selectedMode === "medical" || selectedMode === "psychiatric";
    if (isLandscape) {
      document.documentElement.classList.add('fee-table-print');
      document.body.classList.add('fee-table-print');
    }
    window.print();
    // 印刷ダイアログを閉じた後にクラスを削除
    setTimeout(() => {
      document.documentElement.classList.remove('fee-table-print');
      document.body.classList.remove('fee-table-print');
    }, 1000);
  };

  const modeLabels: Record<FeeTableMode, string> = {
    medical: "医療保険（訪問看護療養費）",
    care: "介護保険（訪問看護費）",
    preventive: "介護予防訪問看護費",
    psychiatric: "精神科訪問看護基本療養費",
  };

  return (
    <div id="print-root" className="fixed inset-0 z-50 bg-stone-800/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* ヘッダー（印刷非表示） */}
        <div className="no-print flex items-center justify-between px-4 py-3 border-b border-stone-200 shrink-0">
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

        {/* 種別タブ（印刷非表示） */}
        <div className="no-print flex border-b border-stone-200 shrink-0 overflow-x-auto">
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
          <div id="print-content" className="bg-white border border-stone-200 rounded-lg p-5 space-y-3 text-sm">
            {/* タイトル */}
            <div className="text-center border-b-2 border-stone-800 pb-2">
              <h1 className="text-base font-bold text-stone-900">訪問看護 利用料金表（{modeLabels[selectedMode]}）</h1>
              <p className="text-xs text-stone-500 mt-0.5">令和8年度（2026年度）診療報酬改定 準拠</p>
            </div>

            {/* 料金表本体 */}
            {selectedMode === "medical" && <MedicalFeeTable />}
            {selectedMode === "care" && <CareFeeTable />}
            {selectedMode === "preventive" && <PreventiveFeeTable />}
            {selectedMode === "psychiatric" && <PsychiatricFeeTable />}

            {/* 注意書き */}
            <div className="print-notice text-xs text-stone-500 border border-stone-200 rounded p-3 space-y-1">
              <p className="font-bold text-stone-700">【ご注意】</p>
              <p>・上記料金は令和8年度（2026年度）診療報酬改定・令和6年度介護報酬改定に基づく算定額です。</p>
              <p>・患者様のご負担額は、保険の種別・負担割合・公費負担医療の適用等により異なります。</p>
              <p>・加算の算定は、訪問時の状況・指示書の内容等により異なります。詳細はご相談ください。</p>
              {(selectedMode === "care" || selectedMode === "preventive") && (
                <p>・介護保険の単位数は地域区分単価（1単位＝10.00～10.90円）により円換算額が異なります。</p>
              )}
              {selectedMode === "psychiatric" && (
                <p>・自立支援医療（精神通院）適用の場合、月額自己負担上限額の管理が必要です。</p>
              )}
            </div>
          </div>
        </div>
      </div>

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
  // 1割・2割・3割を計算するヘルパー（5円未満切り捨て＝四捨五入5円単位）
  const c = (yen: number) => ({
    full: `${yen.toLocaleString()}円`,
    p10: `${Math.round(yen * 0.1 / 5) * 5}円`,
    p20: `${Math.round(yen * 0.2 / 5) * 5}円`,
    p30: `${Math.round(yen * 0.3 / 5) * 5}円`,
  });
  return (
    <div className="print-section space-y-3">
      <p className="text-xs text-stone-500">※ 自己負担額は5円未満切り捨て（四捨五入）。高額療養費・公費負担は別途適用されます。</p>

      <SectionTitle>訪問看護基本療養費Ⅰ（同一建物以外・従来型）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>職種</TableHeader>
            <TableHeader>週3日目まで</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>週4日目以降</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr>
            <TableCell>保健師・助産師・看護師</TableCell>
            <TableCell right>{c(5550).full}</TableCell><TableCell right className="text-blue-700">{c(5550).p10}</TableCell><TableCell right className="text-blue-700">{c(5550).p20}</TableCell><TableCell right className="text-blue-700">{c(5550).p30}</TableCell>
            <TableCell right>{c(6550).full}</TableCell><TableCell right className="text-blue-700">{c(6550).p10}</TableCell><TableCell right className="text-blue-700">{c(6550).p20}</TableCell><TableCell right className="text-blue-700">{c(6550).p30}</TableCell>
          </tr>
          <tr>
            <TableCell>准看護師</TableCell>
            <TableCell right>{c(5050).full}</TableCell><TableCell right className="text-blue-700">{c(5050).p10}</TableCell><TableCell right className="text-blue-700">{c(5050).p20}</TableCell><TableCell right className="text-blue-700">{c(5050).p30}</TableCell>
            <TableCell right>{c(6050).full}</TableCell><TableCell right className="text-blue-700">{c(6050).p10}</TableCell><TableCell right className="text-blue-700">{c(6050).p20}</TableCell><TableCell right className="text-blue-700">{c(6050).p30}</TableCell>
          </tr>
          <tr>
            <TableCell>理学療法士・作業療法士・言語聴覚士</TableCell>
            <TableCell right>{c(5550).full}</TableCell><TableCell right className="text-blue-700">{c(5550).p10}</TableCell><TableCell right className="text-blue-700">{c(5550).p20}</TableCell><TableCell right className="text-blue-700">{c(5550).p30}</TableCell>
            <TableCell right>{c(6550).full}</TableCell><TableCell right className="text-blue-700">{c(6550).p10}</TableCell><TableCell right className="text-blue-700">{c(6550).p20}</TableCell><TableCell right className="text-blue-700">{c(6550).p30}</TableCell>
          </tr>
          <tr>
            <TableCell>専門看護師（緩和ケア等）</TableCell>
            <TableCell right colSpan={4}>{c(12850).full}（週1回）</TableCell>
            <TableCell right className="text-blue-700">{c(12850).p10}</TableCell>
            <TableCell right className="text-blue-700">{c(12850).p20}</TableCell>
            <TableCell right className="text-blue-700">{c(12850).p30}</TableCell>
            <TableCell className="text-stone-400 text-xs">—</TableCell>
          </tr>
        </tbody>
      </table>

      <SectionTitle>訪問看護基本療養費Ⅱ（同一建物内・従来型）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>区分</TableHeader>
            <TableHeader>週3日目まで</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>週4日目以降</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr>
            <TableCell>同一建物2人（看護師等）</TableCell>
            <TableCell right>{c(5550).full}</TableCell><TableCell right className="text-blue-700">{c(5550).p10}</TableCell><TableCell right className="text-blue-700">{c(5550).p20}</TableCell><TableCell right className="text-blue-700">{c(5550).p30}</TableCell>
            <TableCell right>{c(6550).full}</TableCell><TableCell right className="text-blue-700">{c(6550).p10}</TableCell><TableCell right className="text-blue-700">{c(6550).p20}</TableCell><TableCell right className="text-blue-700">{c(6550).p30}</TableCell>
          </tr>
          <tr>
            <TableCell>同一建物3人以上（看護師等）</TableCell>
            <TableCell right>{c(2780).full}</TableCell><TableCell right className="text-blue-700">{c(2780).p10}</TableCell><TableCell right className="text-blue-700">{c(2780).p20}</TableCell><TableCell right className="text-blue-700">{c(2780).p30}</TableCell>
            <TableCell right>{c(3280).full}</TableCell><TableCell right className="text-blue-700">{c(3280).p10}</TableCell><TableCell right className="text-blue-700">{c(3280).p20}</TableCell><TableCell right className="text-blue-700">{c(3280).p30}</TableCell>
          </tr>
        </tbody>
      </table>

      <SectionTitle>包括型訪問看護療養費（訪問看護ステーション）</SectionTitle>
      <p className="text-xs text-stone-500 mb-1">※ 1日単位の包括評価。複数回・複数名・夜間加算は包括に含まれます。</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>20人未満</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>20〜49人</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>50人以上</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "30分以上60分未満", a: 7010, b: 6310, c2: 5960 },
            { label: "60分以上90分未満", a: 11010, b: 9910, c2: 9360 },
            { label: "90分以上", a: 14010, b: 13730, c2: 13450 },
            { label: "90分以上（特別）", a: 15510, b: 15200, c2: 14890 },
          ].map(r => (
            <tr key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell right>{c(r.a).full}</TableCell><TableCell right className="text-blue-700">{c(r.a).p10}</TableCell><TableCell right className="text-blue-700">{c(r.a).p20}</TableCell><TableCell right className="text-blue-700">{c(r.a).p30}</TableCell>
              <TableCell right>{c(r.b).full}</TableCell><TableCell right className="text-blue-700">{c(r.b).p10}</TableCell><TableCell right className="text-blue-700">{c(r.b).p20}</TableCell><TableCell right className="text-blue-700">{c(r.b).p30}</TableCell>
              <TableCell right>{c(r.c2).full}</TableCell><TableCell right className="text-blue-700">{c(r.c2).p10}</TableCell><TableCell right className="text-blue-700">{c(r.c2).p20}</TableCell><TableCell right className="text-blue-700">{c(r.c2).p30}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>訪問看護管理療養費</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>区分</TableHeader>
            <TableHeader>月初日</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>2日目以降</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "通常", a: 7710, b: 3010 },
            { label: "機能強化型1", a: 13760, b: 3010 },
            { label: "機能強化型2", a: 10460, b: 3010 },
            { label: "機能強化型3", a: 9030, b: 3010 },
            { label: "機能強化型4（新設）", a: 9030, b: 3010 },
          ].map(r => (
            <tr key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell right>{c(r.a).full}</TableCell><TableCell right className="text-blue-700">{c(r.a).p10}</TableCell><TableCell right className="text-blue-700">{c(r.a).p20}</TableCell><TableCell right className="text-blue-700">{c(r.a).p30}</TableCell>
              <TableCell right>{c(r.b).full}</TableCell><TableCell right className="text-blue-700">{c(r.b).p10}</TableCell><TableCell right className="text-blue-700">{c(r.b).p20}</TableCell><TableCell right className="text-blue-700">{c(r.b).p30}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>主な加算</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算名</TableHeader>
            <TableHeader>金額</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { name: "24時間対応体制加算 イ", yen: 6800, note: "月1回" },
            { name: "24時間対応体制加算 ロ", yen: 6520, note: "月1回" },
            { name: "特別管理加算（1）", yen: 5000, note: "月1回" },
            { name: "特別管理加算（2）", yen: 2500, note: "月1回" },
            { name: "難病等複数回訪問加算（1日2回）", yen: 4500, note: "1日2回訪問" },
            { name: "難病等複数回訪問加算（1日3回以上）", yen: 8000, note: "1日3回以上" },
            { name: "複数名訪問加算（看護師等）", yen: 4500, note: "2名同行訪問" },
            { name: "夜間・早朝訪問看護加算", yen: 2100, note: "18〜22時/6〜8時" },
            { name: "深夜訪問看護加算", yen: 4200, note: "22〜6時" },
            { name: "訪問看護ターミナルケア療養費1", yen: 25000, note: "在宅死亡月" },
            { name: "訪問看護ターミナルケア療養費2", yen: 10000, note: "特養等死亡月" },
            { name: "訪問看護ベースアップ評価料（Ⅰ）", yen: 100, note: "職員処遇改善/日" },
            { name: "訪問看護ベースアップ評価料（Ⅱ）", yen: 200, note: "ステーションのみ/日" },
          ].map(r => (
            <tr key={r.name}>
              <TableCell>{r.name}</TableCell>
              <TableCell right>{c(r.yen).full}</TableCell>
              <TableCell right className="text-blue-700">{c(r.yen).p10}</TableCell>
              <TableCell right className="text-blue-700">{c(r.yen).p20}</TableCell>
              <TableCell right className="text-blue-700">{c(r.yen).p30}</TableCell>
              <TableCell>{r.note}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>訪問看護物価対応料（令和8年6月〜新設）</SectionTitle>
      <p className="text-xs text-stone-500 mb-1">※ 訪問看護基本療養費Ⅰ・Ⅱ・Ⅲを算定する利用者に適用。</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>区分</TableHeader>
            <TableHeader>金額</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell className="font-medium text-blue-700">物価対応料1（月初日）</TableCell><TableCell right className="text-blue-700">60円</TableCell><TableCell>月の初回訪問日</TableCell></tr>
          <tr><TableCell className="font-medium text-blue-700">物価対応料1（2日目以降）</TableCell><TableCell right className="text-blue-700">20円</TableCell><TableCell>2回目以降の訪問日</TableCell></tr>
          <tr><TableCell className="text-stone-500 text-xs" colSpan={3}>※令和9年6月以降は月初日120円・2日目以降40円に引き上げ予定</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>訪問看護情報提供療養費</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>区分</TableHeader>
            <TableHeader>金額</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>情報提供療養費I</TableCell><TableCell right>1,500円</TableCell><TableCell>市区町村等への情報提供（月1回）</TableCell></tr>
          <tr><TableCell>情報提供療養費II</TableCell><TableCell right>1,500円</TableCell><TableCell>学校等への情報提供（年1回）</TableCell></tr>
          <tr><TableCell>情報提供療養費III</TableCell><TableCell right>1,500円</TableCell><TableCell>介護支援専門員等への情報提供（月1回）</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>訪問看護医療情報連携加算（令和8年6月〜新設）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算名</TableHeader>
            <TableHeader>金額</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr>
            <TableCell className="font-medium text-blue-700">訪問看護医療情報連携加算</TableCell>
            <TableCell right className="text-blue-700">1,000円</TableCell>
            <TableCell right className="text-emerald-700">100円</TableCell>
            <TableCell right className="text-emerald-700">200円</TableCell>
            <TableCell right className="text-emerald-700">300円</TableCell>
            <TableCell>月1回・ICT活用による多職種連携</TableCell>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CareFeeTable(){
  // 介護保険：切り上げなし（円単位切り捨て）
  const cu = (units: number) => ({
    units: `${units.toLocaleString()}単位`,
    full: `${(units * 10).toLocaleString()}円`,
    p10: `${Math.floor(units * 10 * 0.1)}円`,
    p20: `${Math.floor(units * 10 * 0.2)}円`,
    p30: `${Math.floor(units * 10 * 0.3)}円`,
  });
  return (
    <div className="print-section space-y-3">
      <p className="text-xs text-stone-500">※ 単位数は令和6年度改定後。目安金額は1単位＝10円換算。実際は地域区分単価により異なります。自己負担額は円単位切り捨て。</p>

      <SectionTitle>訪問看護費（訪問看護ステーション）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>目安金額</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "20分未満", u: 314 },
            { label: "30分未満", u: 471 },
            { label: "30分以上1時間未満", u: 823 },
            { label: "1時間以上1時間30分未満", u: 1128 },
            { label: "理学療法士等による訪問", u: 294 },
          ].map(r => (
            <tr key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell right>{cu(r.u).units}</TableCell>
              <TableCell right>{cu(r.u).full}</TableCell>
              <TableCell right className="text-teal-700">{cu(r.u).p10}</TableCell>
              <TableCell right className="text-teal-700">{cu(r.u).p20}</TableCell>
              <TableCell right className="text-teal-700">{cu(r.u).p30}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>訪問看護費（病院・診療所）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>目安金額</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "20分未満", u: 266 },
            { label: "30分未満", u: 399 },
            { label: "30分以上1時間未満", u: 574 },
            { label: "1時間以上1時間30分未満", u: 844 },
            { label: "理学療法士等による訪問", u: 266 },
          ].map(r => (
            <tr key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell right>{cu(r.u).units}</TableCell>
              <TableCell right>{cu(r.u).full}</TableCell>
              <TableCell right className="text-teal-700">{cu(r.u).p10}</TableCell>
              <TableCell right className="text-teal-700">{cu(r.u).p20}</TableCell>
              <TableCell right className="text-teal-700">{cu(r.u).p30}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>主な加算（単位数）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算名</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>目安金額</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { name: "緊急時訪問看護加算（Ⅰ）", u: 600, note: "月1回" },
            { name: "特別管理加算（1）", u: 500, note: "月1回" },
            { name: "特別管理加算（2）", u: 250, note: "月1回" },
            { name: "複数名訪問看護加算（Ⅰ）看護師等", u: 254, note: "1回" },
            { name: "ターミナルケア加算", u: 2500, note: "死亡月" },
            { name: "初回加算（Ⅱ）", u: 300, note: "月1回" },
          ].map(r => (
            <tr key={r.name}>
              <TableCell>{r.name}</TableCell>
              <TableCell right>{cu(r.u).units}</TableCell>
              <TableCell right>{cu(r.u).full}</TableCell>
              <TableCell right className="text-teal-700">{cu(r.u).p10}</TableCell>
              <TableCell right className="text-teal-700">{cu(r.u).p20}</TableCell>
              <TableCell right className="text-teal-700">{cu(r.u).p30}</TableCell>
              <TableCell>{r.note}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-stone-500">※ 夜間・早朝加算（所定単位数の25%）、深夜加算（50%）は訪問時間の単位数に応じて変動します。処遇改善加算（1.8%）は月単位で算定。</p>

      <SectionTitle>訪問看護処遇改善加算（介護保険）</SectionTitle>
      <p className="text-xs text-stone-500 mb-1">※ 月の合計単位数に加算率を乗じて算定。実際の加算単位数は月毎の合計単位数により異なります。</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算区分</TableHeader>
            <TableHeader>加算率</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { name: "訪問看護処遇改善加算（I）", rate: "1.8%", note: "月の合計単位数に対して算定。実効単位数に端数切り捨て" },
            { name: "訪問看護処遇改善加算（II）", rate: "0.9%", note: "病院・診療所の場合は割引あり" },
          ].map(r => (
            <tr key={r.name}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell right className="text-teal-700 font-bold">{r.rate}</TableCell>
              <TableCell>{r.note}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}

function PreventiveFeeTable() {
  // 介護予防：切り上げなし（円単位切り捨て）
  const cu = (units: number) => ({
    units: `${units.toLocaleString()}単位`,
    full: `${(units * 10).toLocaleString()}円`,
    p10: `${Math.floor(units * 10 * 0.1)}円`,
    p20: `${Math.floor(units * 10 * 0.2)}円`,
    p30: `${Math.floor(units * 10 * 0.3)}円`,
  });
  return (
    <div className="print-section space-y-3">
      <p className="text-xs text-stone-500">※ 要支援1・2の方が対象です。単位数は令和6年度改定後。目安金額は1単位＝10円換算。自己負担額は円単位切り捨て。</p>

      <SectionTitle>介護予防訪問看護費（訪問看護ステーション）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>目安金額</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "20分未満", u: 303 },
            { label: "30分未満", u: 451 },
            { label: "30分以上1時間未満", u: 794 },
            { label: "1時間以上1時間＀30分未満", u: 1087 },
            { label: "理学療法士等による訪問", u: 294 },
          ].map(r => (
            <tr key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell right>{cu(r.u).units}</TableCell>
              <TableCell right>{cu(r.u).full}</TableCell>
              <TableCell right className="text-emerald-700">{cu(r.u).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cu(r.u).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cu(r.u).p30}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>介護予防訪問看護費（病院・診療所）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>目安金額</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "20分未満", u: 266 },
            { label: "30分未満", u: 399 },
            { label: "30分以上1時間未満", u: 574 },
            { label: "1時間以上1時間＀30分未満", u: 844 },
            { label: "理学療法士等による訪問", u: 266 },
          ].map(r => (
            <tr key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell right>{cu(r.u).units}</TableCell>
              <TableCell right>{cu(r.u).full}</TableCell>
              <TableCell right className="text-emerald-700">{cu(r.u).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cu(r.u).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cu(r.u).p30}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>主な加算（単位数）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算名</TableHeader>
            <TableHeader>単位数</TableHeader>
            <TableHeader>目安金額</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { name: "緊急時訪問看護加算（Ⅰ）", u: 600, note: "月1回" },
            { name: "特別管理加算（1）", u: 500, note: "月1回" },
            { name: "特別管理加算（2）", u: 250, note: "月1回" },
            { name: "初回加算（Ⅰ）退院・施設退所後", u: 350, note: "月1回（新設）" },
            { name: "初回加算（Ⅱ）通常", u: 300, note: "月1回" },
            { name: "複数名訪問看護加算（Ⅰ）看護師等", u: 254, note: "1回" },
            { name: "複数名訪問看護加算（Ⅱ）その他", u: 201, note: "1回" },
            { name: "ターミナルケア加算", u: 2500, note: "死亡月" },
          ].map(r => (
            <tr key={r.name}>
              <TableCell>{r.name}</TableCell>
              <TableCell right>{cu(r.u).units}</TableCell>
              <TableCell right>{cu(r.u).full}</TableCell>
              <TableCell right className="text-emerald-700">{cu(r.u).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cu(r.u).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cu(r.u).p30}</TableCell>
              <TableCell>{r.note}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
       <p className="text-xs text-stone-500">※ 夜間・早朝加算（25%）、深夜加算（50%）は訪問時間の単位数に応じて変動。</p>

      <SectionTitle>訪問看護処遇改善加算（介護予防）</SectionTitle>
      <p className="text-xs text-stone-500 mb-1">※ 月の合計単位数に加算率を乗じて算定。実際の加算単位数は月毎の合計単位数により異なります。</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算区分</TableHeader>
            <TableHeader>加算率</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { name: "訪問看護処遇改善加算（I）", rate: "1.8%", note: "月の合計単位数に対して算定。実効単位数に端数切り捨て" },
            { name: "訪問看護処遇改善加算（II）", rate: "0.9%", note: "病院・診療所の場合は割引あり" },
          ].map(r => (
            <tr key={r.name}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell right className="text-teal-700 font-bold">{r.rate}</TableCell>
              <TableCell>{r.note}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}

function PsychiatricFeeTable() {
  // 医療保険は5円未満切り捨て（四捨五入5円単位）
  const cp = (yen: number) => ({
    full: `${yen.toLocaleString()}円`,
    p10: `${Math.round(yen * 0.1 / 5) * 5}円`,
    p20: `${Math.round(yen * 0.2 / 5) * 5}円`,
    p30: `${Math.round(yen * 0.3 / 5) * 5}円`,
  });
  return (
    <div className="print-section space-y-3">
      <p className="text-xs text-stone-500">※ 精神疾患を有する者に対する訪問看護。令和8年度（2026年度）改定後の点数。自己負担額は5円未満切り捨て（四捨五入）。</p>

      <SectionTitle>精神科訪問看護基本療養費Ⅰ（通常・同一建物１人）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>週３日目まで</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>週４日目以降</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "30分以上", w3: 5550, w4: 6550 },
            { label: "30分未満", w3: 4250, w4: 5100 },
          ].map(r => (
            <tr key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell right>{cp(r.w3).full}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w3).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w3).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w3).p30}</TableCell>
              <TableCell right>{cp(r.w4).full}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w4).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w4).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w4).p30}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>精神科訪問看護基本療養費Ⅱ（同一建物２人）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>週３日目まで</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>週４日目以降</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "30分以上", w3: 5550, w4: 6550 },
            { label: "30分未満", w3: 4250, w4: 5100 },
          ].map(r => (
            <tr key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell right>{cp(r.w3).full}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w3).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w3).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w3).p30}</TableCell>
              <TableCell right>{cp(r.w4).full}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w4).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w4).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w4).p30}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>精神科訪問看護基本療養費Ⅲ（同一建物３人以上）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>訪問時間</TableHeader>
            <TableHeader>週３日目まで</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>週４日目以降</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "30分以上", w3: 2780, w4: 3280 },
            { label: "30分未満", w3: 2130, w4: 2550 },
          ].map(r => (
            <tr key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell right>{cp(r.w3).full}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w3).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w3).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w3).p30}</TableCell>
              <TableCell right>{cp(r.w4).full}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w4).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w4).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.w4).p30}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>精神科訪問看護基本療養費Ⅳ（外泊中）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>区分</TableHeader>
            <TableHeader>金額</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr>
            <TableCell>外泊中の訪問（週１回）</TableCell>
            <TableCell right>8,500円</TableCell>
            <TableCell right className="text-emerald-700">{cp(8500).p10}</TableCell>
            <TableCell right className="text-emerald-700">{cp(8500).p20}</TableCell>
            <TableCell right className="text-emerald-700">{cp(8500).p30}</TableCell>
          </tr>
        </tbody>
      </table>

      <SectionTitle>訪問看護管理療養費</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>区分</TableHeader>
            <TableHeader>月初日</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>2日目以降</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { label: "通常", first: 7710, sub: 3010 },
            { label: "機能強化型1", first: 13760, sub: 3010 },
            { label: "機能強化型2", first: 10460, sub: 3010 },
            { label: "機能強化型3・4", first: 9030, sub: 3010 },
          ].map(r => (
            <tr key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell right>{cp(r.first).full}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.first).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.first).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.first).p30}</TableCell>
              <TableCell right>{cp(r.sub).full}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.sub).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.sub).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.sub).p30}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>主な加算</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算名</TableHeader>
            <TableHeader>金額</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          {[
            { name: "精神科緊急訪問看護加算", y: 2650, note: "定期外緊急訪問" },
            { name: "長時間精神科訪問看護加算", y: 5200, note: "週１回（条件下週３回）" },
            { name: "複数名精神科訪問看護加算（看護師等）", y: 4500, note: "2名同行" },
            { name: "複数名精神科訪問看護加算（看護補助者）", y: 3000, note: "週１回まで" },
            { name: "精神科複数回訪問加算（1日２回）", y: 4500, note: "厚生労働大臣が定める状態" },
            { name: "精神科複数回訪問加算（1日３回以上）", y: 8000, note: "特別訪問看護指示書" },
            { name: "夜間・早朝訪問看護加算", y: 2100, note: "18〜22時/6〜8時" },
            { name: "深夜訪問看護加算", y: 4200, note: "22〜6時" },
            { name: "24時間対応体制加算 イ", y: 6800, note: "月１回" },
            { name: "24時間対応体制加算 ロ", y: 6520, note: "月１回" },
            { name: "特別管理加算（１）", y: 5000, note: "月１回" },
            { name: "特別管理加算（２）", y: 2500, note: "月１回" },
            { name: "訪問看護ターミナルケア療養費1", y: 25000, note: "在宅死亡月" },
            { name: "訪問看護ターミナルケア療養費2", y: 10000, note: "特養等死亡月" },
          ].map(r => (
            <tr key={r.name}>
              <TableCell>{r.name}</TableCell>
              <TableCell right>{cp(r.y).full}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.y).p10}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.y).p20}</TableCell>
              <TableCell right className="text-emerald-700">{cp(r.y).p30}</TableCell>
              <TableCell>{r.note}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>精神科訪問看護情報提供療養費</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>区分</TableHeader>
            <TableHeader>金額</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell>情報提供療養費Ⅰ</TableCell><TableCell right>1,500円</TableCell><TableCell>市区町村等への情報提供（月1回）</TableCell></tr>
          <tr><TableCell>情報提供療養費Ⅱ</TableCell><TableCell right>1,500円</TableCell><TableCell>学校等への情報提供（年1回）</TableCell></tr>
          <tr><TableCell>情報提供療養費Ⅲ</TableCell><TableCell right>1,500円</TableCell><TableCell>介護支援専門員等への情報提供（月1回）</TableCell></tr>
        </tbody>
      </table>
      <SectionTitle>訪問看護物価対応料（令和8年6月〜新設）</SectionTitle>
      <p className="text-xs text-stone-500 mb-1">※ 精神科訪問看護基本療養費を算定する利用者は物価対応料2を、訪問看護基本療養費I・II・IIIも合わせて算定する場合は物価対応料1も加算。</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>区分</TableHeader>
            <TableHeader>金額</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr><TableCell className="font-medium text-blue-700">物価対応料1（月初日）</TableCell><TableCell right className="text-blue-700">60円</TableCell><TableCell>月の初回訪問日（基本療養費I・II・III算定時）</TableCell></tr>
          <tr><TableCell className="font-medium text-blue-700">物価対応料1（2日目以降）</TableCell><TableCell right className="text-blue-700">20円/日</TableCell><TableCell>2回目以降の訪問日（基本療養費I・II・III算定時）</TableCell></tr>
          <tr><TableCell className="font-medium text-blue-700">物価対応料2</TableCell><TableCell right className="text-blue-700">20円/日</TableCell><TableCell>1日につき算定（基本療養費IV算定時）</TableCell></tr>
          <tr><TableCell className="text-stone-500 text-xs" colSpan={3}>※令和9年6月以降：物価対応料1は月初日120円・2日目以降40円、物価対応料2は40円/日に引き上げ予定</TableCell></tr>
        </tbody>
      </table>

      <SectionTitle>訪問看護医療情報連携加算（令和8年6月〜新設）</SectionTitle>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <TableHeader>加算名</TableHeader>
            <TableHeader>金額</TableHeader>
            <TableHeader>1割</TableHeader>
            <TableHeader>2割</TableHeader>
            <TableHeader>3割</TableHeader>
            <TableHeader>算定要件</TableHeader>
          </tr>
        </thead>
        <tbody>
          <tr>
            <TableCell className="font-medium text-blue-700">訪問看護医療情報連携加算</TableCell>
            <TableCell right className="text-blue-700">1,000円</TableCell>
            <TableCell right className="text-emerald-700">100円</TableCell>
            <TableCell right className="text-emerald-700">200円</TableCell>
            <TableCell right className="text-emerald-700">300円</TableCell>
            <TableCell>月1回・ICT活用による多職種連携</TableCell>
          </tr>
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
// ステップインジケーター
// ============================================================
const STEP_LABELS = [
  { step: 1, label: "種別選択" },
  { step: 2, label: "算定条件" },
  { step: 3, label: "負担割合" },
  { step: 4, label: "カレンダー" },
] as const;

function StepIndicator({ currentStep, onStepClick }: { currentStep: number; onStepClick: (step: 1|2|3|4) => void }) {
  return (
    <div className="flex items-center justify-between px-2 py-2">
      {STEP_LABELS.map(({ step, label }, idx) => {
        const isDone = currentStep > step;
        const isActive = currentStep === step;
        return (
          <div key={step} className="flex items-center flex-1">
            <button
              onClick={() => isDone || isActive ? onStepClick(step as 1|2|3|4) : undefined}
              disabled={!isDone && !isActive}
              className={cn(
                "flex flex-col items-center gap-0.5 flex-1 transition-all",
                (isDone || isActive) ? "cursor-pointer" : "cursor-default opacity-40"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                isDone ? "bg-amber-600 border-amber-600 text-white" :
                isActive ? "bg-white border-amber-600 text-amber-600" :
                "bg-white border-stone-300 text-stone-400"
              )}>
                {isDone ? <CheckIcon className="w-3.5 h-3.5" /> : step}
              </div>
              <span className={cn(
                "text-[10px] font-medium",
                isActive ? "text-amber-700" : isDone ? "text-amber-600" : "text-stone-400"
              )}>{label}</span>
            </button>
            {idx < STEP_LABELS.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 mx-1 rounded transition-all",
                currentStep > step ? "bg-amber-500" : "bg-stone-200"
              )} />
            )}
          </div>
        );
      })}
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
  const modeConf = MODE_CONFIG[store.globalInsuranceMode];

  // ステップ別コンテンツ
  const renderStepContent = () => {
    // Step 1: 種別選択
    if (store.homeStep === 1) {
      return (
        <div className="p-4 space-y-4">
          <div className="text-center mb-2">
            <p className="text-sm text-stone-500">保険種別を選んでください</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {(["medical", "care", "preventive", "psychiatric"] as InsuranceMode[]).map((m) => {
              const conf = MODE_CONFIG[m];
              const isActive = store.globalInsuranceMode === m;
              return (
                <button
                  key={m}
                  onClick={() => {
                    store.setGlobalInsuranceMode(m);
                    store.setHomeStep(2);
                  }}
                  className={cn(
                    "w-full py-4 px-5 rounded-2xl font-bold text-base flex items-center gap-4 transition-all shadow-sm active:scale-95",
                    isActive
                      ? `${conf.color} text-white shadow-md ring-2 ring-offset-2 ring-amber-400`
                      : "bg-white border-2 border-stone-200 text-stone-700 hover:border-amber-300 hover:bg-amber-50"
                  )}
                >
                  <span className={cn("w-8 h-8 shrink-0", isActive ? "text-white" : "text-stone-400")}>
                    {conf.icon}
                  </span>
                  <div className="text-left">
                    <div className="font-bold">{conf.label}</div>
                    <div className={cn("text-xs font-normal mt-0.5", isActive ? "text-white/80" : "text-stone-400")}>
                      {m === "medical" && "訪問看護基本療養費・管理療養費"}
                      {m === "care" && "訪問看護費（要介護認定）"}
                      {m === "preventive" && "介護予防訪問看護費（要支援1・2）"}
                      {m === "psychiatric" && "精神科訪問看護基本療養費"}
                    </div>
                  </div>
                  <ArrowRightIcon className={cn("w-5 h-5 ml-auto shrink-0", isActive ? "text-white" : "text-stone-300")} />
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // Step 2: 算定条件
    if (store.homeStep === 2) {
      return (
        <div className="p-4 space-y-4">
          <div className={cn("rounded-xl p-3 flex items-center gap-2", modeConf.bgColor, modeConf.borderColor, "border")}>
            <span className={cn("w-5 h-5", modeConf.badgeText)}>{modeConf.icon}</span>
            <span className={cn("text-sm font-bold", modeConf.badgeText)}>{modeConf.label}の算定条件を設定してください</span>
          </div>

          {store.globalInsuranceMode === "medical" && (
            <MedicalForm
              input={store.globalMedicalInput}
              onChange={(partial) => store.setGlobalMedicalInput(prev => ({ ...prev, ...partial }))}
              baseupType={store.globalMedicalBaseupType}
              onBaseupTypeChange={(v) => store.setGlobalMedicalBaseupType(v)}
            />
          )}
          {store.globalInsuranceMode === "care" && (
            <>
              <CareForm
                input={store.globalCareInput}
                onChange={(partial) => store.setGlobalCareInput(prev => ({ ...prev, ...partial }))}
              />
              {/* 処遇改善加算（月合計単位数から計算） */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0"
                    checked={store.globalApplyShoguKaizen}
                    onChange={(e) => store.setGlobalApplyShoguKaizen(e.target.checked)}
                  />
                  <div>
                    <div className="text-sm font-bold text-emerald-800">処遇改善加算を適用する</div>
                    <div className="text-xs text-emerald-700 mt-0.5">月の合計単位数 × 1.8%を月末に1回算定。全訪問日に一括適用されます。</div>
                  </div>
                </label>
              </div>
            </>
          )}
          {store.globalInsuranceMode === "preventive" && (
            <>
              <PreventiveCareForm
                input={store.globalPreventiveCareInput}
                onChange={(partial) => store.setGlobalPreventiveCareInput(prev => ({ ...prev, ...partial }))}
              />
              {/* 処遇改善加算（月合計単位数から計算） */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 w-4 h-4 accent-emerald-600 shrink-0"
                    checked={store.globalApplyShoguKaizen}
                    onChange={(e) => store.setGlobalApplyShoguKaizen(e.target.checked)}
                  />
                  <div>
                    <div className="text-sm font-bold text-emerald-800">処遇改善加算を適用する</div>
                    <div className="text-xs text-emerald-700 mt-0.5">月の合計単位数 × 1.8%を月末に1回算定。全訪問日に一括適用されます。</div>
                  </div>
                </label>
              </div>
            </>
          )}
          {store.globalInsuranceMode === "psychiatric" && (
            <PsychiatricForm
              input={store.globalPsychInput}
              onChange={(partial) => store.setGlobalPsychInput(prev => ({ ...prev, ...partial }))}
              baseupType={store.globalMedicalBaseupType}
              onBaseupTypeChange={(v) => store.setGlobalMedicalBaseupType(v)}
            />
          )}

          <div className="pb-24" />
        </div>
      );
    }

    // Step 3: 負担割合
    if (store.homeStep === 3) {
      return (
        <div className="p-4 space-y-4">
          <div className={cn("rounded-xl p-3 flex items-center gap-2", modeConf.bgColor, modeConf.borderColor, "border")}>
            <span className={cn("w-5 h-5", modeConf.badgeText)}>{modeConf.icon}</span>
            <span className={cn("text-sm font-bold", modeConf.badgeText)}>負担割合を入力してください</span>
          </div>
          <CopayForm
            input={store.globalCopayInput}
            onChange={(partial) => {
              const updated = { ...store.globalCopayInput, ...partial };
              store.setGlobalCopayInput(updated);
              // 全訪問日の負担入力も同時更新
              store.updateCopayForAll(updated);
            }}
            insuranceMode={store.globalInsuranceMode}
          />
          <div className="pb-24" />
        </div>
      );
    }

    // Step 4: カレンダー
    return (
      <div className="p-4 space-y-4">
        {/* 設定サマリー */}
        <div className={cn("rounded-xl p-3 border", modeConf.bgColor, modeConf.borderColor)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn("w-4 h-4", modeConf.badgeText)}>{modeConf.icon}</span>
              <span className={cn("text-sm font-bold", modeConf.badgeText)}>{modeConf.label}</span>
            </div>
            <button
              onClick={() => store.setHomeStep(1)}
              className="text-xs text-stone-500 hover:text-amber-700 px-2 py-1 rounded hover:bg-white transition-colors"
            >
              変更
            </button>
          </div>
          <div className="mt-1.5 text-xs text-stone-500 flex flex-wrap gap-x-3 gap-y-0.5">
            {store.globalInsuranceMode === "medical" && (
              <>
                <span>訪問形態: {store.globalMedicalInput.isSameBuilding ? "同一建物" : "同一建物以外"}</span>
                <span>負担: {store.globalCopayInput.copayRatio}割</span>
              </>
            )}
            {(store.globalInsuranceMode === "care" || store.globalInsuranceMode === "preventive") && (
              <>
                <span>提供体: {store.globalCareInput.providerType === "station" ? "ステーション" : "病院"}</span>
                <span>負担: {store.globalCopayInput.careCopayRatio}割</span>
              </>
            )}
            {store.globalInsuranceMode === "psychiatric" && (
              <span>負担: {store.globalCopayInput.copayRatio}割</span>
            )}
          </div>
        </div>

        {/* 月ナビゲーション */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-stone-200 px-4 py-2">
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

        {/* 訪問済み日をタップするとVisitDetailPanelが直接開く（クイック情報パネルは不要） */}

        {/* 凡例 */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500 justify-center">
          {(["medical", "care", "preventive", "psychiatric"] as InsuranceMode[]).map(m => (
            <div key={m} className="flex items-center gap-1">
              <div className={cn("w-3 h-3 rounded", MODE_CONFIG[m].color)} />
              <span>{MODE_CONFIG[m].label}</span>
            </div>
          ))}
        </div>

        <div className="pb-24" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col max-w-lg mx-auto">
      {/* ヘッダー */}
      <header className="bg-white border-b border-stone-200 px-4 pt-3 pb-1 shrink-0 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-1">
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

        {/* ステップインジケーター */}
        <StepIndicator
          currentStep={store.homeStep}
          onStepClick={store.setHomeStep}
        />
      </header>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {renderStepContent()}
      </div>

      {/* ステップナビゲーションボタン（固定フッター） */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 pb-4 pt-2 bg-gradient-to-t from-stone-100 to-transparent z-20">
        {/* Step 4: 月次集計ボタン */}
        {store.homeStep === 4 && store.monthlyResults.length > 0 && (
          <button
            onClick={() => setShowPrint(true)}
            className="w-full py-4 bg-amber-600 text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all mb-2"
          >
            <ClipboardListIcon className="w-5 h-5" />
            月次集計を確認する（{store.monthlyResults.length}回 / {formatYen(store.totalAmount)}）
          </button>
        )}

        {/* Step 1、3: 次へ進むボタン */}
        {store.homeStep < 4 && (
          <button
            onClick={() => store.setHomeStep((store.homeStep + 1) as 1|2|3|4)}
            className={cn(
              "w-full py-4 rounded-2xl font-bold text-white text-base flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all mb-2",
              modeConf.color
            )}
          >
            {store.homeStep === 1 && <>種別を選んで次へ<ArrowRightIcon className="w-5 h-5" /></>}
            {store.homeStep === 2 && <>算定条件を確認して次へ<ArrowRightIcon className="w-5 h-5" /></>}
            {store.homeStep === 3 && <>負担割合を確認してカレンダーへ<ArrowRightIcon className="w-5 h-5" /></>}
          </button>
        )}

        {/* リセットボタン */}
        <button
          onClick={() => {
            if (window.confirm("全データをリセットします。この操作は元に戻せません。よろしいですか？")) {
              store.clearAll();
            }
          }}
          className="w-full py-2.5 bg-white text-stone-500 border border-stone-300 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all active:scale-95 shadow-sm"
        >
          <XIcon className="w-4 h-4" />
          全データをリセット
        </button>
      </div>

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
