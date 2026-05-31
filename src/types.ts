/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SnapshotConfig {
  magic: string; // 4 bytes e.g. "56385300"
  formatVersion: number;
  v8Major: number;
  v8Minor: number;
  v8Patch: number;
  flags: {
    strictMode: boolean;
    embeddedBuiltins: boolean;
    pointerCompression: boolean;
    sandboxEnabled: boolean;
    shortBuiltinCalls: boolean;
    turbofanEnabled: boolean;
  };
  numContexts: number;
  externalRefCount: number;
  payloadOffset: number;
  payloadSize: number;
  alignment: number; // For sections (e.g., 8, 4096)
  customSections: SectionData[];
  relocRecords: RelocRecord[];
  externalRefs: string[];
  optionalMask: boolean[]; // bit index corresponds to externalRefs
}

export interface SectionData {
  type: number; // Type enum 1-6
  name: string;
  size: number;
  alignment: number;
  allocatedAddress?: string; // Hex string e.g. "0x7fff12a08000"
  mmapPermission: string; // e.g. "r-x", "rw-"
}

export interface RelocRecord {
  sectionIdx: number;
  offset: number;
  targetAddress?: string;
  currentValue?: string;
}

export type LoaderState =
  | 'UNLOADED'
  | 'LOADING'
  | 'MAPPED'
  | 'BINDING'
  | 'READY'
  | 'IN_USE'
  | 'DISPOSING'
  | 'ERROR';

export interface LoaderStep {
  id: string;
  name: string;
  description: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  log: string[];
}

export interface SimulationPreset {
  id: string;
  name: string;
  description: string;
  config: SnapshotConfig;
  expectedResult: 'success' | 'error';
  errorMessage?: string;
}

export interface TestCase {
  id: string;
  category: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  categoryLabel: string;
  name: string;
  description: string;
  expectedError: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  logs: string[];
  durationMs?: number;
}

export interface RiskPoint {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  triggerCondition: string;
  leakType: string;
  buggyCode: string;
  fixedCode: string;
  explanation: string;
  interactiveChallenge?: string;
}
