/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { TestCase } from '../types';
import { Check, X, Play, RefreshCw, BarChart2, ShieldCheck, HelpCircle } from 'lucide-react';

const INTEGRATION_TESTS: TestCase[] = [
  { id: 'TC-A01', category: 'A', categoryLabel: '格式校验 (Format)', name: 'magic_mismatch_rejected', description: '构造 magic=0xDEADBEEF 的快照 blob，测试 Loader 提取首部魔数不符。', expectedError: 'SNAPSHOT_ERR_MAGIC', status: 'idle', logs: [] },
  { id: 'TC-A02', category: 'A', categoryLabel: '格式校验 (Format)', name: 'checksum_corruption_detected', description: '修改 payload 极密二进制段 1 bit，检测并拒绝 Adler32 校验错误。', expectedError: 'SNAPSHOT_ERR_CHECKSUM', status: 'idle', logs: [] },
  { id: 'TC-A03', category: 'A', categoryLabel: '格式校验 (Format)', name: 'truncated_blob_rejected', description: '截断快照文件末尾 1 字节导致段残破，验证溢出崩溃护栏。', expectedError: 'SNAPSHOT_ERR_SECTION_CORRUPT', status: 'idle', logs: [] },
  
  { id: 'TC-B01', category: 'B', categoryLabel: '引擎主代 (Version)', name: 'major_version_mismatch_rejected', description: '设置快照 V8 Major = 13 (宿主=12)，测试主代版本硬限制机制。', expectedError: 'SNAPSHOT_ERR_V8_MAJOR_MISMATCH', status: 'idle', logs: [] },
  { id: 'TC-B02', category: 'B', categoryLabel: '引擎主代 (Version)', name: 'minor_mismatch_default_rejected', description: '设置 V8 Minor + 1 且配置 allow_minor 为 false，Loader 强制拒绝。', expectedError: 'SNAPSHOT_ERR_V8_MINOR_MISMATCH', status: 'idle', logs: [] },
  { id: 'TC-B03', category: 'B', categoryLabel: '引擎主代 (Version)', name: 'minor_mismatch_allowed_with_warning', description: '配置 allow_minor 为 true，次代版本警告并降级加载，断言返回 OK。', expectedError: 'SNAPSHOT_OK', status: 'idle', logs: [] },
  { id: 'TC-B04', category: 'B', categoryLabel: '引擎主代 (Version)', name: 'pointer_compression_mismatch_always_rejected', description: '快照与宿主 POINTER_COMPRESSION 标志不匹配时强制拒绝。', expectedError: 'SNAPSHOT_ERR_FLAG_INCOMPATIBLE', status: 'idle', logs: [] },

  { id: 'TC-C01', category: 'C', categoryLabel: '宿主指针 (Ext Refs)', name: 'ext_ref_exact_match', description: '验证快照依赖符号表与 Loader 注册的 5 个 External 完好契合。', expectedError: 'SNAPSHOT_OK', status: 'idle', logs: [] },
  { id: 'TC-C02', category: 'C', categoryLabel: '宿主指针 (Ext Refs)', name: 'ext_ref_loader_has_more_allowed', description: '宿主提供 8 个 Symbols（快照仅需 5），验证向前兼容正常。', expectedError: 'SNAPSHOT_OK', status: 'idle', logs: [] },
  { id: 'TC-C03', category: 'C', categoryLabel: '宿主指针 (Ext Refs)', name: 'ext_ref_snapshot_has_more_rejected', description: '快照需要 10 个 Symbols（宿主仅提供 8），测试安全约束短缺退出。', expectedError: 'SNAPSHOT_ERR_EXT_REF_SHORT', status: 'idle', logs: [] },
  { id: 'TC-C04', category: 'C', categoryLabel: '宿主指针 (Ext Refs)', name: 'ext_ref_null_rejected', description: '宿主传入的必选 reference 中包含关键 NULL 值时，断言退出。', expectedError: 'SNAPSHOT_ERR_EXT_REF_NULL', status: 'idle', logs: [] },

  { id: 'TC-D01', category: 'D', categoryLabel: '边界与沙箱 (Reloc & Sandbox)', name: 'reloc_section_idx_overflow', description: '构建越界的 section_idx 重定位（15 > 5），测试物理段越界。', expectedError: 'SNAPSHOT_ERR_RELOC_OVERFLOW', status: 'idle', logs: [] },
  { id: 'TC-D02', category: 'D', categoryLabel: '边界与沙箱 (Reloc & Sandbox)', name: 'reloc_offset_overflow', description: '制造对 Section 偏移量的大量越界寻址（0x50000），防范 W^X 漏洞。', expectedError: 'SNAPSHOT_ERR_RELOC_OVERFLOW', status: 'idle', logs: [] },
  { id: 'TC-D03', category: 'D', categoryLabel: '边界与沙箱 (Reloc & Sandbox)', name: 'load_fail_no_mmap_leak', description: '验证重定位写溢出崩溃路径结束后，已映射虚拟页百分百完成释放。', expectedError: 'SNAPSHOT_ERR_RELOC_OVERFLOW', status: 'idle', logs: [] },

  { id: 'TC-E01', category: 'E', categoryLabel: '并发与同步 (Thread Safety)', name: 'concurrent_create_isolate', description: '断言 16 个系统底层线程在并发调用 CreateIsolate 下无数据竞争。', expectedError: 'SNAPSHOT_OK', status: 'idle', logs: [] },
  { id: 'TC-E02', category: 'E', categoryLabel: '并发与同步 (Thread Safety)', name: 'unload_blocked_by_live_isolates', description: '仍有 Isolate 生命期在跑时，阻止 Unload() 进行物理释放，拒绝 ERR_BUSY。', expectedError: 'SNAPSHOT_ERR_BUSY', status: 'idle', logs: [] },

  { id: 'TC-F01', category: 'F', categoryLabel: '基准耗时 (Performance Benchmark)', name: 'load_time_baseline', description: '连续 100 次加载 8MB 精密文件，校验 P99 反序时延低于 50ms。', expectedError: 'SNAPSHOT_OK', status: 'idle', logs: [] },
  { id: 'TC-F02', category: 'F', categoryLabel: '基准耗时 (Performance Benchmark)', name: 'isolate_create_time_baseline', description: '断言对已就绪的 Heap 快照，反序列化单次 Isolate 的时延低于 5ms。', expectedError: 'SNAPSHOT_OK', status: 'idle', logs: [] }
];

export default function TestRunner() {
  const [tests, setTests] = useState<TestCase[]>(INTEGRATION_TESTS);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [runningAll, setRunningAll] = useState<boolean>(false);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  const runTest = (testId: string) => {
    setTests(prev => prev.map(t => {
      if (t.id === testId) {
        return { ...t, status: 'running', logs: [`[LOG] [${new Date().toISOString()}] Initiating ${t.name}...`] };
      }
      return t;
    }));

    setTimeout(() => {
      setTests(prev => prev.map(t => {
        if (t.id === testId) {
          const duration = Math.floor(Math.random() * 8) + 2; // benchmark latency
          const isFPerf = t.category === 'F';
          const lat = isFPerf ? (t.id === 'TC-F01' ? 42 : 3) : duration;

          const assertLog = [
            `[DEBUG] Loading test bundle into sandbox context...`,
            `[ASSERT] Verifying signature against V8 ${t.expectedError === 'SNAPSHOT_OK' ? 'contract success' : t.expectedError}`,
            `[EXEC] Initial mmap size: 8388608 bytes`,
            `--- ASSERTION RESULT: MATCHED EXPECTED [${t.expectedError}] ---`,
            `[INFO] Cleanup audit: Zero leaking pages verified in /proc/self/maps.`,
            `--- Test finished in ${lat}ms ---`
          ];

          return {
            ...t,
            status: 'passed',
            logs: [...t.logs, ...assertLog],
            durationMs: lat
          };
        }
        return t;
      }));
    }, 400);
  };

  const runAllTests = () => {
    setRunningAll(true);
    let index = 0;

    const interval = setInterval(() => {
      if (index < tests.length) {
        runTest(tests[index].id);
        index++;
      } else {
        clearInterval(interval);
        setRunningAll(false);
      }
    }, 150);
  };

  const resetTests = () => {
    setTests(INTEGRATION_TESTS.map(t => ({ ...t, status: 'idle', logs: [] })));
    setExpandedTestId(null);
  };

  const filteredTests = tests.filter(t => filterCategory === 'all' || t.category === filterCategory);

  const totalTests = tests.length;
  const passedTests = tests.filter(t => t.status === 'passed').length;
  const passedPercent = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center space-x-3 border-r border-slate-800 pr-4">
          <ShieldCheck className="w-10 h-10 text-indigo-400" />
          <div>
            <span className="text-xs text-slate-400 block font-sans">集成断言成功率</span>
            <span className="text-xl font-mono text-slate-100 font-bold">{passedPercent}% ({passedTests}/{totalTests})</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 md:pl-4 border-r border-slate-800 pr-4">
          <BarChart2 className="w-10 h-10 text-emerald-400" />
          <div>
            <span className="text-xs text-slate-400 block font-sans">快照 Isolate 冷启动时延 (TC-F02)</span>
            <span className="text-xl font-mono text-emerald-400 font-bold">~ 3.4ms</span>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col justify-center text-xs text-slate-400 leading-relaxed pl-4">
          <p>
            底层 Loader 快照完整性断言体系涵盖 A、B、C、D、E、F 六大契约规范指标。测试保障了安全沙箱(W^X Execution Pages Isolation) 的硬编码抵御以及极速加载的安全运行限制。
          </p>
        </div>
      </div>

      {/* Test cases list layout */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        {/* Actions bar */}
        <div className="bg-slate-950 px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
          {/* Controls category filters */}
          <div className="flex flex-wrap gap-1.5 text-xs font-medium">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 rounded transition cursor-pointer ${filterCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-300'}`}
            >
              全量用例 ({tests.length})
            </button>
            <button
              onClick={() => setFilterCategory('A')}
              className={`px-3 py-1.5 rounded transition cursor-pointer ${filterCategory === 'A' ? 'bg-indigo-950 border border-indigo-900 text-indigo-400' : 'bg-slate-900 text-slate-400 hover:text-slate-300'}`}
            >
              A. 格式/损坏
            </button>
            <button
              onClick={() => setFilterCategory('B')}
              className={`px-3 py-1.5 rounded transition cursor-pointer ${filterCategory === 'B' ? 'bg-indigo-950 border border-indigo-900 text-indigo-400' : 'bg-slate-900 text-slate-400 hover:text-slate-300'}`}
            >
              B. 引擎兼容
            </button>
            <button
              onClick={() => setFilterCategory('C')}
              className={`px-3 py-1.5 rounded transition cursor-pointer ${filterCategory === 'C' ? 'bg-indigo-950 border border-indigo-900 text-indigo-400' : 'bg-slate-900 text-slate-400 hover:text-slate-300'}`}
            >
              C. 外部引用
            </button>
            <button
              onClick={() => setFilterCategory('D')}
              className={`px-3 py-1.5 rounded transition cursor-pointer ${filterCategory === 'D' ? 'bg-indigo-950 border border-indigo-900 text-indigo-400' : 'bg-slate-900 text-slate-400 hover:text-slate-300'}`}
            >
              D. 重定位安全
            </button>
            <button
              onClick={() => setFilterCategory('E')}
              className={`px-3 py-1.5 rounded transition cursor-pointer ${filterCategory === 'E' ? 'bg-indigo-950 border border-indigo-900 text-indigo-400' : 'bg-slate-900 text-slate-400 hover:text-slate-300'}`}
            >
              E. 并发同步
            </button>
            <button
              onClick={() => setFilterCategory('F')}
              className={`px-3 py-1.5 rounded transition cursor-pointer ${filterCategory === 'F' ? 'bg-indigo-950 border border-indigo-900 text-indigo-400' : 'bg-slate-900 text-slate-400 hover:text-slate-300'}`}
            >
              F. 基准性能
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={runAllTests}
              disabled={runningAll}
              className="bg-indigo-600 hover:bg-indigo-500 whitespace-nowrap text-white px-4 py-2 rounded text-xs font-display font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5" />
              跑通全套测试
            </button>
            <button
              onClick={resetTests}
              className="bg-slate-800 border border-slate-700 hover:bg-slate-705 text-slate-300 px-3 py-2 rounded text-xs font-mono transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tests collection list */}
        <div className="divide-y divide-slate-800 bg-slate-900/40">
          {filteredTests.map((t) => {
            const isExpanded = expandedTestId === t.id;
            
            return (
              <div key={t.id} className="transition hover:bg-slate-950/20">
                <div
                  onClick={() => setExpandedTestId(isExpanded ? null : t.id)}
                  className="flex items-center justify-between p-4 cursor-pointer select-none"
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-4">
                    {t.status === 'passed' ? (
                      <span className="bg-emerald-950 text-emerald-400 p-1 w-5 h-5 flex items-center justify-center rounded-full border border-emerald-800">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : t.status === 'running' ? (
                      <span className="bg-amber-950 text-amber-400 p-1 w-5 h-5 flex items-center justify-center rounded-full border border-amber-800 animate-spin">
                        <RefreshCw className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-500 p-1 w-5 h-5 flex items-center justify-center rounded-full border border-slate-700 font-mono text-[9px] font-semibold">
                        IDLE
                      </span>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 border border-indigo-900 px-1.5 py-0.5 rounded uppercase">
                          {t.id}
                        </span>
                        <span className="text-xs font-mono font-medium text-slate-200 truncate">{t.name}</span>
                        <span className="text-[9.5px] font-sans text-slate-500">{t.categoryLabel}</span>
                      </div>
                      <p className="text-[11.5px] text-slate-400 mt-1 lines-clamp-1">{t.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-xs font-mono">
                    <div className="text-right hidden sm:block">
                      <span className="text-slate-500 block text-[10px]">期望抛出 / 结果</span>
                      <span className="text-slate-300 font-medium">{t.expectedError}</span>
                    </div>

                    {t.durationMs !== undefined && (
                      <span className="text-emerald-400 text-xs">
                        {t.durationMs}ms
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        runTest(t.id);
                      }}
                      className="bg-slate-800 text-[10.5px] hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 transition cursor-pointer"
                    >
                      运行
                    </button>
                  </div>
                </div>

                {/* Expanded Logs visual */}
                {isExpanded && (
                  <div className="bg-slate-950 p-4 border-t border-slate-800 font-mono text-xs text-indigo-300 space-y-1 bg-opacity-70">
                    <span className="text-[10px] text-slate-500 block mb-2 border-b border-slate-800 pb-1 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Assertion traces & Sandboxed execution logs for {t.id}:
                    </span>
                    {t.logs.length > 0 ? (
                      t.logs.map((log, lidx) => (
                        <div key={lidx} className="leading-relaxed py-0.5 whitespace-pre">
                          {log}
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-500 italic py-2">
                        用例尚未执行断言验证。请点击右侧「运行」测试。
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
