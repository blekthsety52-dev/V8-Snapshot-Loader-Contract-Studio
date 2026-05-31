/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SnapshotConfig, SimulationPreset } from './types';

// Standard baseline config
export const BASELINE_CONFIG: SnapshotConfig = {
  magic: '56385300', // "V8S\0"
  formatVersion: 3,
  v8Major: 12,
  v8Minor: 4,
  v8Patch: 1,
  flags: {
    strictMode: true,
    embeddedBuiltins: true,
    pointerCompression: true,
    sandboxEnabled: true,
    shortBuiltinCalls: false,
    turbofanEnabled: true,
  },
  numContexts: 1,
  externalRefCount: 5,
  payloadOffset: 64,
  payloadSize: 1048576, // 1MB
  alignment: 4096,
  customSections: [
    { type: 4, name: 'READ_ONLY_SPACE', size: 65536, alignment: 4096, mmapPermission: 'r--' },
    { type: 1, name: 'CODE_SPACE', size: 524288, alignment: 4096, mmapPermission: 'r-x' },
    { type: 2, name: 'MAP_SPACE', size: 131072, alignment: 4096, mmapPermission: 'rw-' },
    { type: 3, name: 'OLD_SPACE', size: 262144, alignment: 4096, mmapPermission: 'rw-' },
    { type: 5, name: 'SHARED_SPACE', size: 32768, alignment: 4096, mmapPermission: 'r--' },
    { type: 6, name: 'LARGE_OBJECT_SPACE', size: 32768, alignment: 4096, mmapPermission: 'rw-' },
  ],
  relocRecords: [
    { sectionIdx: 1, offset: 0x100 },
    { sectionIdx: 1, offset: 0x400 },
    { sectionIdx: 2, offset: 0x200 },
    { sectionIdx: 3, offset: 0x12a0 },
    { sectionIdx: 3, offset: 0x5800 },
  ],
  externalRefs: [
    'v8::internal::Runtime_MathSqrt',
    'v8::internal::Runtime_DateNow',
    'v8::internal::Runtime_StringAdd',
    'v8::internal::Runtime_ObjectKeys',
    'v8::internal::Runtime_ArrayPush',
  ],
  optionalMask: [false, false, true, false, true], // index 2 & 4 are optional (DateNow & ArrayPush)
};

export const SIMULATION_PRESETS: SimulationPreset[] = [
  {
    id: 'clean_v3',
    name: '完全合规快照 (V3)',
    description: '一个完全符合 V3 契约规范、各项参数与 V8 引擎和 Loader 环境高度一致的生产快照。可顺利加载启动。',
    config: BASELINE_CONFIG,
    expectedResult: 'success',
  },
  {
    id: 'corrupt_checksum',
    name: 'TC-A02 校验和不匹配',
    description: '快照哈希数据被修改，文件的 Adler32 校验和与头部记录的值对不上。主要防护文件在链条分发过程的数据损坏。',
    config: {
      ...BASELINE_CONFIG,
      payloadSize: 1048576,
      payloadOffset: 64, // Standard
      // We will flag this during simulation as incorrect checksum
    },
    expectedResult: 'error',
    errorMessage: 'SNAPSHOT_ERR_CHECKSUM: Adler32 checksum validation failed. Received expected 0x5E8B99AE, but real stream computed 0x1F2B4D6C.',
  },
  {
    id: 'magic_mismatch',
    name: 'TC-A01 魔数错误 (Corrupt Header)',
    description: '快照文件头部的前 4 字节魔数不是 "V8S\\0"，而是类似 "DEADBEEF" 的损坏值。通常发生在加载了错误文件格式时。',
    config: {
      ...BASELINE_CONFIG,
      magic: 'DEADBEEF',
    },
    expectedResult: 'error',
    errorMessage: 'SNAPSHOT_ERR_MAGIC: File magic does not match contract specifications. Expected 0x56385300 ("V8S\\0"), got 0xDEADBEEF.',
  },
  {
    id: 'major_mismatch',
    name: 'TC-B01 V8 主版本不一致',
    description: '快照的主版本编译为 V8 v13.x.x，而当前的 runtime 引擎使用的是 V8 v12.x.x。属于硬性拒绝的不兼容矩阵。',
    config: {
      ...BASELINE_CONFIG,
      v8Major: 13,
    },
    expectedResult: 'error',
    errorMessage: 'SNAPSHOT_ERR_V8_MAJOR_MISMATCH: V8 engine major version mismatch. Compiled engine runs on V8 v12.x, but snapshot requires V8 v13.x. Binary objects structure changed drastically.',
  },
  {
    id: 'flags_incompatible',
    name: 'TC-B04 指针压缩标志不匹配',
    description: '快照构建时的 features flag 中的 POINTER_COMPRESSION 为 false，但宿主运行时的 pointer compression 已启用。',
    config: {
      ...BASELINE_CONFIG,
      flags: {
        ...BASELINE_CONFIG.flags,
        pointerCompression: false,
      },
    },
    expectedResult: 'error',
    errorMessage: 'SNAPSHOT_ERR_FLAG_INCOMPATIBLE: Incompatible Pointer Compression flag config. Loader has enabled pointer compression, but snapshot is built with raw 64-bit offsets. Loading this would cause misalignment crashes.',
  },
  {
    id: 'reloc_section_overflow',
    name: 'TC-D01 重定位 Section 索引越界',
    description: '一个设计精良的漏洞快照，其重定位记录的 section_idx 设为了 15，但快照描述符一共有 6 个分区。用于注入或绕过 ASLR 重定位内存。',
    config: {
      ...BASELINE_CONFIG,
      relocRecords: [
        { sectionIdx: 15, offset: 0x1000 }, // Out of range section index
      ],
    },
    expectedResult: 'error',
    errorMessage: 'SNAPSHOT_ERR_RELOC_OVERFLOW: Relocation error. Sec index [15] is out of range. Max valid section index is 5. Caught by sandbox memory safeguard!',
  },
  {
    id: 'reloc_offset_overflow',
    name: 'TC-D02 重定位 Offset 内部溢出',
    description: '重定位位置的 offset 大小，超出了对应 Section 分区所预分配的虚拟内存限制（0x20000 > MAP_SPACE 的 128KB 限制）。会造成内存写入崩溃。',
    config: {
      ...BASELINE_CONFIG,
      relocRecords: [
        { sectionIdx: 2, offset: 0x50000 }, // Offset exceeds 131072 (0x20000)
      ],
    },
    expectedResult: 'error',
    errorMessage: 'SNAPSHOT_ERR_RELOC_OVERFLOW: Relocation offset 0x50000 exceeds target Section MAP_SPACE size 131072 (0x20000). Prevented buffer overflow.',
  },
  {
    id: 'ext_ref_short',
    name: 'TC-C03 宿主外部引用过少',
    description: '快照一共定义并使用了 5 个外部引用符号，但 Loader 接口仅传递了 4 个，将导致部分字节流还原时遇到野空引用指针，后续调用直接崩溃。',
    config: {
      ...BASELINE_CONFIG,
      externalRefCount: 8, // Snapshot claims 8, but loader table only provides 5
    },
    expectedResult: 'error',
    errorMessage: 'SNAPSHOT_ERR_EXT_REF_SHORT: Host external references table is shorter than demanded by snapshot. Snap requires at least 8 symbols, loader only registered 5.',
  },
  {
    id: 'optional_mask_bug',
    name: 'R-08 可选引用位图差一缺陷 (Off-by-one)',
    description: '因为 Loader 边界计算漏掉 ceiling，导致在符号数量为 32 的整数倍时判定失败，或是由于第 32 个引用误判引发 NULL 崩溃。',
    config: {
      ...BASELINE_CONFIG,
      // 32-bit ceiling bug mock
    },
    expectedResult: 'error',
    errorMessage: 'SNAPSHOT_ERR_EXT_REF_NULL: Optional mask off-by-one error encountered. Evaluated non-optional reference as optional, leading to nullptr bypass in engine runtime contexts.',
  }
];
