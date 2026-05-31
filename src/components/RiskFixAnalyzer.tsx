/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RiskPoint } from '../types';
import { ShieldAlert, AlertCircle, CheckCircle, HelpCircle, Code, Award, Check } from 'lucide-react';

const RISK_POINTS_DATA: RiskPoint[] = [
  {
    id: 'R-01',
    title: '外部引用表顺序变更引入静默崩溃 (Silent Symbol Drift)',
    severity: 'Critical',
    triggerCondition: '在 C++ 表中间插入、删除新引用或修改符号排序。',
    leakType: '堆内存无序错乱 / 崩溃',
    buggyCode: `// ❌ 错误做法：直接使用硬编码的索引作为引用数组地址映射
intptr_t address = host_references.refs[serialized_idx];
v8::Local<v8::Function> fn = bind_builtin(address); // 索引偏置对不上导致执行混淆`,
    fixedCode: `//  正确做法：引入 FNV-1a 哈希或字符串映射表校验 (V3 规范协议)
struct ExternalRefEntry {
    uint64_t name_hash;    // 符号名的 64-bit 哈希值 (例如 FNV-1a)
    intptr_t address;      // 实际宿主 C++ 函数句柄地址
};

// Loader 进行符号哈希高效率检索排序绑定，对不齐直接降级拒绝
intptr_t resolve_by_hash(uint64_t hash, ExternalRefEntry* host_table, size_t count) {
    for (size_t i = 0; i < count; i++) {
        if (host_table[i].name_hash == hash) return host_table[i].address;
    }
    return 0; // 找不到触发错误，防止野执行
}`,
    explanation: '由于快照只登记索引（0, 1, 2...），团队往数组前部插入新 C++ 绑定时，旧快照文件仍在按旧版索引查找，将一个 MathSqrt 误调用成 ObjectDelete，会引发严重执行违规或特权绕过。'
  },
  {
    id: 'R-03',
    title: '地址 Relocation 越界访问漏洞 (Section Index Overflow)',
    severity: 'Critical',
    triggerCondition: 'Reloc Record 的 section_idx 超过了 sections->count 总长度。',
    leakType: '沙箱崩溃与内存任意写入 (ASLR 逃导/越权)',
    buggyCode: `// ❌ 脆弱代码：未校验 section 边界直接执行内存写指针修正
intptr_t* ptr_slot = (intptr_t*)(sections[r->section_idx].base + r->offset);
*ptr_slot += base_delta; // 直接向任意未经分配/未对齐虚拟地址写入指针字节`,
    fixedCode: `//  加固方案：严格对 Section 索引以及 Offset 边界进行双重卫锁校验
SnapshotError apply_relocations(SectionMap* sections, const RelocRecord* table, uint32_t count) {
    for (uint32_t i = 0; i < count; i++) {
        const RelocRecord* r = &table[i];
        
        // 1. Section 索引边界阻击
        if (r->section_idx >= sections->count) {
            LOG_ERROR("reloc[%u]: section_idx %u overflows", i, r->section_idx);
            return SNAPSHOT_ERR_RELOC_OVERFLOW;
        }
        
        Section* sec = &sections->items[r->section_idx];
        
        // 2. Section 内部 Offset 双向指针卫锁
        if ((uint64_t)r->offset + sizeof(intptr_t) > sec->size) {
            LOG_ERROR("reloc[%u]: offset %u exceeds max size", i, r->offset);
            return SNAPSHOT_ERR_RELOC_OVERFLOW;
        }
        
        intptr_t* ptr_slot = (intptr_t*)(sec->base + r->offset);
        *ptr_slot += sec->base_delta;
    }
    return SNAPSHOT_OK;
}`,
    explanation: '若恶意/不合规快照修改了 reloc_table_offset，利用溢出的 section_idx 可将宿主分配的重定位基址累加并写入代码段外的任意非安全内存，防备此项是 V8 沙箱防御方案的重点契约。'
  },
  {
    id: 'R-08',
    title: '可选引用位图 (optional_mask) 差一边界缺陷',
    severity: 'Medium',
    triggerCondition: '当外部引用总数恰为 32 的整数倍时 (例如 32、64、96)。',
    leakType: '堆空指针解引用 (nullptr dereference)',
    buggyCode: `// ❌ 差一漏洞：直接向下整除，导致计算字长度遗漏边界
uint32_t word_count = ext_ref_count / 32; 
// 若 count=33，结果为 1 字 (遗漏了第 33 项导致第 33 项可选配置无法读取崩溃)`,
    fixedCode: `//  修复方案：采用向上取整除算或位移补正
uint32_t word_count = (ext_ref_count + 31) / 32; // 向上取整

// 或更高效的位运算判定
uint32_t word_count = (ext_ref_count >> 5) + ((ext_ref_count & 31) ? 1 : 0);`,
    explanation: '如果引用数正好是 33，整除计算出的 bits word 为 1，最后一个外部配置将从不可达堆地址检索导致被判断为 non-optional，在 Loader 中引发严重 nullptr 解引用。'
  },
  {
    id: 'R-05',
    title: '多 Isolate 依存场景下 Snapshot Blob 过早物理释放',
    severity: 'High',
    triggerCondition: 'Loader 初始化多线程 Isolate，不按顺序释放宿主 handle。',
    leakType: '悬挂指针 / Use-after-Free',
    buggyCode: `// ❌ 粗糙做法：直接调用 unload，忽视仍在宿主虚拟机中存续的 isolates
void snapshot_loader_unload(SnapshotLoader_t* l) {
    munmap(l->blob_base, l->blob_size); // 仍在后台运行的 isolate 执行 GC 时直接崩溃
}`,
    fixedCode: `//  正确做法：内置原子引用计数 (std::atomic<uint32_t> refcount)
SnapshotError snapshot_loader_unload(SnapshotLoaderHandle handle) {
    if (handle->ref_count.load() > 0) {
        LOG_WARN("Cannot unload. There are %zu live isolates depending.", handle->ref_count);
        return SNAPSHOT_ERR_BUSY; // 阻止过早释放
    }
    
    // 安全移除物理页映射
    munmap(handle->blob_base, handle->blob_size);
    return SNAPSHOT_OK;
}`,
    explanation: '每个基于此快照生成的 Isolate 并不复制其只读物理内存，而是共享 mapped 只读物理空间。粗糙卸载会使得虚拟物理页面成为孤儿页，并在下个 VM 扫描指令段触发 SIGSEGV 崩溃。'
  }
];

export default function RiskFixAnalyzer() {
  const [selectedRiskId, setSelectedRiskId] = useState<string>('R-08');
  const [activeCodeTab, setActiveCodeTab] = useState<'buggy' | 'fixed'>('fixed');
  
  // R-08 Math Interactive config
  const [mathRefCount, setMathRefCount] = useState<number>(33);

  const activeRisk = RISK_POINTS_DATA.find(r => r.id === selectedRiskId) || RISK_POINTS_DATA[0];

  // formulas
  const buggyWordCount = Math.floor(mathRefCount / 32);
  const fixedWordCount = Math.floor((mathRefCount + 31) / 32);
  const hasVulnerability = buggyWordCount !== fixedWordCount;

  return (
    <div className="space-y-6">
      {/* Risk list header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h4 className="font-display font-semibold text-slate-100 text-md flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
              1. 契约缺陷清单 (Vulnerabilities)
            </h4>
            <p className="text-slate-400 text-xs mt-1">
              通过在下方选择存在风险的 Loader 实现环节，可以直观观察和测试规避底层 C++ 实现漏洞时的逻辑。
            </p>
          </div>

          <div className="space-y-2">
            {RISK_POINTS_DATA.map((risk) => {
              const isSelected = risk.id === selectedRiskId;
              
              return (
                <div
                  key={risk.id}
                  onClick={() => setSelectedRiskId(risk.id)}
                  className={`
                    p-3 rounded-lg border text-left cursor-pointer transition select-none
                    ${isSelected ? 'bg-indigo-950 border-indigo-700 text-indigo-200' : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'}
                  `}
                >
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <span className="font-semibold text-indigo-400">{risk.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                      risk.severity === 'Critical' ? 'bg-rose-950 text-rose-400 border border-rose-900' :
                      risk.severity === 'High' ? 'bg-orange-950 text-orange-400 border border-orange-900' :
                      'bg-amber-950 text-amber-400 border border-amber-900'
                    }`}>
                      {risk.severity} Severity
                    </span>
                  </div>
                  <h5 className="font-sans text-[11.5px] font-medium truncate text-slate-200">{risk.title}</h5>
                </div>
              );
            })}
          </div>

          {/* Educational notice */}
          <div className="bg-slate-950 p-4 border border-dashed border-slate-800 rounded-lg text-xs leading-relaxed text-indigo-300">
            <Award className="w-4.5 h-4.5 text-indigo-400 mb-1" />
            <span className="font-medium text-slate-200 block">安全校验与契约</span>
            开发安全 JavaScript 沙箱的核心在于宿主（C++）与虚拟机代码的严格物理防线契约。Loader 层哪怕一个 bit 校验疏忽都相当于把系统 Root 权限交付给远程恶意注入快照。
          </div>
        </div>

        {/* Detailed Code Diff Panel */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-6">
          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[520px]">
            {/* Header tabs */}
            <div className="bg-slate-900 px-5 py-3 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Code className="w-4.5 h-4.5 text-indigo-400" />
                <span className="font-mono text-xs font-semibold text-slate-200">
                  对比修复实现 (Loader Codework diff: {activeRisk.id})
                </span>
              </div>

              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono select-none">
                <button
                  onClick={() => setActiveCodeTab('buggy')}
                  className={`px-3 py-1.5 rounded transition ${activeCodeTab === 'buggy' ? 'bg-rose-950 text-rose-400 border border-rose-900/40 font-semibold' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  漏洞实现 (Vulnerable)
                </button>
                <button
                  onClick={() => setActiveCodeTab('fixed')}
                  className={`px-3 py-1.5 rounded transition ${activeCodeTab === 'fixed' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40 font-semibold' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  修复加固 (Patched)
                </button>
              </div>
            </div>

            {/* Code content */}
            <div className="flex-1 p-5 overflow-y-auto font-mono text-[11px] bg-slate-950 space-y-4 scrollbar">
              <div className="bg-slate-900 p-3 rounded-lg border border-indigo-900/20 text-indigo-300 leading-relaxed text-xs font-sans">
                <span className="font-semibold text-slate-200 block mb-1">风险激发场景:</span>
                {activeRisk.explanation}
                <div className="mt-2 text-rose-400 font-mono text-[10.5px]">
                  <strong>异常爆破条件:</strong> {activeRisk.triggerCondition} | <strong>致灾效应:</strong> {activeRisk.leakType}
                </div>
              </div>

              <pre className={`p-4 rounded-lg border font-mono text-[10.5px] leading-relaxed overflow-x-auto scrollbar ${
                activeCodeTab === 'buggy' ? 'bg-rose-950/10 border-rose-900/30 text-rose-300' : 'bg-emerald-950/10 border-emerald-903/30 text-emerald-300'
              }`}>
                {activeCodeTab === 'buggy' ? activeRisk.buggyCode : activeRisk.fixedCode}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* R-08 Math Ceiling Interactive Playground Card */}
      {selectedRiskId === 'R-08' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <AlertCircle className="w-5 h-5 text-amber-400 animate-bounce" />
            <span className="font-display font-semibold text-slate-200 text-sm">
              交互计算演练：R-08 optional_mask 差一整除漏洞
            </span>
          </div>

          <p className="text-xs text-slate-400">
            滑动修改下方的<strong>外部引用数量 (External References Count)</strong>。当数值落在 32 的整数倍边界（例如 32、64...）时，或者是多出一个引用（33）时，由于 Buggy 算式漏算 Ceiling 导致的溢出漏写空间。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Range slider */}
            <div className="md:col-span-4 bg-slate-950 p-4 border border-slate-800 rounded-lg space-y-3">
              <label className="font-mono text-xs text-slate-300 block">
                外部引用长度 (ext_ref_count): <span className="text-amber-400 font-bold text-sm ml-2">{mathRefCount}</span>
              </label>
              <input
                type="range"
                min={1}
                max={128}
                value={mathRefCount}
                onChange={(e) => setMathRefCount(parseInt(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 block">在 C++ 结构中，1 bit 对应一个引用可选标志位。1 个 Word 能够容纳 32 位的 bits。</span>
            </div>

            {/* Calculations boxes */}
            <div className="md:col-span-8 grid grid-cols-2 gap-4">
              {/* Buggy formula calculation */}
              <div className="bg-rose-950/10 border border-rose-900/30 rounded-lg p-4 font-mono text-center space-y-1">
                <span className="text-[10.5px] text-rose-400 font-bold block mb-1">❌ 漏洞算式 (Buggy code / 32)</span>
                <span className="text-[11px] text-slate-400 block">{mathRefCount} / 32</span>
                <span className="text-2xl font-bold text-rose-400 block">{buggyWordCount} 个 Words</span>
                <span className="text-[10px] text-slate-500 block">分配 Word 大小 (缺口: {fixedWordCount - buggyWordCount} byte-blocks)</span>
              </div>

              {/* Fixed Formula calculation */}
              <div className="bg-emerald-950/10 border border-emerald-900/30 rounded-lg p-4 font-mono text-center space-y-1">
                <span className="text-[10.5px] text-emerald-400 font-bold block mb-1 flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  加固算式 (Ceiling patch code)
                </span>
                <span className="text-[11px] text-slate-400 block">({mathRefCount} + 31) / 32</span>
                <span className="text-2xl font-bold text-emerald-400 block">{fixedWordCount} 个 Words</span>
                <span className="text-[10px] text-slate-500 block">分配分配对齐字节，完美包含标志位。</span>
              </div>
            </div>
          </div>

          {hasVulnerability ? (
            <div className="bg-rose-950/30 border border-rose-900 text-rose-300 p-3 rounded-lg text-xs leading-relaxed flex items-center space-x-2 animate-pulse font-mono">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 animate-spin text-rose-400" />
              <span>
                <strong>触发漏洞：</strong> 发生逻辑残障！在引用数为 {mathRefCount} 时，漏洞代码仅分配 {buggyWordCount} 个位 Word 阻断区，但 V8 内部反序列化会继续向第 {fixedWordCount} 个无效越权空间寻址。这导致
                <strong className="text-white ml-1">直接内存穿孔及空指针崩溃！</strong>
              </span>
            </div>
          ) : (
            <div className="bg-emerald-950/30 border border-emerald-900 text-emerald-300 p-3 rounded-lg text-xs leading-relaxed flex items-center space-x-2 font-mono">
              <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>
                <strong>当前位置安全：</strong> 在引用数为 {mathRefCount} 时，分配恰好在 32 字长完整重叠区间。对齐良好，不触发差一溢出路径。
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
