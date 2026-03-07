/**
 * 患者負担設定フォーム
 * 後期高齢者・公費負担・介護保険の自己負担割合設定
 */
import { cn } from "@/lib/utils";
import type { PatientCopayInput, CopayRatio, KohiType, KohiIncomeClass } from "@/lib/calcEngine";
import type { InsuranceMode } from "@/hooks/useVisitStore";

interface RadioGroupProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; sublabel?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}

function RadioGroup<T extends string>({ label, value, options, onChange, disabled }: RadioGroupProps<T>) {
  return (
    <div className={cn("space-y-1.5", disabled && "opacity-40 pointer-events-none")}>
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium border transition-all duration-150 text-left",
              value === opt.value
                ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                : "bg-white text-stone-600 border-stone-200 hover:border-amber-400 hover:text-amber-700"
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

interface CopayFormProps {
  input: PatientCopayInput;
  insuranceMode: InsuranceMode;
  onChange: (updates: Partial<PatientCopayInput>) => void;
}

export default function CopayForm({ input, insuranceMode, onChange }: CopayFormProps) {
  if (insuranceMode === "care" || insuranceMode === "preventive") {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-stone-800 border-l-2 border-amber-500 pl-2">
          患者負担割合（{insuranceMode === "preventive" ? "介護予防訪問看護" : "介護保険"}）
        </h3>
        <RadioGroup<"1" | "2" | "3">
          label="負担割合"
          value={input.careCopayRatio}
          onChange={(v) => onChange({ careCopayRatio: v })}
          options={[
            { value: "1", label: "1割負担" },
            { value: "2", label: "2割負担" },
            { value: "3", label: "3割負担" },
          ]}
        />
        <div className="text-xs text-stone-500 bg-stone-50 rounded p-2 border border-stone-200">
          ※ 介護保険の負担割合は「介護保険負担割合証」に記載されています。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-stone-800 border-l-2 border-amber-500 pl-2">
        患者負担設定（{insuranceMode === "psychiatric" ? "精神科訪問看護" : "医療保険"}）
      </h3>

      {/* 公費負担の有無 */}
      <RadioGroup<KohiType>
        label="公費負担の種別"
        value={input.kohiType}
        onChange={(v) => onChange({ kohiType: v })}
        options={[
          { value: "none",     label: "なし（通常の医療保険）" },
          { value: "nanbyou",  label: "指定難病",         sublabel: "原則2割・月額上限あり" },
          { value: "seishin",  label: "自立支援（精神通院）", sublabel: "原則1割・月額上限あり" },
          { value: "seikatsu", label: "生活保護",         sublabel: "自己負担なし" },
          { value: "genpatsu", label: "原爆被爆者援護",   sublabel: "自己負担なし" },
          { value: "jidou",    label: "こども医療費助成", sublabel: "自治体による" },
        ]}
      />

      {/* 通常の医療保険の場合：負担割合 */}
      {input.kohiType === "none" && (
        <RadioGroup<CopayRatio>
          label="負担割合"
          value={input.copayRatio}
          onChange={(v) => onChange({ copayRatio: v })}
          options={[
            { value: "1", label: "1割負担",  sublabel: "後期高齢者（一般）" },
            { value: "2", label: "2割負担",  sublabel: "後期高齢者（現役並み1）" },
            { value: "3", label: "3割負担",  sublabel: "一般・現役世代" },
          ]}
        />
      )}

      {/* 難病・自立支援の場合：所得区分 */}
      {(input.kohiType === "nanbyou" || input.kohiType === "seishin") && (
        <RadioGroup<KohiIncomeClass>
          label="所得区分"
          value={input.kohiIncomeClass}
          onChange={(v) => onChange({ kohiIncomeClass: v })}
          options={[
            { value: "seikatsu_hogo", label: "生活保護",      sublabel: "上限0円" },
            { value: "teishotoku1",   label: "低所得1",        sublabel: input.kohiType === "nanbyou" ? "上限2,500円" : "上限2,500円" },
            { value: "teishotoku2",   label: "低所得2",        sublabel: input.kohiType === "nanbyou" ? "上限5,000円" : "上限5,000円" },
            { value: "ippan1",        label: "一般所得1",      sublabel: input.kohiType === "nanbyou" ? "上限10,000円" : "上限5,000円（重度継続）" },
            { value: "ippan2",        label: "一般所得2",      sublabel: input.kohiType === "nanbyou" ? "上限20,000円" : "上限10,000円（重度継続）" },
            { value: "jyoshotoku",    label: "上位所得",       sublabel: input.kohiType === "nanbyou" ? "上限30,000円" : "上限20,000円（重度継続）" },
          ]}
        />
      )}

      {/* 注意書き */}
      <div className="text-xs text-stone-500 bg-stone-50 rounded p-2 border border-stone-200 space-y-1">
        {input.kohiType === "nanbyou" && (
          <p>※ 指定難病の月額上限額は、訪問看護単独ではなく同一制度を利用する全医療機関・薬局の合算です。</p>
        )}
        {input.kohiType === "seishin" && (
          <p>※ 自立支援医療（精神通院）の上限額は「重度かつ継続」の場合の目安です。受給者証に記載の上限額をご確認ください。</p>
        )}
        {input.kohiType === "none" && (
          <p>※ 高額療養費制度の適用は考慮していません。月の自己負担が上限を超える場合は別途確認が必要です。</p>
        )}
      </div>
    </div>
  );
}
