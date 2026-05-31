/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { SIMULATION_PRESETS } from '../presets';
import { SimulationPreset, LoaderState } from '../types';
import { Play, RotateCcw, AlertTriangle, Terminal, Cpu, Database, CheckCircle, Flame, Layers } from 'lucide-react';

interface LogMessage {
  type: 'info' | 'debug' | 'warn' | 'error' | 'success';
  text: string;
}

export default function LoaderSimulator() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('clean_v3');
  const [loaderState, setLoaderState] = useState<LoaderState>('UNLOADED');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [memoryPages, setMemoryPages] = useState<{ name: string; base: string; size: string; perm: string; status: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const activePreset = SIMULATION_PRESETS.find(p => p.id === selectedPresetId) || SIMULATION_PRESETS[0];

  // Define the 11 step pipeline for simulation
  const PIPELINE_STEPS = [
    { id: 'binary_read', name: '1. 二进制读取', desc: '读取或mmap()映射文件' },
    { id: 'magic_check', name: '2. 魔数位校验', desc: '验证 0x56385300 (V8S\\0)' },
    { id: 'version_check', name: '3. 引擎版本比对', desc: '核对V8及快照编译版本' },
    { id: 'checksum', name: '4. Checksum验证', desc: '对Payload计算Adler32校验和' },
    { id: 'mmap_align', name: '5. 页面空间对齐', desc: '按Section对齐4KB规范映射内存' },
    { id: 'protect_pages', name: '6. 配置属性隔离', desc: '隔离只读(r--)与代码执行(r-x)' },
    { id: 'relocate', name: '7. 地址指针重定位', desc: 'ASLR下的内部物理地址重定位修复' },
    { id: 'ext_resolve', name: '8. 宿主符号指针绑定', desc: '绑定C++ Host API回调函数' },
    { id: 'isolate_init', name: '9. Isolate 创建', desc: '构建 v8::Isolate 容器' },
    { id: 'context_restore', name: '10. JS虚拟域恢复', desc: '载入并反序列化JS Context' },
    { id: 'isolate_ready', name: '11. 就绪通知 (IN_USE)', desc: '通知JS引擎可以执行应用' }
  ];

  useEffect(() => {
    resetSimulation();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [selectedPresetId]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (type: 'info' | 'debug' | 'warn' | 'error' | 'success', text: string) => {
    setLogs(prev => [...prev, { type, text }]);
  };

  const resetSimulation = () => {
    setIsPlaying(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setLoaderState('UNLOADED');
    setCurrentStepIndex(-1);
    setLogs([
      { type: 'info', text: 'System diagnostic offline. Ready to boot V8 snapshot loader.' },
      { type: 'debug', text: `Selected preset: ${activePreset.name}. Ready to verify.` }
    ]);
    setMemoryPages([]);
  };

  const handleStepForward = () => {
    if (loaderState === 'ERROR' || loaderState === 'IN_USE') {
      return;
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= PIPELINE_STEPS.length) {
      return;
    }

    setCurrentStepIndex(nextIndex);
    executeStepLogic(nextIndex);
  };

  const executeStepLogic = (stepIndex: number) => {
    const step = PIPELINE_STEPS[stepIndex];
    if (!step) return;

    // Transition state
    if (stepIndex === 0) setLoaderState('LOADING');

    addLog('info', `>>> [STEP ${stepIndex + 1}/11] Starting: ${step.name} - ${step.desc}`);

    // Simulation logic per step:
    setTimeout(() => {
      switch (step.id) {
        case 'binary_read':
          addLog('debug', 'mmap() system call requested on snapshot file handle...');
          addLog('success', 'File mapped successfully to virtual address space range 0x7fff12000000 - 0x7fff12100000.');
          break;

        case 'magic_check':
          addLog('debug', 'Fetching first 4 bytes of stream...');
          if (activePreset.config.magic !== '56385300') {
            addLog('error', `SNAPSHOT_ERR_MAGIC: File magic does not match contract. Expected 0x56385300 ("V8S\\0"), got 0x${activePreset.config.magic}.`);
            addLog('warn', 'CLEANUP CONTRACT TRIPPED: Releasing invalid file handle. Unmapping memory 0x7fff12000000.');
            setLoaderState('ERROR');
            setIsPlaying(false);
            return;
          }
          addLog('success', 'Magic Header "V8S\\0" verified. Sequence permitted.');
          break;

        case 'version_check':
          addLog('debug', `Validating V8 version parameters. Snapshot is built with V8 v${activePreset.config.v8Major}.${activePreset.config.v8Minor}.${activePreset.config.v8Patch}. Runtime supports v12.4.1.`);
          if (activePreset.config.v8Major !== 12) {
            addLog('error', `SNAPSHOT_ERR_V8_MAJOR_MISMATCH: V8 engine mismatch. Runtime engine is V8 v12.x, but snapshot was serialized on incompatibly newer V8 v${activePreset.config.v8Major}.x. Pointer size offset calculations cannot proceed safely.`);
            addLog('warn', 'CLEANUP CONTRACT TRIPPED: Unmapping loading buffers to avoid leakage. Disposal complete.');
            setLoaderState('ERROR');
            setIsPlaying(false);
            return;
          }
          if (activePreset.id === 'flags_incompatible') {
            addLog('error', 'SNAPSHOT_ERR_FLAG_INCOMPATIBLE: Flag mismatch! Host environment has enabled POINTER_COMPRESSION, but snapshot was built without Pointer Compression. Sizing mismatch prevents deserialization.');
            setLoaderState('ERROR');
            setIsPlaying(false);
            return;
          }
          addLog('success', 'V8 engine version compatibility verified.');
          break;

        case 'checksum':
          addLog('debug', 'Computing 32-bit Adler32 checksum values on payload buffer...');
          if (activePreset.id === 'corrupt_checksum') {
            addLog('error', 'SNAPSHOT_ERR_CHECKSUM: Adler32 checksum calculation mismatch! Expected 0x5E8B99AE, but real stream content computed 0x1F2B4D6C. File is corrupted or truncated.');
            addLog('warn', 'CLEANUP CONTRACT TRIPPED: Releasing memory mappings. 0 bytes leaked.');
            setLoaderState('ERROR');
            setIsPlaying(false);
            return;
          }
          addLog('success', 'Adler32 Checksum valid (Value: 0x5E8B99AE). Stream integrity guaranteed.');
          break;

        case 'mmap_align':
          addLog('debug', 'Parsing Section descriptors inside payload structure...');
          // Setup initial memory pages layouts
          const allocatedPages = activePreset.config.customSections.map((sec, idx) => ({
            name: sec.name,
            base: `0x7fff12a0${idx * 4}000`,
            size: `${(sec.size / 1024).toFixed(0)} KB`,
            perm: '--- (Pending)',
            status: 'Allocated'
          }));
          setMemoryPages(allocatedPages);
          setLoaderState('MAPPED');
          addLog('success', 'Allocated 6 virtual memory pages mapped safely with 4KB boundaries alignment check.');
          break;

        case 'protect_pages':
          addLog('debug', 'Setting appropriate page permission thresholds via mprotect()...');
          setMemoryPages(prev => prev.map(p => {
            const origSec = activePreset.config.customSections.find(s => s.name === p.name);
            return {
              ...p,
              perm: origSec ? origSec.mmapPermission : 'rw-',
              status: 'mprotect() Ok'
            };
          }));
          addLog('success', 'DEP/W^X security constraints integrated. Read-only and code-exec sections safely configured.');
          break;

        case 'relocate':
          addLog('debug', 'Resolving relocation table indices. Fixing pointers for ASLR addresses...');
          // Check for reloc record failures
          const badRecord = activePreset.config.relocRecords.find(r => r.sectionIdx >= 6 || r.offset > 0x10000);
          if (badRecord) {
            if (activePreset.id === 'reloc_section_overflow') {
              addLog('error', `SNAPSHOT_ERR_RELOC_OVERFLOW: Relocation offset breach! Targeted relocation index [${badRecord.sectionIdx}] overflows valid Section range [0..5]. Prevents unauthorized write to adjacent processes!`);
            } else if (activePreset.id === 'reloc_offset_overflow') {
              addLog('error', `SNAPSHOT_ERR_RELOC_OVERFLOW: Target relocation offset 0x${badRecord.offset.toString(16).toUpperCase()} exceeds allocated Section MAP_SPACE boundary.`);
            }
            addLog('warn', 'CLEANUP CONTRACT TRIPPED: mprotect(PROT_NONE) sets pages unsafe, munmap() called on all mapped areas to avoid residual leaks.');
            setMemoryPages([]);
            setLoaderState('ERROR');
            setIsPlaying(false);
            return;
          }
          addLog('success', 'Relocation table applied. All internal references and pointer arrays updated.');
          break;

        case 'ext_resolve':
          addLog('debug', 'Registering host external reference table...');
          setLoaderState('BINDING');
          if (activePreset.id === 'ext_ref_short') {
            addLog('error', 'SNAPSHOT_ERR_EXT_REF_SHORT: Host is under-providing external references! Snapshot requires 8 symbols, but host loader only registered 5 symbols. Failed to bind functions.');
            setLoaderState('ERROR');
            setIsPlaying(false);
            return;
          }
          if (activePreset.id === 'optional_mask_bug') {
            addLog('error', 'SNAPSHOT_ERR_EXT_REF_NULL: Optional mask off-by-one boundary calculation error! Attempted to parse non-optional symbol "v8::internal::Runtime_DateNow" as optional, resolving to nullptr.');
            setLoaderState('ERROR');
            setIsPlaying(false);
            return;
          }
          addLog('info', 'Binding host functions with zero offsets:');
          activePreset.config.externalRefs.forEach((ref, idx) => {
            addLog('success', `  - Bound [Ref ${idx}]: ${ref} -> 0x7fff92b3a040`);
          });
          break;

        case 'isolate_init':
          addLog('debug', 'Executing v8::Isolate::New() with our fully resolved relocation structures...');
          setLoaderState('READY');
          addLog('success', 'V8 Isolate instance constructed and initialized.');
          break;

        case 'context_restore':
          addLog('debug', 'Executing v8::Context::FromSnapshot() deserialize routine...');
          addLog('success', 'Deserialized global heap state. Successfully restored pre-compiled scope context.');
          break;

        case 'isolate_ready':
          setLoaderState('IN_USE');
          addLog('success', 'V8 Snapshot successfully restored and launched. Execution output:');
          addLog('success', '  > console.log("Initializing V8 Snapshot Loader Studio. Status: Operational!");');
          setIsPlaying(false);
          break;
      }
    }, 150);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      // Run continuous updates on steps
      let nextIdx = currentStepIndex;
      timerRef.current = setInterval(() => {
        nextIdx += 1;
        if (nextIdx < PIPELINE_STEPS.length && loaderState !== 'ERROR' && loaderState !== 'IN_USE') {
          setCurrentStepIndex(nextIdx);
          executeStepLogic(nextIdx);
        } else {
          setIsPlaying(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      }, 900);
    }
  };

  const getStatusColor = (state: LoaderState) => {
    switch (state) {
      case 'UNLOADED': return 'bg-slate-700 text-slate-300 border-slate-600';
      case 'LOADING': return 'bg-sky-950 text-sky-400 border-sky-800 animate-pulse';
      case 'MAPPED': return 'bg-purple-950 text-purple-400 border-purple-800';
      case 'BINDING': return 'bg-amber-950 text-amber-400 border-amber-800 animate-pulse';
      case 'READY': return 'bg-indigo-950 text-indigo-400 border-indigo-800';
      case 'IN_USE': return 'bg-emerald-950 text-emerald-400 border-emerald-800';
      case 'ERROR': return 'bg-rose-950 text-rose-400 border-rose-800';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Simulation Setup and Timeline */}
      <div className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h4 className="font-display font-semibold text-slate-100 text-md flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              1. 选择快照规则场景
            </h4>
            <p className="text-slate-400 text-xs mt-1">
              通过在下方加载预设的错误和合规快照，观察 Loader 对二进制文件完整规范限制下的实时决策流程。
            </p>
          </div>

          {/* Preset dropdown */}
          <div className="space-y-2">
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 p-2.5 rounded font-mono text-xs focus:ring-0"
            >
              {SIMULATION_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.name}</option>
              ))}
            </select>
            <div className="bg-slate-900 border border-slate-800/80 p-3 rounded-lg text-xs leading-relaxed text-indigo-300">
              <span className="font-semibold text-slate-300 block mb-1">场景描述/目的:</span>
              {activePreset.description}
            </div>
          </div>

          {/* Timeline representation */}
          <div className="space-y-2 border-t border-slate-800/60 pt-4">
            <span className="text-[11px] font-mono text-slate-500 block uppercase font-bold">装载检验管道进程:</span>
            <div className="space-y-1">
              {PIPELINE_STEPS.map((step, idx) => {
                const isSelected = idx === currentStepIndex;
                const isPassed = idx < currentStepIndex;
                const isPending = idx > currentStepIndex;

                let rowBg = 'border-transparent text-slate-500';
                if (isSelected) {
                  rowBg = loaderState === 'ERROR' ? 'bg-rose-950/40 border-rose-800 text-rose-300 font-medium' : 'bg-indigo-950 border-indigo-800 text-indigo-300 font-medium';
                } else if (isPassed) {
                  rowBg = 'text-indigo-400/80';
                }

                return (
                  <div
                    key={step.id}
                    className={`flex items-center justify-between px-3 py-1.5 border rounded-md text-[11.5px] transition-all font-mono min-h-8 ${rowBg}`}
                  >
                    <span>{step.name}</span>
                    <span className="text-[10px]">
                      {isSelected ? (
                        loaderState === 'ERROR' ? '❌ Crashed' : '⚡ Checking'
                      ) : isPassed ? (
                        '✓ Pass'
                      ) : (
                        '· Idle'
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex gap-2 border-t border-slate-800 pt-4 mt-4">
          <button
            onClick={handlePlayPause}
            disabled={loaderState === 'ERROR' || loaderState === 'IN_USE'}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded font-display font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {isPlaying ? '暂停模拟' : '连续自动装载'}
          </button>
          <button
            onClick={handleStepForward}
            disabled={isPlaying || loaderState === 'ERROR' || loaderState === 'IN_USE'}
            className="bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 rounded text-xs flex items-center justify-center font-mono border border-slate-700 transition cursor-pointer disabled:opacity-40"
            title="单步调试"
          >
            单步进入
          </button>
          <button
            onClick={resetSimulation}
            className="bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 p-2.5 rounded transition cursor-pointer"
            title="重置"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Execution Monitor Panels */}
      <div className="xl:col-span-8 flex flex-col space-y-6">
        {/* Terminal Header */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[400px]">
          <div className="bg-slate-900/80 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4.5 h-4.5 text-indigo-400" />
              <span className="font-mono text-xs text-slate-200">宿主底层 C++ 日志控制台 (Loader core.cpp)</span>
            </div>
            
            {/* Live State Machine pill */}
            <div className="flex items-center space-x-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-bold uppercase mr-1">Loader State:</span>
              <span className={`px-2.5 py-0.5 rounded border text-[10px] font-semibold tracking-wider ${getStatusColor(loaderState)}`}>
                {loaderState}
              </span>
            </div>
          </div>

          {/* Console Text Screen */}
          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 bg-slate-950 scrollbar">
            {logs.map((log, idx) => {
              let textClass = 'text-slate-400';
              let prefix = '[INFO]';
              if (log.type === 'debug') {
                textClass = 'text-indigo-400/80';
                prefix = '[DEBUG]';
              } else if (log.type === 'warn') {
                textClass = 'text-amber-400';
                prefix = '[WARN]';
              } else if (log.type === 'error') {
                textClass = 'text-rose-400 bg-rose-950/20 px-1 py-0.5 rounded border border-rose-900/30 font-semibold';
                prefix = '[FATAL_CRITICAL]';
              } else if (log.type === 'success') {
                textClass = 'text-emerald-400';
                prefix = '[SUCCESS]';
              }

              return (
                <div key={idx} className={`leading-relaxed py-0.5 ${textClass}`}>
                  <span className="text-slate-600 mr-2 select-none">{`${new Date().toISOString().substring(11, 19)}`}</span>
                  <span className="mr-2 font-bold">{prefix}</span>
                  <span>{log.text}</span>
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Visual Memory Map & Allocation Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <Database className="w-4.5 h-4.5 text-indigo-400" />
            <h4 className="font-display font-semibold text-slate-200 text-sm">
              虚拟物理页状态图 (v8::Isolate Memory Spaces allocation)
            </h4>
          </div>

          {memoryPages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {memoryPages.map((page, idx) => {
                let pBg = 'border-indigo-900/20 bg-indigo-950/10 text-indigo-300';
                if (loaderState === 'ERROR') pBg = 'border-rose-950/50 bg-rose-950/10 text-rose-300 opacity-60';
                else if (page.perm.includes('x')) pBg = 'border-rose-500/20 bg-rose-500/10 text-rose-400';
                else if (page.perm.includes('w')) pBg = 'border-amber-500/20 bg-amber-500/10 text-amber-300';
                else if (page.perm === 'r--') pBg = 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';

                return (
                  <div key={idx} className={`p-3.5 border rounded-lg font-mono flex flex-col justify-between h-28 ${pBg}`}>
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-bold border-b border-slate-800 pb-0.5">{page.name}</span>
                        <span className="text-[10px] font-bold uppercase">{page.perm}</span>
                      </div>
                      <span className="text-[10.5px] text-slate-500 block">虚拟物理址: {page.base}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800 pt-1">
                      <span>分配长度: {page.size}</span>
                      <span className="text-[9.5px] font-bold text-slate-400">{page.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 border border-dashed border-slate-800 rounded-lg text-center flex flex-col items-center justify-center text-slate-500 text-xs">
              <Flame className="w-5 h-5 text-slate-700 mb-2" />
              <span>当前尚未进入内存空间映射阶段。请运行 Simulator 以观摩 malloc 以及 mprotect 的物理地址对齐绑定。</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
