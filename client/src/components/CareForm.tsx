/**
 * 介護保険 訪問看護費 算定フォーム
 * 令和6年度（2024年度）介護報酬改定 準拠
 */
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import type { CareCalcInput, CareProviderType, CareVisitDuration, CareRegionRate } from "@/lib/calcEngine";
import { CARE_REGION_OPTIONS } from "@/lib/calcEngine";

interface RadioGroupProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; sublabel?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  tooltip?: string;
}

function RadioGroup<T extends string>({ label, value, options, onChange, disabled, tooltip }: RadioGroupProps<T>) {
  return (
    <div className={cn("space-y-1.5", disabled && "opacity-40 pointer-events-none")}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon className="w-3.5 h-3.5 text-stone-400 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium border transition-all duration-150 text-left",
              value === opt.value
                ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                : "bg-white text-stone-600 border-stone-200 hover:border-teal-400 hover:text-teal-700"
            )}
          >
            <div>{opt.label}</div>
            {opt.sublabel && <div className="text-xs opacity-75 mt-0.5">{opt.sublabel}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

function SwitchRow({
  label, checked, onChange, disabled, tooltip,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
  disabled?: boolean; tooltip?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between py-2", disabled && "opacity-40 pointer-events-none")}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <InfoIcon className="w-3.5 h-3.5 text-stone-400 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-teal-600"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-stone-800 border-l-2 border-teal-500 pl-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

interface CareFormProps {
  input: CareCalcInput;
  onChange: (updates: Partial<CareCalcInput>) => void;
}

export default function CareForm({ input, onChange }: CareFormProps) {
  return (
    <div className="space-y-5">
      {/* 基本情報 */}
      <Section title="訪問看護費 基本">
        <RadioGroup<CareProviderType>
          label="事業所種別"
          value={input.providerType}
          onChange={(v) => onChange({ providerType: v })}
          options={[
            { value: "station",  label: "訪問看護ステーション" },
            { value: "hospital", label: "病院・診療所" },
          ]}
        />
        <RadioGroup<CareVisitDuration>
          label="訪問時間区分"
          value={input.visitDuration}
          onChange={(v) => onChange({ visitDuration: v })}
          options={[
            { value: "20min",    label: "20分未満",           sublabel: input.providerType === "station" ? "314単位" : "266単位" },
            { value: "30min",    label: "30分未満",           sublabel: input.providerType === "station" ? "471単位" : "399単位" },
            { value: "60min",    label: "30分〜1時間未満",    sublabel: input.providerType === "station" ? "823単位" : "574単位" },
            { value: "90min",    label: "1時間〜1時間30分未満", sublabel: input.providerType === "station" ? "1,128単位" : "844単位" },
            { value: "pt_ot_st", label: "理学療法士等",       sublabel: input.providerType === "station" ? "294単位" : "266単位" },
          ]}
        />
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-stone-700">地域区分（1単位あたりの単価）</span>
          <select
            value={input.regionRate}
            onChange={(e) => onChange({ regionRate: e.target.value as CareRegionRate })}
            className="w-full text-sm border border-stone-200 rounded-md px-3 py-2 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            {CARE_REGION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </Section>

      {/* 加算 */}
      <Section title="各種加算">
        <SwitchRow
          label="緊急時訪問看護加算（Ⅰ）"
          checked={input.emergencyVisit}
          onChange={(v) => onChange({ emergencyVisit: v })}
          tooltip="月1回算定。600単位"
        />

        <SwitchRow
          label="特別管理加算"
          checked={input.specialManagement}
          onChange={(v) => onChange({ specialManagement: v })}
          tooltip="月1回算定"
        />
        {input.specialManagement && (
          <div className="pl-2">
            <RadioGroup<"type1" | "type2">
              label="区分"
              value={input.specialManagementType}
              onChange={(v) => onChange({ specialManagementType: v })}
              options={[
                { value: "type1", label: "（1）重症度高い者", sublabel: "500単位" },
                { value: "type2", label: "（2）特別な管理",   sublabel: "250単位" },
              ]}
            />
          </div>
        )}

        <SwitchRow
          label="ターミナルケア加算"
          checked={input.terminalCare}
          onChange={(v) => onChange({ terminalCare: v })}
          tooltip="死亡月に算定。2,500単位"
        />

        <SwitchRow
          label="複数名訪問看護加算"
          checked={input.multipleVisit}
          onChange={(v) => onChange({ multipleVisit: v })}
          tooltip="2名以上で訪問する場合"
        />
        {input.multipleVisit && (
          <div className="pl-2">
            <RadioGroup<"nurse" | "other">
              label="同行職種"
              value={input.multipleVisitType}
              onChange={(v) => onChange({ multipleVisitType: v })}
              options={[
                { value: "nurse", label: "（Ⅰ）看護師等", sublabel: "254単位" },
                { value: "other", label: "（Ⅱ）その他",   sublabel: "201単位" },
              ]}
            />
          </div>
        )}

        <SwitchRow
          label="夜間・早朝加算"
          checked={input.earlyLate}
          onChange={(v) => onChange({ earlyLate: v, midnight: false })}
          tooltip="所定単位数の25%加算"
        />
        <SwitchRow
          label="深夜加算"
          checked={input.midnight}
          onChange={(v) => onChange({ midnight: v, earlyLate: false })}
          tooltip="所定単位数の50%加算"
        />
      </Section>
    </div>
  );
}
