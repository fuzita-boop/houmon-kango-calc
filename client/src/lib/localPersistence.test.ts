import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createBackupDocument,
  deletePersistedAppData,
  loadPersistedAppData,
  parseBackup,
  savePersistedAppData,
} from "./localPersistence";
import {
  DEFAULT_BASEUP_CONFIG,
  calculateCare,
  calculatePsychiatric,
  calcCopay,
  defaultCareInput,
  defaultCopayInput,
  defaultInput,
  defaultPreventiveCareInput,
  defaultPsychInput,
  defaultSeishinCopayTracker,
} from "./calcEngine";
import type { PersistedAppData } from "./localPersistence";
import { calcVisitDayResult } from "@/hooks/useVisitStore";

const sampleData: PersistedAppData = {
  schemaVersion: 1,
  savedAt: "2026-08-12T00:00:00.000Z",
  year: 2026,
  month: 8,
  globalInsuranceMode: "psychiatric",
  visitDays: [{
    id: "visit-test-1",
    date: "2026-08-12",
    insuranceMode: "psychiatric",
    medicalInput: { ...defaultInput },
    careInput: { ...defaultCareInput },
    preventiveCareInput: { ...defaultPreventiveCareInput },
    psychInput: { ...defaultPsychInput },
    copayInput: { ...defaultCopayInput },
    seishinCopayTracker: { ...defaultSeishinCopayTracker },
    bukkaTaiouType: "type1",
    medicalBaseupConfig: { ...DEFAULT_BASEUP_CONFIG },
    applyShoguKaizen: false,
  }],
  selectedDate: "2026-08-12",
  patientName: "テスト利用者",
  stationName: "テストステーション",
  globalMedicalInput: { ...defaultInput },
  globalCareInput: { ...defaultCareInput },
  globalPreventiveCareInput: { ...defaultPreventiveCareInput },
  globalPsychInput: { ...defaultPsychInput },
  globalCopayInput: { ...defaultCopayInput },
  globalBukkaTaiouType: "type1",
  globalBaseupConfig: { ...DEFAULT_BASEUP_CONFIG },
  globalApplyShoguKaizen: false,
  homeStep: 4,
};

describe("localPersistence", () => {
  beforeEach(async () => {
    await deletePersistedAppData();
  });

  it("端末内IndexedDBへ保存し、同じ内容を復元できる", async () => {
    await savePersistedAppData(sampleData);
    await expect(loadPersistedAppData()).resolves.toEqual(sampleData);
  });

  it("バージョン付きJSONバックアップを解析できる", () => {
    const backup = createBackupDocument(sampleData);
    expect(parseBackup(backup)).toEqual(sampleData);
  });

  it("不正なバックアップを拒否する", () => {
    expect(() => parseBackup({ format: "other", data: {} })).toThrow("バックアップ");
  });

  it("介護保険の初回加算Ⅰを月1回・350単位で計算する", () => {
    const result = calculateCare({
      ...defaultCareInput,
      initialAdd: true,
      initialAddType: "type1",
    });

    expect(result.items).toContainEqual(expect.objectContaining({
      label: "初回加算（Ⅰ）退院当日の初回訪問",
      amount: 350,
      unit: "単位",
    }));
  });

  it("介護保険の初回加算Ⅱを月1回・300単位で計算する", () => {
    const result = calculateCare({
      ...defaultCareInput,
      initialAdd: true,
      initialAddType: "type2",
    });

    expect(result.items).toContainEqual(expect.objectContaining({
      label: "初回加算（Ⅱ）その他の初回訪問",
      amount: 300,
      unit: "単位",
    }));
  });

  it("精神科訪問看護の物価対応料1を月初日60円で計算する", () => {
    const result = calculatePsychiatric({
      ...defaultPsychInput,
      bukkaTaiou: true,
      isFirstVisitOfMonth: true,
    });

    expect(result.items).toContainEqual(expect.objectContaining({
      label: "訪問看護物価対応料1（月初日60円）",
      amount: 60,
      unit: "円",
    }));
  });

  it("精神科訪問看護の物価対応料1を月2日目以降20円で計算する", () => {
    const result = calculatePsychiatric({
      ...defaultPsychInput,
      bukkaTaiou: true,
      isFirstVisitOfMonth: false,
    });

    expect(result.items).toContainEqual(expect.objectContaining({
      label: "訪問看護物価対応料1（2日目以降20円）",
      amount: 20,
      unit: "円",
    }));
  });

  it("実明細と同じ精神科月初日の条件では物価対応料を重複せず、窓口負担を10円単位で計算する", () => {
    const result = calcVisitDayResult({
      ...sampleData.visitDays[0],
      date: "2026-09-29",
      psychInput: {
        ...defaultPsychInput,
        basicFeeType: "type1",
        visitDuration: "over30",
        weeklyVisitDay: "1-3",
        isFirstVisitOfMonth: true,
        managementFeeType: "standard",
        h24Support: true,
        h24SupportType: "ika",
        infoProvision: true,
        infoProvisionType: "type1",
        bukkaTaiou: true,
      },
      copayInput: {
        ...defaultCopayInput,
        insuranceType: "medical",
        kohiType: "seishin",
      },
      seishinCopayTracker: {
        ...defaultSeishinCopayTracker,
        noLimit: true,
      },
      // 旧設定値が残っていても、月初日60円を重複計上しない。
      bukkaTaiouType: "type1",
    });

    expect(result.totalYen).toBe(21620);
    expect(result.copayAmount).toBe(2160);
    expect(result.bukkaRyo).toBe(60);
    expect(result.breakdown.filter((item) => item.label.includes("物価対応料"))).toEqual([
      expect.objectContaining({ yen: 60 }),
    ]);
  });

  it("医療保険・自立支援医療の自己負担は10円未満を四捨五入する", () => {
    expect(calcCopay(21640, { ...defaultCopayInput, copayRatio: "1" }).amount).toBe(2160);
    expect(calcCopay(21650, { ...defaultCopayInput, copayRatio: "1" }).amount).toBe(2170);
    expect(calcCopay(21620, {
      ...defaultCopayInput,
      kohiType: "seishin",
      kohiIncomeClass: "jyoshotoku",
    }).amount).toBe(2160);
  });

  it("月3回の精神科訪問は月の請求総額38,780円に対して1回だけ端数処理する", () => {
    const monthlyTotal = 21620 + 8580 + 8580;
    const copay = calcCopay(monthlyTotal, {
      ...defaultCopayInput,
      kohiType: "seishin",
      kohiIncomeClass: "jyoshotoku",
    });

    expect(monthlyTotal).toBe(38780);
    expect(copay.amount).toBe(3880);
  });
});
