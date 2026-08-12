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
  defaultCareInput,
  defaultCopayInput,
  defaultInput,
  defaultPreventiveCareInput,
  defaultPsychInput,
  defaultSeishinCopayTracker,
} from "./calcEngine";
import type { PersistedAppData } from "./localPersistence";

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
});
