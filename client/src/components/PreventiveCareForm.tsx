/**
 * 介護予防訪問看護 算定フォーム
 * Design: ウォームアンバー・プロフェッショナル
 * - 介護予防訪問看護費（ステーション・病院診療所）
 * - 各種加算
 */

import type { PreventiveCareCalcInput, CareRegionRate } from "@/lib/calcEngine";
import { CARE_REGION_OPTIONS } from "@/lib/calcEngine";
import { cn } from "@/lib/utils";

interface PreventiveCareFormProps {
  input: PreventiveCareCalcInput;
  onChange: (updates: Partial<PreventiveCareCalcInput>) => void;
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
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  note?: string;
}) {
  return (
    <label className={cn(
      "flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors",
      checked ? "bg-emerald-50 border border-emerald-200" : "bg-stone-50 border border-stone-100"
    )}>
      <div>
        <div className="text-sm font-medium text-stone-800">{label}</div>
        {note && <div className="text-xs text-stone-500">{note}</div>}
      </div>
      <div
        className={cn(
          "w-10 h-5 rounded-full transition-colors relative shrink-0",
          checked ? "bg-emerald-600" : "bg-stone-300"
        )}
        onClick={() => onChange(!checked)}
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
        className="text-sm border border-stone-200 rounded-md px-2 py-1 bg-white text-stone-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 max-w-[200px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function PreventiveCareForm({ input, onChange }: PreventiveCareFormProps) {
  return (
    <div className="space-y-4">
      {/* 基本情報 */}
      <Section title="基本情報">
        <SelectRow
          label="事業所の種別"
          value={input.providerType}
          onChange={(v) => onChange({ providerType: v as "station" | "hospital" })}
          options={[
            { value: "station", label: "訪問看護ステーション" },
            { value: "hospital", label: "病院・診療所" },
          ]}
        />
        <SelectRow
          label="訪問時間"
          value={input.visitDuration}
          onChange={(v) => onChange({ visitDuration: v as PreventiveCareCalcInput["visitDuration"] })}
          options={[
            { value: "20min", label: "20分未満" },
            { value: "30min", label: "30分未満" },
            { value: "60min", label: "30分以上1時間未満" },
            { value: "90min", label: "1時間以上1時間30分未満" },
            { value: "pt_ot_st", label: "理学療法士等による訪問" },
          ]}
        />
        <SelectRow
          label="地域区分"
          value={input.regionRate}
          onChange={(v) => onChange({ regionRate: v as CareRegionRate })}
          options={CARE_REGION_OPTIONS}
        />
      </Section>

      {/* 加算 */}
      <Section title="加算">
        <ToggleRow
          label="緊急時訪問看護加算（Ⅰ）"
          checked={input.emergencyVisit}
          onChange={(v) => onChange({ emergencyVisit: v })}
          note="月1回 +600単位"
        />

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
              { value: "type1", label: "（1）重症度の高い者 +500単位" },
              { value: "type2", label: "（2）特別な管理が必要な者 +250単位" },
            ]}
          />
        )}

        <ToggleRow
          label="初回加算"
          checked={input.initialAdd}
          onChange={(v) => onChange({ initialAdd: v })}
          note="月1回算定"
        />
        {input.initialAdd && (
          <SelectRow
            label="種別"
            value={input.initialAddType}
            onChange={(v) => onChange({ initialAddType: v as "type1" | "type2" })}
            options={[
              { value: "type1", label: "（Ⅰ）退院・施設退所後 +350単位（新設）" },
              { value: "type2", label: "（Ⅱ）通常 +300単位" },
            ]}
          />
        )}

        <ToggleRow
          label="複数名訪問看護加算"
          checked={input.multipleVisit}
          onChange={(v) => onChange({ multipleVisit: v })}
          note="2名以上での訪問"
        />
        {input.multipleVisit && (
          <SelectRow
            label="種別"
            value={input.multipleVisitType}
            onChange={(v) => onChange({ multipleVisitType: v as "nurse" | "other" })}
            options={[
              { value: "nurse", label: "（Ⅰ）看護師等 +254単位" },
              { value: "other", label: "（Ⅱ）その他 +201単位" },
            ]}
          />
        )}

        <ToggleRow
          label="夜間・早朝加算"
          checked={input.earlyLate}
          onChange={(v) => onChange({ earlyLate: v, midnight: v ? false : input.midnight })}
          note="所定単位数の25%加算"
        />

        <ToggleRow
          label="深夜加算"
          checked={input.midnight}
          onChange={(v) => onChange({ midnight: v, earlyLate: v ? false : input.earlyLate })}
          note="所定単位数の50%加算"
        />

        <ToggleRow
          label="ターミナルケア加算"
          checked={input.terminalCare}
          onChange={(v) => onChange({ terminalCare: v })}
          note="死亡月に算定 +2,500単位"
        />
      </Section>

      {/* 注意事項 */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 space-y-1">
        <p className="font-bold">介護予防訪問看護について</p>
        <p>・要支援1・2の方が対象です</p>
        <p>・令和6年度（2024年度）介護報酬改定に基づき算定しています</p>
        <p>・介護予防訪問看護費は介護保険の訪問看護費と単位数が異なります</p>
      </div>
    </div>
  );
}
