/**
 * 精神科訪問看護 算定フォーム
 * Design: ウォームアンバー・プロフェッショナル
 * - 精神科基本療養費Ⅰ〜Ⅳ
 * - 各種加算（緊急・長時間・夜間・複数名・複数回）
 * - 自立支援医療の月額上限管理
 */

import type { PsychCalcInput, SeishinCopayTracker, ManagementFeeType, BukkaTaiouType, MedicalBaseupType } from "@/lib/calcEngine";
import { cn } from "@/lib/utils";

interface PsychiatricFormProps {
  input: PsychCalcInput;
  onChange: (updates: Partial<PsychCalcInput>) => void;
  baseupType?: MedicalBaseupType;
  onBaseupTypeChange?: (v: MedicalBaseupType) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold text-stone-500 uppercase tracking-wide border-b border-stone-200 pb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  note,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  note?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn(
      "flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors",
      checked ? "bg-purple-50 border border-purple-200" : "bg-stone-50 border border-stone-100",
      disabled && "opacity-40 cursor-not-allowed"
    )}>
      <div>
        <div className="text-sm font-medium text-stone-800">{label}</div>
        {note && <div className="text-xs text-stone-500">{note}</div>}
      </div>
      <div
        className={cn(
          "w-10 h-5 rounded-full transition-colors relative shrink-0",
          checked ? "bg-purple-600" : "bg-stone-300"
        )}
        onClick={() => !disabled && onChange(!checked)}
      >
        <div className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )} />
      </div>
    </label>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-stone-50 rounded-lg border border-stone-100">
      <span className="text-sm text-stone-700 font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-stone-200 rounded-md px-2 py-1 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-purple-400 max-w-[180px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function PsychiatricForm({ input, onChange, baseupType = "none", onBaseupTypeChange }: PsychiatricFormProps) {
  const isType4 = input.basicFeeType === "type4";

  return (
    <div className="space-y-4">
      {/* 基本療養費区分 */}
      <Section title="精神科基本療養費">
        <SelectRow
          label="基本療養費の区分"
          value={input.basicFeeType}
          onChange={(v) => onChange({ basicFeeType: v as PsychCalcInput["basicFeeType"] })}
          options={[
            { value: "type1", label: "Ⅰ 通常（同一建物1人）" },
            { value: "type2", label: "Ⅱ 同一建物2人" },
            { value: "type3", label: "Ⅲ 同一建物3人以上" },
            { value: "type4", label: "Ⅳ 外泊中の訪問（8,500円）" },
          ]}
        />

        {!isType4 && (
          <>
            <SelectRow
              label="訪問時間"
              value={input.visitDuration}
              onChange={(v) => onChange({ visitDuration: v as PsychCalcInput["visitDuration"] })}
              options={[
                { value: "over30", label: "30分以上" },
                { value: "under30", label: "30分未満" },
              ]}
            />
            <SelectRow
              label="週の訪問日数"
              value={input.weeklyVisitDay}
              onChange={(v) => onChange({ weeklyVisitDay: v as "1-3" | "4+" })}
              options={[
                { value: "1-3", label: "週3日目まで" },
                { value: "4+", label: "週4日目以降" },
              ]}
            />
          </>
        )}
      </Section>

      {/* 管理療養費 */}
      <Section title="訪問看護管理療養費">
        <ToggleRow
          label="月の初日の訪問"
          checked={input.isFirstVisitOfMonth}
          onChange={(v) => onChange({ isFirstVisitOfMonth: v })}
          note="月初日は管理療養費（月初日）を算定"
        />
        {input.isFirstVisitOfMonth ? (
          <SelectRow
            label="管理療養費の種別"
            value={input.managementFeeType}
            onChange={(v) => onChange({ managementFeeType: v as ManagementFeeType })}
            options={[
              { value: "standard", label: "通常 7,710円" },
              { value: "kinoka1", label: "機能強化型1 13,760円" },
              { value: "kinoka2", label: "機能強化型2 10,460円" },
              { value: "kinoka3", label: "機能強化型3 9,030円" },
              { value: "kinoka4", label: "機能強化型4 9,030円（新設）" },
            ]}
          />
        ) : (
          <>
            <SelectRow
              label="単一建物居住者数"
              value={input.singleBuildingResidentCount}
              onChange={(v) => onChange({ singleBuildingResidentCount: v as PsychCalcInput["singleBuildingResidentCount"] })}
              options={[
                { value: "under20", label: "20人未満 3,010円" },
                { value: "20-49", label: "20〜49人" },
                { value: "50+", label: "50人以上" },
              ]}
            />
            <SelectRow
              label="月の訪問日数"
              value={input.monthlyVisitDays}
              onChange={(v) => onChange({ monthlyVisitDays: v as PsychCalcInput["monthlyVisitDays"] })}
              options={[
                { value: "1-15", label: "15日以下" },
                { value: "16-24", label: "16〜24日" },
                { value: "25+", label: "25日以上" },
              ]}
            />
          </>
        )}
      </Section>

      {/* 加算 */}
      <Section title="加算">
        <ToggleRow
          label="精神科緊急訪問看護加算"
          checked={input.emergencyVisit}
          onChange={(v) => onChange({ emergencyVisit: v })}
          note="定期外の緊急訪問 +2,650円"
        />

        <ToggleRow
          label="長時間精神科訪問看護加算"
          checked={input.longTimeVisit}
          onChange={(v) => onChange({ longTimeVisit: v })}
          note="週1回（条件下では週3回） +5,200円"
        />

        <SelectRow
          label="時間帯"
          value={input.timeZone}
          onChange={(v) => onChange({ timeZone: v as PsychCalcInput["timeZone"] })}
          options={[
            { value: "normal", label: "通常（加算なし）" },
            { value: "early_late", label: "夜間・早朝（18〜22時/6〜8時） +2,100円" },
            { value: "midnight", label: "深夜（22〜6時） +4,200円" },
          ]}
        />

        <ToggleRow
          label="複数名精神科訪問看護加算"
          checked={input.multipleStaff}
          onChange={(v) => onChange({ multipleStaff: v })}
          note="2名以上での訪問"
        />
        {input.multipleStaff && (
          <SelectRow
            label="同行者の種別"
            value={input.multipleStaffType}
            onChange={(v) => onChange({ multipleStaffType: v as "nurse" | "helper" })}
            options={[
              { value: "nurse", label: "看護師等 +4,500円" },
              { value: "helper", label: "看護補助者 +3,000円（週1まで）" },
            ]}
          />
        )}

        <ToggleRow
          label="精神科複数回訪問加算"
          checked={input.multipleVisit}
          onChange={(v) => onChange({ multipleVisit: v })}
          note="1日に複数回訪問（厚生労働大臣が定める状態）"
        />
        {input.multipleVisit && (
          <SelectRow
            label="訪問回数"
            value={input.multipleVisitCount}
            onChange={(v) => onChange({ multipleVisitCount: v as PsychCalcInput["multipleVisitCount"] })}
            options={[
              { value: "twice", label: "1日2回 +4,500円" },
              { value: "three_plus", label: "1日3回以上 +8,000円（特別訪問看護指示書要）" },
            ]}
          />
        )}
      </Section>

      {/* 情報提供療養費 */}
      <Section title="情報提供療養費（月1回）">
        <ToggleRow
          label="精神科訪問看護情報提供療養費"
          checked={input.infoProvision ?? false}
          onChange={(v) => onChange({ infoProvision: v })}
          note="市区町村・学校・介護支援専門員等への情報提供 +1,500円"
        />
        {(input.infoProvision ?? false) && (
          <SelectRow
            label="情報提供先"
            value={input.infoProvisionType ?? "type1"}
            onChange={(v) => onChange({ infoProvisionType: v as "type1" | "type2" | "type3" })}
            options={[
              { value: "type1", label: "Ⅰ 市区町村等への情報提供（月1回）" },
              { value: "type2", label: "Ⅱ 学校等への情報提供（年1回）" },
              { value: "type3", label: "Ⅲ 介護支援専門員等への情報提供（月1回）" },
            ]}
          />
        )}
      </Section>

      {/* 物価対応料 */}
      <Section title="訪問看護物価対応料（令和8年6月〜新設）">
        <ToggleRow
          label="物価対応料2を算定する"
          checked={input.bukkaTaiou ?? false}
          onChange={(v) => onChange({ bukkaTaiou: v })}
          note="精神科訪問看護基本療養費算定者 +20円/日（令和9年6月以降は40円/日）"
        />
      </Section>

      {/* 訪問看護医療情報連携加算 */}
      <Section title="訪問看護医療情報連携加算（令和8年6月〜新設）">
        <ToggleRow
          label="医療情報連携加算を算定する"
          checked={input.medicalInfoLinkage ?? false}
          onChange={(v) => onChange({ medicalInfoLinkage: v })}
          note="月1回・+1,000円。ICT活用による多職種連携。在宅患者連携指導加算と並算不可。"
        />
      </Section>

      {/* 訪問看護ベースアップ評価料 */}
      {onBaseupTypeChange && (
        <Section title="訪問看護ベースアップ評価料（令和6年度改定）">
          <div className="space-y-2">
            {([
              { value: "none" as MedicalBaseupType,  label: "算定しない",    note: "" },
              { value: "type1" as MedicalBaseupType, label: "評価料（Ⅰ）",  note: "+100円/日" },
              { value: "type2" as MedicalBaseupType, label: "評価料（Ⅱ）",  note: "+200円/日（ステーションのみ）" },
            ] as { value: MedicalBaseupType; label: string; note: string }[]).map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors",
                  baseupType === opt.value
                    ? "bg-purple-50 border border-purple-200"
                    : "bg-stone-50 border border-stone-100"
                )}
              >
                <div>
                  <div className="text-sm font-medium text-stone-800">{opt.label}</div>
                  {opt.note && <div className="text-xs text-stone-500">{opt.note}</div>}
                </div>
                <input
                  type="radio"
                  name="baseupType"
                  checked={baseupType === opt.value}
                  onChange={() => onBaseupTypeChange(opt.value)}
                  className="w-4 h-4 accent-purple-600"
                />
              </label>
            ))}
          </div>
        </Section>
      )}

      {/* 月1回加算 */}
      <Section title="月1回加算">
        <ToggleRow
          label="24時間対応体制加算"
          checked={input.h24Support}
          onChange={(v) => onChange({ h24Support: v })}
          note="月1回算定"
        />
        {input.h24Support && (
          <SelectRow
            label="種別"
            value={input.h24SupportType}
            onChange={(v) => onChange({ h24SupportType: v as "ika" | "ro" })}
            options={[
              { value: "ika", label: "イ（負担軽減取組あり） 6,800円" },
              { value: "ro", label: "ロ（通常） 6,520円" },
            ]}
          />
        )}

        <ToggleRow
          label="特別管理加算"
          checked={input.specialManagement}
          onChange={(v) => onChange({ specialManagement: v })}
          note="月1回算定"
        />
        {input.specialManagement && (
          <SelectRow
            label="種別"
            value={input.specialManagementType}
            onChange={(v) => onChange({ specialManagementType: v as "type1" | "type2" })}
            options={[
              { value: "type1", label: "（1）重症度の高い者 5,000円" },
              { value: "type2", label: "（2）特別な管理が必要な者 2,500円" },
            ]}
          />
        )}

        <ToggleRow
          label="訪問看護ターミナルケア療養費"
          checked={input.terminalCare}
          onChange={(v) => onChange({ terminalCare: v })}
          note="死亡月に算定"
        />
        {input.terminalCare && (
          <SelectRow
            label="種別"
            value={input.terminalCareType}
            onChange={(v) => onChange({ terminalCareType: v as "type1" | "type2" })}
            options={[
              { value: "type1", label: "1（在宅死亡） 25,000円" },
              { value: "type2", label: "2（特養等での死亡） 10,000円" },
            ]}
          />
        )}
      </Section>
    </div>
  );
}

// ============================================================
// 自立支援医療 月額上限管理ウィジェット
// ============================================================

interface SeishinCopayTrackerWidgetProps {
  tracker: SeishinCopayTracker;
  onChange: (updates: Partial<SeishinCopayTracker>) => void;
  baseAmount: number;  // 今回の1割負担額
}

export function SeishinCopayTrackerWidget({
  tracker,
  onChange,
  baseAmount,
}: SeishinCopayTrackerWidgetProps) {
  const { monthlyLimit, alreadyPaid } = tracker;

  const remainingBudget = monthlyLimit > 0 ? Math.max(0, monthlyLimit - alreadyPaid) : -1;
  const actualPayment = monthlyLimit > 0
    ? Math.min(baseAmount, Math.max(0, remainingBudget))
    : baseAmount;
  const newTotal = alreadyPaid + actualPayment;
  const progressPct = monthlyLimit > 0 ? Math.min(100, Math.round((newTotal / monthlyLimit) * 100)) : 0;
  const isAtLimit = monthlyLimit > 0 && newTotal >= monthlyLimit;

  const LIMIT_OPTIONS = [
    { value: 0, label: "上限なし（重度かつ継続に非該当）" },
    { value: 2500, label: "2,500円（低所得1・生活保護）" },
    { value: 5000, label: "5,000円（低所得2・一般所得1）" },
    { value: 10000, label: "10,000円（一般所得2）" },
    { value: 20000, label: "20,000円（上位所得）" },
  ];

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-purple-500" />
        <span className="text-sm font-bold text-purple-800">自立支援医療 月額上限管理</span>
      </div>

      {/* 月額上限選択 */}
      <div>
        <label className="text-xs text-purple-700 font-medium mb-1 block">月額自己負担上限額</label>
        <select
          value={monthlyLimit}
          onChange={(e) => onChange({ monthlyLimit: Number(e.target.value) })}
          className="w-full text-sm border border-purple-200 rounded-lg px-3 py-2 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-purple-400"
        >
          {LIMIT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* 累計支払済み額 */}
      <div>
        <label className="text-xs text-purple-700 font-medium mb-1 block">
          今月すでに支払った累計額（今回の訪問分を除く）
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={monthlyLimit > 0 ? monthlyLimit : 999999}
            value={alreadyPaid}
            onChange={(e) => onChange({ alreadyPaid: Math.max(0, Number(e.target.value)) })}
            className="flex-1 text-sm border border-purple-200 rounded-lg px-3 py-2 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
          <span className="text-sm text-stone-600 shrink-0">円</span>
        </div>
      </div>

      {/* 計算結果 */}
      {monthlyLimit > 0 && (
        <>
          {/* プログレスバー */}
          <div>
            <div className="flex justify-between text-xs text-purple-700 mb-1">
              <span>今回支払後の累計</span>
              <span className="font-bold">{newTotal.toLocaleString()}円 / {monthlyLimit.toLocaleString()}円</span>
            </div>
            <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isAtLimit ? "bg-red-500" : "bg-purple-500"
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className={cn(
            "rounded-lg px-3 py-2 flex items-center justify-between",
            isAtLimit ? "bg-red-50 border border-red-200" : "bg-white border border-purple-200"
          )}>
            <div>
              <div className="text-xs text-stone-500">今回の実際の支払額</div>
              <div className="text-xs text-stone-400 mt-0.5">
                {isAtLimit
                  ? "月額上限に到達済み"
                  : `残り予算 ${remainingBudget.toLocaleString()}円`}
              </div>
            </div>
            <div className={cn(
              "text-xl font-bold",
              isAtLimit ? "text-red-600" : "text-purple-700"
            )}>
              {actualPayment.toLocaleString()}円
            </div>
          </div>
        </>
      )}

      {monthlyLimit === 0 && (
        <div className="bg-white border border-purple-200 rounded-lg px-3 py-2 flex items-center justify-between">
          <div className="text-xs text-stone-500">今回の実際の支払額（1割）</div>
          <div className="text-xl font-bold text-purple-700">{baseAmount.toLocaleString()}円</div>
        </div>
      )}
    </div>
  );
}
