/**
 * 完全ローカルPWA用のデータ永続化
 * 方針: 計算データを外部送信せず、端末のIndexedDBだけに保存する。
 */
import type {
  BukkaTaiouType,
  CalcInput,
  CareCalcInput,
  MedicalBaseupConfig,
  PatientCopayInput,
  PreventiveCareCalcInput,
  PsychCalcInput,
  SeishinCopayTracker,
} from "@/lib/calcEngine";

export type LocalInsuranceMode = "medical" | "care" | "preventive" | "psychiatric";

export interface PersistedVisitDay {
  id: string;
  date: string;
  insuranceMode: LocalInsuranceMode;
  medicalInput: CalcInput;
  careInput: CareCalcInput;
  preventiveCareInput: PreventiveCareCalcInput;
  psychInput: PsychCalcInput;
  copayInput: PatientCopayInput;
  seishinCopayTracker: SeishinCopayTracker;
  bukkaTaiouType: BukkaTaiouType;
  medicalBaseupConfig: MedicalBaseupConfig;
  applyShoguKaizen: boolean;
  wasAutoCopied?: boolean;
}

export interface PersistedAppData {
  schemaVersion: 1;
  savedAt: string;
  year: number;
  month: number;
  globalInsuranceMode: LocalInsuranceMode;
  visitDays: PersistedVisitDay[];
  selectedDate: string | null;
  patientName: string;
  stationName: string;
  globalMedicalInput: CalcInput;
  globalCareInput: CareCalcInput;
  globalPreventiveCareInput: PreventiveCareCalcInput;
  globalPsychInput: PsychCalcInput;
  globalCopayInput: PatientCopayInput;
  globalBukkaTaiouType: BukkaTaiouType;
  globalBaseupConfig: MedicalBaseupConfig;
  globalApplyShoguKaizen: boolean;
  homeStep: 1 | 2 | 3 | 4;
}

const DB_NAME = "houmon-kango-calc";
const DB_VERSION = 1;
const STORE_NAME = "app-state";
const APP_STATE_KEY = "current";
const BACKUP_FORMAT = "houmon-kango-calc-backup";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDBを開けませんでした。"));
  });
}

async function readValue<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("IndexedDBの読み込みに失敗しました。"));
    });
  } finally {
    db.close();
  }
}

async function writeValue<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDBへの保存に失敗しました。"));
    });
  } finally {
    db.close();
  }
}

export async function loadPersistedAppData(): Promise<PersistedAppData | null> {
  return readValue<PersistedAppData>(APP_STATE_KEY);
}

export async function savePersistedAppData(data: PersistedAppData): Promise<void> {
  await writeValue(APP_STATE_KEY, data);
}

export async function deletePersistedAppData(): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(APP_STATE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDBの削除に失敗しました。"));
    });
  } finally {
    db.close();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** JSONバックアップの内容を最小限検証して、保存データを返す。 */
export function parseBackup(value: unknown): PersistedAppData {
  const candidate = isRecord(value) && isRecord(value.data) ? value.data : value;
  if (!isRecord(candidate) || !Array.isArray(candidate.visitDays)) {
    throw new Error("このファイルは訪問看護料金計算アプリのバックアップとして認識できません。");
  }
  if (isRecord(value) && value.format !== undefined && value.format !== BACKUP_FORMAT) {
    throw new Error("異なる形式のバックアップファイルです。");
  }
  return candidate as unknown as PersistedAppData;
}

/** バックアップ専用のバージョン付きラッパーを作成する。 */
export function createBackupDocument(data: PersistedAppData) {
  return {
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackup(data: PersistedAppData): void {
  const document = createBackupDocument(data);
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = documentCreateElement("a");
  anchor.href = url;
  anchor.download = `訪問看護料金計算_バックアップ_${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// テスト環境でもDOMがある場合だけ使うため、documentへの依存を呼び出し時に限定する。
function documentCreateElement(tagName: "a"): HTMLAnchorElement {
  return document.createElement(tagName);
}

export async function readBackupFile(file: File): Promise<PersistedAppData> {
  const text = await file.text();
  try {
    return parseBackup(JSON.parse(text));
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("バックアップファイルを読み込めませんでした。");
  }
}

/**
 * 過去の試作版でローカルストレージを使っていた場合に備えた任意移行。
 * 現行版はメモリ保存のみのため、通常はnullを返す。
 */
export function readLegacyLocalStorageData(): PersistedAppData | null {
  if (typeof window === "undefined") return null;
  const keys = ["houmon-kango-calc", "houmon-kango-calc-data", "houmon-kango-calc-state"];
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      return parseBackup(JSON.parse(raw));
    } catch {
      // 他アプリ等の無関係な形式は無視する。
    }
  }
  return null;
}
