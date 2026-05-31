/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { SnapshotConfig } from '../types';
import { BASELINE_CONFIG } from '../presets';
import { Cpu, Binary, CheckCircle, Database, Settings } from 'lucide-react';

interface FieldSpec {
  offset: number;
  size: number;
  name: string;
  description: string;
  color: string;
  textColor: string;
}

export default function BinaryLayoutExplorer() {
  const [config, setConfig] = useState<SnapshotConfig>({ ...BASELINE_CONFIG });
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<string | null>('magic');

  // Convert number to little-endian hex array
  const toHexArray = (num: number, bytesCount: number): string[] => {
    const arr: string[] = [];
    let temp = num;
    for (let i = 0; i < bytesCount; i++) {
      const byte = temp & 0xff;
      arr.push(byte.toString(16).toUpperCase().padStart(2, '0'));
      temp = temp >> 8;
    }
    return arr;
  };

  // Compile flags into a single uint32
  const compiledFlagsValue = useMemo(() => {
    let flagVal = 0;
    if (config.flags.strictMode) flagVal |= 1 << 0;
    if (config.flags.embeddedBuiltins) flagVal |= 1 << 1;
    if (config.flags.pointerCompression) flagVal |= 1 << 2;
    if (config.flags.sandboxEnabled) flagVal |= 1 << 3;
    if (config.flags.shortBuiltinCalls) flagVal |= 1 << 4;
    if (config.flags.turbofanEnabled) flagVal |= 1 << 5;
    return flagVal;
  }, [config.flags]);

  // Headers fields lookup
  const FIELDS_MAPPING: FieldSpec[] = [
    { offset: 0, size: 4, name: 'magic', description: '4字节特殊魔数 "V8S\\0"，用于快速判断文件类型是否为符合本规范的快照。', color: 'bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500', textColor: 'text-indigo-400' },
    { offset: 4, size: 4, name: 'format_version', description: '快照格式序列化版本。当前为 V3 版本，向下游演进时该数字会增加。', color: 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500', textColor: 'text-amber-400' },
    { offset: 8, size: 4, name: 'v8_version_major', description: 'V8 引擎主版本号。不一致时 Loader 强制终止初始化，防止指针压缩计算偏移导致崩溃。', color: 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500', textColor: 'text-emerald-400' },
    { offset: 12, size: 4, name: 'v8_version_minor', description: 'V8 引擎次版本号。允许有轻微差异但在检测到之后 Loader 会输出运行时警告。', color: 'bg-teal-500/20 hover:bg-teal-500/30 border-teal-500', textColor: 'text-teal-400' },
    { offset: 16, size: 4, name: 'v8_version_patch', description: 'V8 引擎修正补丁号。完全向下兼容。', color: 'bg-cyan-500/20 hover:bg-cyan-500/30 border-cyan-500', textColor: 'text-cyan-400' },
    { offset: 20, size: 4, name: 'flags', description: '32位构建标志合并整型。包括严格模式、嵌入式Builtins、指针压缩、沙箱及优化等。', color: 'bg-pink-500/20 hover:bg-pink-500/30 border-pink-500', textColor: 'text-pink-400' },
    { offset: 24, size: 4, name: 'num_contexts', description: '保存反序列化后要恢复的 Context 数量。', color: 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-500', textColor: 'text-purple-400' },
    { offset: 28, size: 4, name: 'section_count', description: '分区总个数，即本快照内封存的 V8 命名堆块数。当前为 6 个合法分区。', color: 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500', textColor: 'text-rose-400' },
    { offset: 32, size: 4, name: 'payload_offset', description: '数据载荷在文件内部的初始字节绝对偏移量。自 0x40 起。', color: 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-500', textColor: 'text-sky-400' },
    { offset: 36, size: 4, name: 'payload_size', description: '核心堆数据 Payload 除去文件头的真实占位总长（以字节计）。', color: 'bg-violet-500/20 hover:bg-violet-500/30 border-violet-500', textColor: 'text-violet-400' },
    { offset: 40, size: 4, name: 'checksum', description: '除头部外 Payload 区域数据的 Alder32 校验和。用以保证加载前非被破坏截断。', color: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500', textColor: 'text-blue-400' },
    { offset: 44, size: 4, name: 'reloc_table_offset', description: '重定位表的段内相对起始偏移量。', color: 'bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border-fuchsia-500', textColor: 'text-fuchsia-400' },
    { offset: 48, size: 4, name: 'reloc_table_size', description: '重定位表的大小（记录总大小 = 描述个数 * 8字节/条）。', color: 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500', textColor: 'text-orange-400' },
    { offset: 52, size: 4, name: 'external_ref_count', description: '当前快照运行所需依赖的主代 C++ 指针外部函数列表句柄个数。', color: 'bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500', textColor: 'text-indigo-400' },
    { offset: 56, size: 8, name: 'reserved', description: '空白自补齐物理填充区，必须均为 0，为后续 V4/V5 系列引入扩充字段提供不影响对齐的保留。', color: 'bg-slate-800 hover:bg-slate-700 border-slate-700', textColor: 'text-slate-500' }
  ];

  const getFieldOfOffset = (offset: number) => {
    return FIELDS_MAPPING.find(f => offset >= f.offset && offset < f.offset + f.size);
  };

  // Build the complete 64-byte binary array
  const compiledBytes = useMemo(() => {
    const bytes = new Array(64).fill('00');
    
    // Magic: 56 38 53 00
    // Try to parse input magic
    const m = config.magic === 'DEADBEEF' ? [0xDE, 0xAD, 0xBE, 0xEF] : [0x56, 0x38, 0x53, 0x00];
    m.forEach((b, i) => { bytes[0 + i] = b.toString(16).toUpperCase().padStart(2, '0'); });

    // Format Version
    toHexArray(config.formatVersion, 4).forEach((b, i) => { bytes[4 + i] = b; });

    // V8 Major
    toHexArray(config.v8Major, 4).forEach((b, i) => { bytes[8 + i] = b; });

    // V8 Minor
    toHexArray(config.v8Minor, 4).forEach((b, i) => { bytes[12 + i] = b; });

    // V8 Patch
    toHexArray(config.v8Patch, 4).forEach((b, i) => { bytes[16 + i] = b; });

    // Flags
    toHexArray(compiledFlagsValue, 4).forEach((b, i) => { bytes[20 + i] = b; });

    // Num Contexts
    toHexArray(config.numContexts, 4).forEach((b, i) => { bytes[24 + i] = b; });

    // Section Count
    toHexArray(config.customSections.length, 4).forEach((b, i) => { bytes[28 + i] = b; });

    // Payload Offset
    toHexArray(config.payloadOffset, 4).forEach((b, i) => { bytes[32 + i] = b; });

    // Payload Size
    toHexArray(config.payloadSize, 4).forEach((b, i) => { bytes[36 + i] = b; });

    // Checksum: e.g. 0x5E8B99AE to visual Little-Endian Byte
    toHexArray(0x5E8B99AE, 4).forEach((b, i) => { bytes[40 + i] = b; });

    // Reloc table offset
    toHexArray(config.payloadSize - 2048, 4).forEach((b, i) => { bytes[44 + i] = b; });

    // Reloc table size
    toHexArray(config.relocRecords.length * 8, 4).forEach((b, i) => { bytes[48 + i] = b; });

    // External Ref Count
    toHexArray(config.externalRefCount, 4).forEach((b, i) => { bytes[52 + i] = b; });

    // Reserved (zeros)
    toHexArray(0, 8).forEach((b, i) => { bytes[56 + i] = b; });

    return bytes;
  }, [config, compiledFlagsValue]);

  const activeField = FIELDS_MAPPING.find(f => f.name === (hoveredField || selectedField));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Parameters Panel */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Settings className="w-5 h-5 text-indigo-400" />
          <h3 className="font-display font-semibold text-md text-slate-100">配置头部段参数 (Producer Setup)</h3>
        </div>

        {/* Binary Config inputs */}
        <div className="space-y-4 text-xs">
          {/* Magic Custom Mock Toggle */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">文件魔数 (Header Magic)</label>
            <select
              value={config.magic}
              onChange={(e) => setConfig({ ...config, magic: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 p-2 text-indigo-300 font-mono rounded"
            >
              <option value="56385300">0x56385300 (&quot;V8S\0&quot;) [标准合规]</option>
              <option value="DEADBEEF">0xDEADBEEF [破坏性损坏包]</option>
            </select>
          </div>

          {/* V8 engine version selectors */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">V8 Major</label>
              <input
                type="number"
                value={config.v8Major}
                onChange={(e) => setConfig({ ...config, v8Major: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 p-2 text-slate-200 font-mono rounded"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">V8 Minor</label>
              <input
                type="number"
                value={config.v8Minor}
                onChange={(e) => setConfig({ ...config, v8Minor: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 p-2 text-slate-200 font-mono rounded"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">V8 Patch</label>
              <input
                type="number"
                value={config.v8Patch}
                onChange={(e) => setConfig({ ...config, v8Patch: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 p-2 text-slate-200 font-mono rounded"
              />
            </div>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">格式描述版本</label>
              <input
                type="number"
                value={config.formatVersion}
                min={1}
                max={5}
                onChange={(e) => setConfig({ ...config, formatVersion: parseInt(e.target.value) || 3 })}
                className="w-full bg-slate-950 border border-slate-800 p-2 text-amber-400 font-mono rounded"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Context 计数</label>
              <input
                type="number"
                value={config.numContexts}
                onChange={(e) => setConfig({ ...config, numContexts: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-950 border border-slate-800 p-2 text-slate-200 font-mono rounded"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">外部引用总数(Refs)</label>
              <input
                type="number"
                value={config.externalRefCount}
                onChange={(e) => setConfig({ ...config, externalRefCount: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-800 p-2 text-slate-200 font-mono rounded"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">快照堆大小 (字节)</label>
              <input
                type="number"
                step="1024"
                value={config.payloadSize}
                onChange={(e) => setConfig({ ...config, payloadSize: parseInt(e.target.value) || 1048576 })}
                className="w-full bg-slate-950 border border-slate-800 p-2 text-slate-200 font-mono rounded"
              />
            </div>
          </div>

          {/* Bits Toggles */}
          <div className="space-y-2 bg-slate-950 p-4 border border-slate-800 rounded-lg">
            <h4 className="text-stone-300 font-mono font-medium text-xs mb-2 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
              <Binary className="w-3.5 h-3.5 text-indigo-400" />
              特征标志位 (Compiled Flags): 0x{compiledFlagsValue.toString(16).toUpperCase().padStart(8, '0')}
            </h4>
            
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <label className="flex items-center space-x-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.flags.strictMode}
                  onChange={(e) => setConfig({
                    ...config,
                    flags: { ...config.flags, strictMode: e.target.checked }
                  })}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-900"
                />
                <span>Strict Mode</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.flags.embeddedBuiltins}
                  onChange={(e) => setConfig({
                    ...config,
                    flags: { ...config.flags, embeddedBuiltins: e.target.checked }
                  })}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-900"
                />
                <span>Builtins 已嵌入</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.flags.pointerCompression}
                  onChange={(e) => setConfig({
                    ...config,
                    flags: { ...config.flags, pointerCompression: e.target.checked }
                  })}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-900"
                />
                <span className="text-emerald-400 font-medium">指针压缩 (PC)</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.flags.sandboxEnabled}
                  onChange={(e) => setConfig({
                    ...config,
                    flags: { ...config.flags, sandboxEnabled: e.target.checked }
                  })}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-900"
                />
                <span>沙箱 (Sandbox)</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.flags.shortBuiltinCalls}
                  onChange={(e) => setConfig({
                    ...config,
                    flags: { ...config.flags, shortBuiltinCalls: e.target.checked }
                  })}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-900"
                />
                <span>短调用优化</span>
              </label>

              <label className="flex items-center space-x-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.flags.turbofanEnabled}
                  onChange={(e) => setConfig({
                    ...config,
                    flags: { ...config.flags, turbofanEnabled: e.target.checked }
                  })}
                  className="rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-900"
                />
                <span>TurboFan 已配置</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Hex Stream Visualizer Panel */}
      <div className="lg:col-span-12 xl:col-span-7 bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-indigo-400 animate-pulse" />
            <h3 className="font-display font-semibold text-md text-slate-100">
              快照二进制头部 Hex 视图 (64位段)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950 border border-indigo-800 px-2 py-0.5 rounded uppercase">
            Offset Matrix Read Target
          </span>
        </div>

        {/* The Hex Grid View */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 space-y-4">
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs border border-slate-800 select-none">
              {/* HEX Grid Address indexes */}
              <div className="grid grid-cols-9 gap-1 text-slate-500 mb-2 border-b border-slate-800 pb-1.5 text-center text-[10px]">
                <div className="text-left font-bold pl-0.5">Addr</div>
                <div>0x0/8</div>
                <div>0x1/9</div>
                <div>0x2/A</div>
                <div>0x3/B</div>
                <div>0x4/C</div>
                <div>0x5/D</div>
                <div>0x6/E</div>
                <div>0x7/F</div>
              </div>

              {/* Rows of 8 bytes */}
              <div className="space-y-1.5">
                {Array.from({ length: 8 }).map((_, rowIndex) => {
                  const startOffset = rowIndex * 8;
                  const addrHex = `0x${startOffset.toString(16).toUpperCase().padStart(2, '0')}`;
                  
                  return (
                    <div key={rowIndex} className="grid grid-cols-9 gap-1 items-center text-center">
                      <div className="text-left text-slate-600 font-bold text-[10.5px] font-mono pr-1">{addrHex}</div>
                      {Array.from({ length: 8 }).map((_, byteIdx) => {
                        const currentOffset = startOffset + byteIdx;
                        const byteVal = compiledBytes[currentOffset] || '00';
                        const spec = getFieldOfOffset(currentOffset);
                        const isHovered = hoveredField === spec?.name;
                        const isSelected = selectedField === spec?.name;

                        return (
                          <div
                            key={byteIdx}
                            onMouseEnter={() => spec && setHoveredField(spec.name)}
                            onMouseLeave={() => setHoveredField(null)}
                            onClick={() => spec && setSelectedField(spec.name)}
                            className={`
                              py-1.5 text-[11px] font-mono font-medium rounded border cursor-pointer transition-all duration-150
                              ${spec ? spec.color : 'text-slate-700 bg-slate-950 border-transparent'}
                              ${isHovered ? 'scale-105 border-white text-white font-semibold shadow shadow-indigo-500/10' : ''}
                              ${isSelected ? 'border-indigo-400 font-bold scale-102 ring-1 ring-indigo-500/30' : 'border-transparent'}
                            `}
                            title={spec?.name || 'Empty'}
                          >
                            {byteVal}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-2 text-slate-500 text-[10.5px]">
              <Database className="w-3.5 h-3.5" />
              <span>注: 鼠标移动到 Hex 矩阵高亮区块，可以观察各字段解构细节。数据是根据当前参数自动组装的小端序(Little-Endian)二进制码流。</span>
            </div>
          </div>

          {/* Details Column based on selection/hover */}
          <div className="md:col-span-4 flex flex-col justify-between">
            {activeField ? (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 mb-2">
                    <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded capitalize ${activeField.color}`}>
                      {activeField.name}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400">
                    <div className="flex justify-between font-mono">
                      <span>文件头起始偏:</span>
                      <span className="text-slate-200">0x{activeField.offset.toString(16).toUpperCase().padStart(2, '0')}</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>字段占位符:</span>
                      <span className="text-slate-200">{activeField.size} 字节</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed mt-3 border-t border-slate-800/60 pt-3">
                    {activeField.description}
                  </p>
                </div>

                {/* Live Value evaluation */}
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 mt-3">
                  <span className="text-[10px] text-stone-500 font-mono block">当前计算载体值:</span>
                  <div className="font-mono text-xs text-indigo-400 mt-1 truncate">
                    {activeField.name === 'magic' && (config.magic === '56385300' ? '0x56385300 ("V8S\\0")' : '0xDEADBEEF ("DEADBEEF")')}
                    {activeField.name === 'format_version' && `${config.formatVersion} (API V3)`}
                    {activeField.name === 'v8_version_major' && `${config.v8Major} (引擎主版本)`}
                    {activeField.name === 'v8_version_minor' && `${config.v8Minor} (引擎次版本)`}
                    {activeField.name === 'v8_version_patch' && `${config.v8Patch} (补丁编号)`}
                    {activeField.name === 'flags' && `0x${compiledFlagsValue.toString(16).toUpperCase().padStart(8, '0')} (标志位)`}
                    {activeField.name === 'num_contexts' && `${config.numContexts} context`}
                    {activeField.name === 'section_count' && `${config.customSections.length} 个堆内存分区`}
                    {activeField.name === 'payload_offset' && `${config.payloadOffset} (对齐 64-byte)`}
                    {activeField.name === 'payload_size' && `${config.payloadSize} 字节 (${(config.payloadSize / 1024).toFixed(0)} KB)`}
                    {activeField.name === 'checksum' && '0x5E8B99AE (Adler32)'}
                    {activeField.name === 'reloc_table_offset' && `${config.payloadSize - 2048} (相对位置)`}
                    {activeField.name === 'reloc_table_size' && `${config.relocRecords.length * 8} 字节 (${config.relocRecords.length} 条记录)`}
                    {activeField.name === 'external_ref_count' && `${config.externalRefCount} 依赖符号`}
                    {activeField.name === 'reserved' && '0x0000000000000000 (保留补位)'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-805 rounded-lg p-4 flex flex-col justify-center items-center text-center text-slate-500 h-full text-xs">
                <span>请点击或者悬停在左侧一个 Hex 二进制分节，获取参数流的深度详情。</span>
              </div>
            )}
          </div>
        </div>

        {/* Render sections block */}
        <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/40 text-xs">
          <h4 className="font-semibold text-slate-200 mb-3 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 animate-pulse" />
            已封装内存区块映射 (Payload Sections Structure):
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {config.customSections.map((sec, idx) => (
              <div key={idx} className="bg-slate-900 p-2.5 rounded border border-slate-800 text-center font-mono">
                <span className="text-[9px] text-indigo-400 block mb-0.5">TYPE {sec.type}</span>
                <span className="text-slate-200 text-[10.5px] block font-semibold truncate" title={sec.name}>{sec.name}</span>
                <span className="text-[10px] text-slate-500 block mt-1">{(sec.size / 1024).toFixed(0)}KB | {sec.mmapPermission}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
