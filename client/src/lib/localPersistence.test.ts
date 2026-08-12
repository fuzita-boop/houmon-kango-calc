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
});
