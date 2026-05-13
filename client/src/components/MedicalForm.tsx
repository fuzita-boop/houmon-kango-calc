/**
 * 医療保険 算定フォーム
 * Design: ウォームアンバー・プロフェッショナル
 */
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import type {
  CalcInput,
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
  MedicalBaseupConfig,
  MedicalBaseupKind,
  BaseupContinuityType,
} from "@/lib/calcEngine";
import { getDisabledFields, BASEUP_TYPE1_FEE, BASEUP_TYPE2_NEW_FEES, BASEUP_TYPE2_CONTINUING_FEES_CORRECT, DEFAULT_BASEUP_CONFIG } from "@/lib/calcEngine";

interface RadioGroupProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; sublabel?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  tooltip?: string;
  wrap?: boolean;
}

function RadioGroup<T extends string>({
  label, value, options, onChange, disabled, tooltip, wrap = true,
}: RadioGroupProps<T>) {
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
      <div className={cn("flex gap-1.5", wrap ? "flex-wrap" : "flex-nowrap overflow-x-auto")}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium border transition-all duration-150 text-left shrink-0",
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

interface SwitchRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  tooltip?: string;
  badge?: string;
}

function SwitchRow({ label, checked, onChange, disabled, tooltip, badge }: SwitchRowProps) {
  return (
    <div className={cn("flex items-center justify-between py-2", disabled && "opacity-40 pointer-events-none")}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        {badge && (
          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">{badge}</span>
        )}
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
        className="data-[state=checked]:bg-amber-600"
      />
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  badge?: string;
}

function Section({ title, children, badge }: SectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-stone-800 border-l-2 border-amber-500 pl-2">{title}</h3>
        {badge && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">{badge}</span>}
      </div>
      <div className="space-y-3 pl-0">{children}</div>
    </div>
  );
}

interface MedicalFormProps {
  input: CalcInput;
  onChange: (updates: Partial<CalcInput>) => void;
  baseupConfig?: MedicalBaseupConfig;
  onBaseupConfigChange?: (v: MedicalBaseupConfig) => void;
}

export default function MedicalForm({ input, onChange, baseupConfig = DEFAULT_BASEUP_CONFIG, onBaseupConfigChange }: MedicalFormProps) {
  const disabled = getDisabledFields(input);
  const isComprehensive = input.mode === "comprehensive";

  return (
    <div className="space-y-5">
      {/* 算定方式 */}
      <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-stone-800">算定方式</div>
            <div className="text-xs text-stone-500 mt-0.5">
              {isComprehensive
                ? "包括型：1日単位の包括評価（令和8年度新設）"
                : "従来型：出来高算定（基本療養費＋管理療養費＋各加算）"}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("text-xs font-medium", !isComprehensive ? "text-amber-700" : "text-stone-400")}>従来型</span>
            <Switch
              checked={isComprehensive}
              onCheckedChange={(v) => onChange({ mode: v ? "comprehensive" : "traditional" })}
              className="data-[state=checked]:bg-amber-600"
            />
            <span className={cn("text-xs font-medium", isComprehensive ? "text-amber-700" : "text-stone-400")}>包括型</span>
          </div>
        </div>
      </div>

      {/* 包括型 */}
      {isComprehensive && (
        <Section title="包括型訪問看護療養費" badge="令和8年度新設">
          <RadioGroup<SingleBuildingResidentCount>
            label="単一建物居住者数"
            value={input.comprehensiveBuildingCount}
            onChange={(v) => onChange({ comprehensiveBuildingCount: v })}
            options={[
              { value: "under20", label: "20人未満" },
              { value: "20-49",   label: "20〜49人" },
              { value: "50+",     label: "50人以上" },
            ]}
          />
          <RadioGroup<VisitDuration>
            label="訪問時間区分"
            value={input.visitDuration}
            onChange={(v) => onChange({ visitDuration: v })}
            options={[
              { value: "30-60",       label: "30〜60分未満" },
              { value: "60-90",       label: "60〜90分未満" },
              { value: "90+",         label: "90分以上" },
              { value: "90+-special", label: "90分以上（特別）", sublabel: "特別訪問看護指示書等" },
            ]}
          />
          <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 border border-amber-200">
            ※ 包括型は難病等複数回訪問加算・複数名訪問加算・早朝夜間加算・深夜加算・24時間対応体制加算は算定不可
          </div>
        </Section>
      )}

      {/* 従来型：基本療養費 */}
      {!isComprehensive && (
        <Section title="訪問看護基本療養費">
          <RadioGroup<StaffType>
            label="訪問職種"
            value={input.staffType}
            onChange={(v) => onChange({ staffType: v })}
            options={[
              { value: "nurse",     label: "看護師等",  sublabel: "保健師・助産師・看護師" },
              { value: "junkango",  label: "准看護師" },
              { value: "specialist",label: "専門看護師", sublabel: "緩和ケア等" },
              { value: "pt_ot_st",  label: "PT・OT・ST" },
            ]}
          />
          <RadioGroup<WeeklyVisitDay>
            label="週の訪問日数"
            value={input.weeklyVisitDay}
            onChange={(v) => onChange({ weeklyVisitDay: v })}
            options={[
              { value: "1-3", label: "週3日目まで" },
              { value: "4+",  label: "週4日目以降", sublabel: "+1,000円" },
            ]}
            disabled={disabled.has("weeklyVisitDay")}
            tooltip="専門看護師・PT/OT/STは週の日数による単価差なし"
          />
          <SwitchRow
            label="同一建物居住者への訪問（基本療養費Ⅱ）"
            checked={input.isSameBuilding}
            onChange={(v) => onChange({ isSameBuilding: v })}
            tooltip="同一建物内の複数利用者を訪問する場合"
          />
          {input.isSameBuilding && (
            <>
              <RadioGroup<BuildingResidentCount>
                label="同一建物の訪問人数"
                value={input.buildingResidentCount}
                onChange={(v) => onChange({ buildingResidentCount: v })}
                options={[
                  { value: "1-2",   label: "1〜2人" },
                  { value: "3-9",   label: "3〜9人" },
                  { value: "10-19", label: "10〜19人" },
                  { value: "20-49", label: "20〜49人" },
                  { value: "50+",   label: "50人以上" },
                ]}
              />
              {["10-19","20-49","50+"].includes(input.buildingResidentCount) && (
                <RadioGroup<MonthlyVisitDayForBasic>
                  label="月の訪問日数（基本療養費Ⅱ用）"
                  value={input.monthlyVisitDayForBasic}
                  onChange={(v) => onChange({ monthlyVisitDayForBasic: v })}
                  options={[
                    { value: "1-20", label: "月20日目まで" },
                    { value: "21+",  label: "月21日目以降" },
                  ]}
                />
              )}
            </>
          )}
        </Section>
      )}

      {/* 管理療養費 */}
      {!isComprehensive && (
        <Section title="訪問看護管理療養費">
          <SwitchRow
            label="月の初日の訪問"
            checked={input.isFirstVisitOfMonth}
            onChange={(v) => onChange({ isFirstVisitOfMonth: v })}
            tooltip="月の初日は管理療養費（月初日）を算定"
          />
          {input.isFirstVisitOfMonth ? (
            <RadioGroup<ManagementFeeType>
              label="管理療養費の種別"
              value={input.managementFeeType}
              onChange={(v) => onChange({ managementFeeType: v })}
              options={[
                { value: "standard", label: "通常",         sublabel: "7,710円" },
                { value: "kinoka4",  label: "機能強化型4",   sublabel: "9,030円 新設" },
                { value: "kinoka3",  label: "機能強化型3",   sublabel: "9,030円" },
                { value: "kinoka2",  label: "機能強化型2",   sublabel: "10,460円" },
                { value: "kinoka1",  label: "機能強化型1",   sublabel: "13,760円" },
              ]}
            />
          ) : (
            <>
              <RadioGroup<SingleBuildingResidentCount>
                label="単一建物居住者数"
                value={input.singleBuildingResidentCount}
                onChange={(v) => onChange({ singleBuildingResidentCount: v })}
                options={[
                  { value: "under20", label: "20人未満", sublabel: "3,010円" },
                  { value: "20-49",   label: "20〜49人" },
                  { value: "50+",     label: "50人以上" },
                ]}
              />
              <RadioGroup<MonthlyVisitDays>
                label="月の訪問日数"
                value={input.monthlyVisitDays}
                onChange={(v) => onChange({ monthlyVisitDays: v })}
                options={[
                  { value: "1-15",  label: "月15日以下" },
                  { value: "16-24", label: "月16〜24日" },
                  { value: "25+",   label: "月25日以上" },
                ]}
                disabled={input.singleBuildingResidentCount === "under20"}
                tooltip="単一建物20人未満は日数による変動なし（3,010円固定）"
              />
            </>
          )}
        </Section>
      )}

      {/* 加算 */}
      <Section title="各種加算">
        {/* 24時間対応体制加算（従来型のみ） */}
        <div className={cn(isComprehensive && "opacity-40 pointer-events-none")}>
          <SwitchRow
            label="24時間対応体制加算"
            checked={input.h24Support}
            onChange={(v) => onChange({ h24Support: v })}
            tooltip="月1回算定。包括型では算定不可"
          />
          {input.h24Support && !isComprehensive && (
            <div className="pl-2 mt-1">
              <RadioGroup<"ika" | "ro">
                label="種別"
                value={input.h24SupportType}
                onChange={(v) => onChange({ h24SupportType: v })}
                options={[
                  { value: "ika", label: "イ（負担軽減取組あり）", sublabel: "6,800円" },
                  { value: "ro",  label: "ロ（通常）",             sublabel: "6,520円" },
                ]}
              />
            </div>
          )}
          {isComprehensive && (
            <div className="text-xs text-stone-400 pl-1">包括型では算定不可</div>
          )}
        </div>

        {/* 難病等複数回訪問加算（従来型のみ） */}
        <div className={cn(isComprehensive && "opacity-40 pointer-events-none")}>
          <SwitchRow
            label="難病等複数回訪問加算"
            checked={input.multipleVisit}
            onChange={(v) => onChange({ multipleVisit: v })}
            tooltip="1日に2回以上訪問する場合。包括型では算定不可"
          />
          {input.multipleVisit && !isComprehensive && (
            <div className="pl-2 mt-1 space-y-2">
              <RadioGroup<MultipleVisitCount>
                label="1日の訪問回数"
                value={input.multipleVisitCount}
                onChange={(v) => onChange({ multipleVisitCount: v })}
                options={[
                  { value: "twice",      label: "1日2回" },
                  { value: "three_plus", label: "1日3回以上" },
                ]}
              />
              <RadioGroup<"1-20" | "21+">
                label="月の訪問日数"
                value={input.multipleVisitMonthDay}
                onChange={(v) => onChange({ multipleVisitMonthDay: v })}
                options={[
                  { value: "1-20", label: "月20日目まで" },
                  { value: "21+",  label: "月21日目以降" },
                ]}
              />
            </div>
          )}
        </div>

        {/* 特別管理加算 */}
        <SwitchRow
          label="特別管理加算"
          checked={input.specialManagement}
          onChange={(v) => onChange({ specialManagement: v })}
          tooltip="月1回算定"
        />
        {input.specialManagement && (
          <div className="pl-2 mt-1">
            <RadioGroup<SpecialManagementType>
              label="区分"
              value={input.specialManagementType}
              onChange={(v) => onChange({ specialManagementType: v })}
              options={[
                { value: "type1", label: "（1）重症度高い者", sublabel: "5,000円" },
                { value: "type2", label: "（2）特別な管理",   sublabel: "2,500円" },
              ]}
            />
          </div>
        )}

        {/* 複数名訪問加算（従来型のみ） */}
        <div className={cn(isComprehensive && "opacity-40 pointer-events-none")}>
          <SwitchRow
            label="複数名訪問加算"
            checked={input.coVisit}
            onChange={(v) => onChange({ coVisit: v })}
            tooltip="2名以上で訪問する場合。包括型では算定不可"
          />
          {input.coVisit && !isComprehensive && (
            <div className="pl-2 mt-1">
              <RadioGroup<CoVisitStaffType>
                label="同行職種"
                value={input.coVisitStaffType}
                onChange={(v) => onChange({ coVisitStaffType: v })}
                options={[
                  { value: "nurse",    label: "看護師等" },
                  { value: "junkango", label: "准看護師" },
                  { value: "other",    label: "その他職員" },
                ]}
              />
            </div>
          )}
        </div>

        {/* 時間帯加算（従来型のみ） */}
        <div className={cn(isComprehensive && "opacity-40 pointer-events-none")}>
          <RadioGroup<TimeZone>
            label="時間帯区分"
            value={input.timeZone}
            onChange={(v) => onChange({ timeZone: v })}
            options={[
              { value: "normal",     label: "通常時間帯" },
              { value: "early_late", label: "早朝・夜間", sublabel: "6-8時/18-22時" },
              { value: "midnight",   label: "深夜",       sublabel: "22-6時" },
            ]}
            disabled={isComprehensive}
            tooltip="包括型では算定不可（包括評価に含まれます）"
          />
          {input.timeZone !== "normal" && !isComprehensive && (
            <div className="pl-2 mt-1">
              <RadioGroup<"1-15" | "16+">
                label="月の訪問日数（加算人数区分用）"
                value={input.timeZoneMonthDay}
                onChange={(v) => onChange({ timeZoneMonthDay: v })}
                options={[
                  { value: "1-15", label: "月15日以下" },
                  { value: "16+",  label: "月16日以上" },
                ]}
              />
            </div>
          )}
        </div>

        {/* 訪問看護情報提供療養費 */}
        <SwitchRow
          label="訪問看護情報提供療養費"
          checked={input.infoProvision}
          onChange={(v) => onChange({ infoProvision: v })}
          tooltip="月1回算定。1,500円"
        />
        {input.infoProvision && (
          <div className="pl-2 mt-1">
            <RadioGroup<InfoProvisionType>
              label="区分"
              value={input.infoProvisionType}
              onChange={(v) => onChange({ infoProvisionType: v })}
              options={[
                { value: "type1", label: "1（市町村等）" },
                { value: "type2", label: "2（学校等）" },
                { value: "type3", label: "3（保険医療機関）" },
              ]}
            />
          </div>
        )}

        {/* ターミナルケア療養費 */}
        <SwitchRow
          label="訪問看護ターミナルケア療養費"
          checked={input.terminalCare}
          onChange={(v) => onChange({ terminalCare: v })}
          tooltip="死亡月に算定"
        />
        {input.terminalCare && (
          <div className="pl-2 mt-1">
            <RadioGroup<TerminalCareType>
              label="区分"
              value={input.terminalCareType}
              onChange={(v) => onChange({ terminalCareType: v })}
              options={[
                { value: "type1", label: "1（在宅死亡）",   sublabel: "25,000円" },
                { value: "type2", label: "2（特養等死亡）", sublabel: "10,000円" },
              ]}
            />
          </div>
        )}
      </Section>

      {/* 訪問看護物価対応料1 */}
      <Section title="訪問看護物価対応料（令和8年6月〜新設）" badge="新設">
        <SwitchRow
          label="物価対応料1を算定する"
          checked={input.bukkaTaiou ?? false}
          onChange={(v) => onChange({ bukkaTaiou: v })}
          tooltip="訪問看護基本療養費Ⅰ・Ⅱ・Ⅲ算定者。月初日60円、以降各日20円（令和9年6月以降2倍）"
        />
        {(input.bukkaTaiou ?? false) && (
          <div className="text-xs text-stone-500 bg-amber-50 rounded px-3 py-2 border border-amber-200">
            月初日の訪問: <span className="font-bold text-amber-700">+60円</span>　
            2日目以降: <span className="font-bold text-amber-700">+20円</span>
          </div>
        )}
      </Section>

      {/* 訪問看護医療情報連携加算 */}
      <Section title="訪問看護医療情報連携加算（令和8年6月〜新設）" badge="新設">
        <SwitchRow
          label="医療情報連携加算を算定する"
          checked={input.medicalInfoLinkage ?? false}
          onChange={(v) => onChange({ medicalInfoLinkage: v })}
          tooltip="ICTを用いた多職種連携による計画的管理。月1回・1,000円。在宅患者連携指導加算との併算不可。"
        />
        {(input.medicalInfoLinkage ?? false) && (
          <div className="text-xs text-stone-500 bg-amber-50 rounded px-3 py-2 border border-amber-200">
            月1回算定：<span className="font-bold text-amber-700">+1,000円</span>　ICT活用による多職種連携体制の整備が必要。
          </div>
        )}
      </Section>

      {/* 訪問看護ベースアップ評価料（令和8年度改定） */}
      {onBaseupConfigChange && (
        <Section title="訪問看護ベースアップ評価料（令和8年6月〜改定）" badge="改定">
          <RadioGroup<MedicalBaseupKind>
            label="評価料の種別"
            value={baseupConfig.kind}
            onChange={(v) => onBaseupConfigChange({ ...baseupConfig, kind: v })}
            options={[
              { value: "none",  label: "算定しない" },
              { value: "type1", label: "評価料（Ⅰ）", sublabel: "月に1回定額" },
              { value: "type2", label: "評価料（Ⅱ）", sublabel: "月に1回定額（ステーションのみ）" },
            ]}
            tooltip="訪問看護ステーション：Ⅰ・Ⅱ両方算定可。病院・診療所：Ⅰのみ。月に1回定額算定。"
          />
          {baseupConfig.kind !== "none" && (
            <>
              <RadioGroup<BaseupContinuityType>
                label="継続的賃上げ実施の有無"
                value={baseupConfig.continuity}
                onChange={(v) => onBaseupConfigChange({ ...baseupConfig, continuity: v })}
                options={[
                  { value: "new",        label: "新規算定（継続的賃上げなし）" },
                  { value: "continuing", label: "継続的賃上げ実施事業所" },
                ]}
                tooltip="令和6年度改定から継続的に賃上げを実施している場合は「継続的賃上げ実施」を選択"
              />
              {baseupConfig.kind === "type2" && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-stone-700">評価料（Ⅱ）の区分（1〜18）</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="w-3.5 h-3.5 text-stone-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[240px] text-xs">事業所の訪問看護ステーション従業者数等に応じて区分が決まります。区分1=30円〜区分18=540円（新規）</TooltipContent>
                    </Tooltip>
                  </div>
                  <select
                    className="w-full border border-stone-300 rounded-md px-3 py-2 text-sm bg-white"
                    value={baseupConfig.type2Division}
                    onChange={(e) => onBaseupConfigChange({ ...baseupConfig, type2Division: Number(e.target.value) })}
                  >
                    {Array.from({ length: 18 }, (_, i) => i + 1).map(div => {
                      const fee = baseupConfig.continuity === "continuing"
                        ? (BASEUP_TYPE2_CONTINUING_FEES_CORRECT[div] ?? BASEUP_TYPE2_NEW_FEES[div])
                        : BASEUP_TYPE2_NEW_FEES[div];
                      return (
                        <option key={div} value={div}>区分{div}：{fee.toLocaleString()}円/月</option>
                      );
                    })}
                  </select>
                </div>
              )}
              <div className="text-xs text-stone-500 bg-amber-50 rounded px-3 py-2 border border-amber-200">
                {baseupConfig.kind === "type1" ? (
                  <>評価料（Ⅰ）：<span className="font-bold text-amber-700">
                    {baseupConfig.continuity === "continuing"
                      ? `${BASEUP_TYPE1_FEE.continuing.toLocaleString()}円/月`
                      : `${BASEUP_TYPE1_FEE.new.toLocaleString()}円/月`}
                  </span>を月に1回算定</>
                ) : (
                  <>評価料（Ⅱ）区分{baseupConfig.type2Division}：<span className="font-bold text-amber-700">
                    {(() => {
                      const div = baseupConfig.type2Division;
                      const fee = baseupConfig.continuity === "continuing"
                        ? (BASEUP_TYPE2_CONTINUING_FEES_CORRECT[div] ?? BASEUP_TYPE2_NEW_FEES[div])
                        : BASEUP_TYPE2_NEW_FEES[div];
                      return `${fee.toLocaleString()}円/月`;
                    })()}
                  </span>を月に1回算定（ステーション限定）</>
                )}
              </div>
            </>
          )}
        </Section>
      )}
    </div>
  );
}
