/**
 * 訪問看護療養費計算アプリ - メインページ
 * Design: ウォームアンバー・プロフェッショナル
 * - テラコッタ/アンバーオレンジをプライマリカラー
 * - カレンダーで訪問日を選択して月次集計
 * - 医療保険・介護保険の両対応
 * - 患者負担額計算・印刷機能付き
 */

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useVisitStore } from "@/hooks/useVisitStore";
import type { InsuranceMode } from "@/hooks/useVisitStore";
import {
  calculate,
  calculateCare,
  calcCopay,
  formatYen,
  CARE_REGION_OPTIONS,
} from "@/lib/calcEngine";
import MedicalForm from "@/components/MedicalForm";
import CareForm from "@/components/CareForm";
import CopayForm from "@/components/CopayForm";
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
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// ============================================================
// カレンダーコンポーネント
// ============================================================
interface CalendarProps {
  year: number;
  month: number;
  visitDates: Set<string>;
  selectedDate: string | null;
  onToggle: (date: string) => void;
  onSelect: (date: string) => void;
}

function Calendar({ year, month, visitDates, selectedDate, onToggle, onSelect }: CalendarProps) {
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=日
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
                  {isVisit && (
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

  // リアルタイム計算
  let total = 0;
  let totalYen = 0;
  let copayAmount = 0;
  let copayNote = "";
  let resultItems: { label: string; amount: number; unit?: string; note?: string; disabled?: boolean }[] = [];
  let warnings: string[] = [];

  if (visitDay.insuranceMode === "medical") {
    const result = calculate(visitDay.medicalInput);
    total = result.total;
    totalYen = result.total;
    resultItems = result.items;
    warnings = result.warnings;
    const copay = calcCopay(result.total, visitDay.copayInput);
    copayAmount = copay.amount;
    copayNote = copay.note;
  } else {
    const result = calculateCare(visitDay.careInput);
    total = result.totalUnit ?? 0;
    totalYen = result.totalYen ?? 0;
    resultItems = result.items;
    warnings = result.warnings;
    const copay = calcCopay(totalYen, { ...visitDay.copayInput, insuranceType: "care" });
    copayAmount = copay.amount;
    copayNote = copay.note;
  }

  const rateNum = parseFloat(visitDay.careInput.regionRate);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* ヘッダー */}
      <div className="bg-amber-600 text-white px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onClose} className="p-1 rounded-full hover:bg-amber-700 transition-colors">
          <XIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="font-bold text-base">{dateLabel}（{dow}）</div>
          <div className="text-xs text-amber-100">訪問算定条件の設定</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-amber-100">合計</div>
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
          <button
            onClick={() => setShowAutoCopyBanner(false)}
            className="text-green-500 hover:text-green-700 p-1"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 保険種別切替 */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex gap-2 shrink-0">
        <button
          onClick={() => store.updateVisitDay(dateStr, { insuranceMode: "medical" })}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
            visitDay.insuranceMode === "medical"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-white text-stone-600 border border-stone-200 hover:border-amber-400"
          )}
        >医療保険</button>
        <button
          onClick={() => store.updateVisitDay(dateStr, { insuranceMode: "care" })}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
            visitDay.insuranceMode === "care"
              ? "bg-teal-600 text-white shadow-sm"
              : "bg-white text-stone-600 border border-stone-200 hover:border-teal-400"
          )}
        >介護保険</button>
      </div>

      {/* タブ */}
      <div className="border-b border-stone-200 flex shrink-0">
        <button
          onClick={() => setActiveTab("calc")}
          className={cn(
            "flex-1 py-2.5 text-sm font-medium transition-colors",
            activeTab === "calc"
              ? "border-b-2 border-amber-600 text-amber-700"
              : "text-stone-500 hover:text-stone-700"
          )}
        >算定条件</button>
        <button
          onClick={() => setActiveTab("copay")}
          className={cn(
            "flex-1 py-2.5 text-sm font-medium transition-colors",
            activeTab === "copay"
              ? "border-b-2 border-amber-600 text-amber-700"
              : "text-stone-500 hover:text-stone-700"
          )}
        >患者負担</button>
        {/* 前回の条件をコピーボタン */}
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
            {visitDay.insuranceMode === "medical" ? (
              <MedicalForm
                input={visitDay.medicalInput}
                onChange={(updates) => store.updateVisitDay(dateStr, {
                  medicalInput: { ...visitDay.medicalInput, ...updates }
                })}
              />
            ) : (
              <CareForm
                input={visitDay.careInput}
                onChange={(updates) => store.updateVisitDay(dateStr, {
                  careInput: { ...visitDay.careInput, ...updates }
                })}
              />
            )}
          </div>
        ) : (
          <div className="p-4">
            <CopayForm
              input={visitDay.copayInput}
              insuranceMode={visitDay.insuranceMode}
              onChange={(updates) => store.updateVisitDay(dateStr, {
                copayInput: { ...visitDay.copayInput, ...updates }
              })}
            />
          </div>
        )}
      </div>

      {/* 計算結果フッター */}
      <div className="border-t border-stone-200 bg-stone-50 shrink-0">
        <div className="px-4 py-3">
          {/* 警告 */}
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
          {/* 内訳 */}
          <div className="space-y-1 mb-3">
            {resultItems.map((item, i) => (
              <div key={i} className={cn(
                "flex items-center justify-between text-xs",
                item.disabled ? "opacity-40 line-through" : ""
              )}>
                <span className="text-stone-600 flex-1 pr-2">{item.label}</span>
                <span className={cn("font-medium shrink-0", item.disabled ? "text-stone-400" : "text-stone-800")}>
                  {visitDay.insuranceMode === "care"
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
              {visitDay.insuranceMode === "care" && (
                <div className="text-xs text-stone-400">{total.toLocaleString()}単位 × {rateNum}円</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-amber-700">{formatYen(totalYen)}</div>
              {visitDay.insuranceMode === "medical" && (
                <div className="text-xs text-stone-400">{Math.round(totalYen / 10)}点</div>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
            <div>
              <div className="text-xs text-stone-500">患者自己負担（概算）</div>
              <div className="text-xs text-stone-400">{copayNote}</div>
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
      {/* 月次サマリー */}
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

      {/* 訪問日一覧 */}
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
            return (
              <button
                key={r.id}
                onClick={() => onSelectDate(r.date)}
                className="w-full flex items-center gap-3 p-3 bg-white rounded-lg border border-stone-200 hover:border-amber-300 hover:bg-amber-50 transition-all text-left"
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 text-white",
                  r.insuranceMode === "medical" ? "bg-amber-500" : "bg-teal-500"
                )}>
                  <span className="text-xs font-bold leading-none">{m}/{d}</span>
                  <span className="text-xs opacity-80">{dow}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded font-medium",
                      r.insuranceMode === "medical"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-teal-100 text-teal-700"
                    )}>
                      {r.insuranceMode === "medical" ? "医療" : "介護"}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5 truncate">
                    {r.insuranceMode === "medical"
                      ? r.medicalInput.mode === "comprehensive" ? "包括型" : "従来型"
                      : `${r.careInput.providerType === "station" ? "ステーション" : "病院"}`}
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
// 印刷プレビュー
// ============================================================
interface PrintPreviewProps {
  store: ReturnType<typeof useVisitStore>;
  onClose: () => void;
}

function PrintPreview({ store, onClose }: PrintPreviewProps) {
  const { year, month, monthlyResults, totalAmount, totalCopay, patientName, stationName } = store;
  const printDate = new Date().toLocaleDateString("ja-JP");

  const handlePrint = () => window.print();

  return (
    <div id="print-root" className="fixed inset-0 z-50 bg-stone-800/80 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col print:shadow-none print:rounded-none print:max-h-none print:w-full print:max-w-none">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 shrink-0">
          <h2 className="font-bold text-stone-800">印刷プレビュー</h2>
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

        {/* プレビュー */}
        <div className="flex-1 overflow-y-auto p-4">
          <div id="print-content" className="bg-white border border-stone-200 rounded-lg p-6 space-y-4 text-sm">
            {/* タイトル */}
            <div className="text-center border-b-2 border-stone-800 pb-3">
              <h1 className="text-lg font-bold text-stone-900">訪問看護 料金概算のお知らせ</h1>
              <p className="text-xs text-stone-500 mt-1">令和8年度（2026年度）診療報酬改定 準拠</p>
            </div>

            {/* 基本情報 */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-stone-500">ご利用者様：</span>
                <span className="font-bold ml-1">{patientName || "　　　　　　　　　"} 様</span>
              </div>
              <div>
                <span className="text-stone-500">算定月：</span>
                <span className="font-bold ml-1">{year}年{month}月</span>
              </div>
              <div>
                <span className="text-stone-500">事業所名：</span>
                <span className="font-bold ml-1">{stationName || "　　　　　　　　　"}</span>
              </div>
              <div>
                <span className="text-stone-500">発行日：</span>
                <span className="font-bold ml-1">{printDate}</span>
              </div>
            </div>

            <Separator />

            {/* 月次サマリー */}
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

            {/* 訪問日別内訳 */}
            <div>
              <h3 className="font-bold text-stone-800 mb-2">訪問日別内訳</h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100">
                    <th className="border border-stone-300 px-2 py-1.5 text-left font-bold">訪問日</th>
                    <th className="border border-stone-300 px-2 py-1.5 text-left font-bold">保険</th>
                    <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">金額</th>
                    <th className="border border-stone-300 px-2 py-1.5 text-right font-bold">ご負担額</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyResults.map((r) => {
                    const [y, m, d] = r.date.split("-").map(Number);
                    const weekdays = ["日","月","火","水","木","金","土"];
                    const dow = weekdays[new Date(y, m - 1, d).getDay()];
                    return (
                      <tr key={r.id} className="hover:bg-stone-50">
                        <td className="border border-stone-300 px-2 py-1.5">{m}/{d}（{dow}）</td>
                        <td className="border border-stone-300 px-2 py-1.5">
                          {r.insuranceMode === "medical" ? "医療保険" : "介護保険"}
                        </td>
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

            {/* 注意書き */}
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

      {/* 印刷用スタイル */}
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
// メインページ
// ============================================================
export default function Home() {
  const store = useVisitStore();
  const [showPrint, setShowPrint] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<"calendar" | "summary">("calendar");

  const visitDates = useMemo(
    () => new Set(store.currentMonthVisits.map((v) => v.date)),
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
        <button
          onClick={store.prevMonth}
          className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
        >
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
        <button
          onClick={store.nextMonth}
          className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
        >
          <ChevronRightIcon className="w-5 h-5 text-stone-600" />
        </button>
      </div>

      {/* メインタブ */}
      <div className="bg-white border-b border-stone-200 flex shrink-0">
        <button
          onClick={() => setActiveMainTab("calendar")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
            activeMainTab === "calendar"
              ? "border-b-2 border-amber-600 text-amber-700"
              : "text-stone-500 hover:text-stone-700"
          )}
        >
          <CalendarDaysIcon className="w-4 h-4" />
          カレンダー
        </button>
        <button
          onClick={() => setActiveMainTab("summary")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
            activeMainTab === "summary"
              ? "border-b-2 border-amber-600 text-amber-700"
              : "text-stone-500 hover:text-stone-700"
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
              <div className="text-xs text-stone-500 mb-2">新規訪問日のデフォルト保険種別</div>
              <div className="flex gap-2">
                <button
                  onClick={() => store.setGlobalInsuranceMode("medical")}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    store.globalInsuranceMode === "medical"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  )}
                >医療保険</button>
                <button
                  onClick={() => store.setGlobalInsuranceMode("care")}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-bold transition-all",
                    store.globalInsuranceMode === "care"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  )}
                >介護保険</button>
              </div>
            </div>

            {/* カレンダー */}
            <div className="bg-white rounded-xl border border-stone-200 p-4">
              <Calendar
                year={store.year}
                month={store.month}
                visitDates={visitDates}
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
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded font-medium",
                      selectedVisitDay.insuranceMode === "medical"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-teal-100 text-teal-700"
                    )}>
                      {selectedVisitDay.insuranceMode === "medical" ? "医療保険" : "介護保険"}
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

      {/* 訪問日詳細パネル（フルスクリーンオーバーレイ） */}
      {store.selectedDate && selectedVisitDay && (
        <VisitDetailPanel
          dateStr={store.selectedDate}
          store={store}
          onClose={() => store.setSelectedDate(null)}
        />
      )}

      {/* 印刷プレビュー */}
      {showPrint && (
        <PrintPreview store={store} onClose={() => setShowPrint(false)} />
      )}
    </div>
  );
}
