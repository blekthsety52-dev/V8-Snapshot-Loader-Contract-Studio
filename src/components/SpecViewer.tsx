/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, FileCode, ShieldAlert, Cpu, Hash, Layers, Copy, Check } from 'lucide-react';

export default function SpecViewer() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'binary' | 'refs' | 'compat'>('overview');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const cStructHeader = `/* ========================================================
 * V8 Snapshot Binary Header Struct (format_version: 3)
 * Offset Size (Bytes)  Field
 * ======================================================== */
typedef struct {
    uint8_t   magic[4];             /* 0x56 0x38 0x53 0x00 ("V8S\\0") */
    uint32_t  format_version;       /* Snapshot version (typically 3) */
    uint32_t  v8_version_major;     /* V8 Engine Major version e.g., 12 */
    uint32_t  v8_version_minor;     /* V8 Engine Minor version e.g., 4 */
    uint32_t  v8_version_patch;     /* V8 Engine Patch version e.g., 1 */
    uint32_t  flags;                /* Relocation and config flags */
    uint32_t  num_contexts;         /* Pre-compiled contexts inside */
    uint32_t  section_count;        /* Total memory sections (0x01 to 0x06) */
    uint32_t  payload_offset;       /* File offset to actual snapshot data */
    uint32_t  payload_size;         /* Core payload size in bytes */
    uint32_t  checksum;             /* Adler32 hash of payload payload */
    uint32_t  reloc_table_offset;   /* Relocation offset */
    uint32_t  reloc_table_size;     /* Size of relocations buffer */
    uint32_t  external_ref_count;   /* Count of symbols host must resolve */
    uint32_t  reserved[2];          /* Padded, must be zero */
} __attribute__((packed)) SnapshotHeader;

/* Flags Definitions */
#define SNAPSHOT_FLAG_STRICT_MODE         (1 << 0)
#define SNAPSHOT_FLAG_EMBEDDED_BUILTINS   (1 << 1)
#define SNAPSHOT_FLAG_POINTER_COMPRESSION (1 << 2)
#define SNAPSHOT_FLAG_SANDBOX_ENABLED     (1 << 3)
#define SNAPSHOT_FLAG_SHORT_BUILTIN_CALLS (1 << 4)
#define SNAPSHOT_FLAG_TURBOFAN_ENABLED    (1 << 5)`;

  const relocCStruct = `/* ========================================================
 * Memory relocation and mapping structures
 * ======================================================== */
struct SectionDescriptor {
    uint32_t  type;       /* 1: CODE, 2: MAP, 3: OLD, 4: READ_ONLY, etc */
    uint32_t  offset;     /* Relative to payload_offset offset */
    uint32_t  size;       /* Byte length allocation request */
    uint32_t  alignment;  /* Alignment threshold (must be power of 2) */
};

struct RelocRecord {
    uint32_t  section_idx;  /* Destination memory partition (index) */
    uint32_t  offset;       /* Byte offset within identified section */
};

/* Relocation computation */
SnapshotError relocate_pointers(SectionDescriptor* sections, 
                                 const RelocRecord* records, 
                                 size_t record_count) {
    for (size_t i = 0; i < record_count; ++i) {
        if (records[i].section_idx >= SECTION_COUNT_LIMIT) {
            return SNAPSHOT_ERR_RELOC_OVERFLOW;
        }
        // compute delta offset relative to virtual memory layouts
    }
    return SNAPSHOT_OK;
}`;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Tab Navigation header */}
      <div className="flex border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 items-center justify-between">
        <div className="flex items-center space-x-3">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <h2 className="font-display font-semibold text-lg text-slate-100">V8 Loader Contract 规范说明</h2>
        </div>
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            加载流与状态
          </button>
          <button
            onClick={() => setActiveTab('binary')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${activeTab === 'binary' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            文件格式 & 内存布局
          </button>
          <button
            onClick={() => setActiveTab('refs')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${activeTab === 'refs' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            外部引用 C API
          </button>
          <button
            onClick={() => setActiveTab('compat')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${activeTab === 'compat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            版本兼容矩阵
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto max-h-[640px] text-slate-300 space-y-8 scrollbar">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <p className="text-slate-400 leading-relaxed text-sm">
                V8 快照 (Snapshot) 是高性能 JS 引擎极速冷启动的基石。该规范定义了宿主运行时加载加载器 (<code className="font-mono text-indigo-400 bg-slate-950 px-1 py-0.5 rounded text-xs">runtime/loader</code>) 与二进制快照 Blob 的通信层契约。规范重点描述了魔数比对、内存重定位、页执行权限绑定以及外部 C++ 函数解析的全套指令集流程。
              </p>
            </div>

            {/* Steps Timeline Grid */}
            <div>
              <h3 className="font-display font-medium text-slate-200 text-md mb-4 flex items-center gap-2">
                <Cpu className="w-4.5 h-4.5 text-indigo-400" />
                宿主 Loader 执行逻辑 (11步经典序列)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-2 text-indigo-300 font-medium text-xs font-mono">
                    <span className="bg-indigo-950 text-indigo-400 w-5 h-5 flex items-center justify-center rounded-full border border-indigo-800">1</span>
                    二进制句柄加载 (File Read/mmap)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Loader 优先尝试通过系统调用 <code className="text-pink-400 font-mono">mmap()</code> 将快照文件映射至进程虚拟地址空间，避免额外的用户态/内核态高速内存拷贝。
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-2 text-indigo-300 font-medium text-xs font-mono">
                    <span className="bg-indigo-950 text-indigo-400 w-5 h-5 flex items-center justify-center rounded-full border border-indigo-800">2</span>
                    魔数字节头比对 (Magic Header Check)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    对齐首部 4 字节魔数进行字节检索。必须严格相等：<code className="text-amber-400 font-mono text-xs">0x56 0x38 0x53 0x00</code> (即字符 "V8S\0")，否则退出。
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-2 text-indigo-300 font-medium text-xs font-mono">
                    <span className="bg-indigo-950 text-indigo-400 w-5 h-5 flex items-center justify-center rounded-full border border-indigo-800">3</span>
                    V8 对应引擎版本比对 (Engine Match)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    提取主版本、次版本号。如果 Major 主版本有差异，认定无法反序列化。如果 Minor 有差异则降级记录 Warning 触发警告。
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-2 text-indigo-300 font-medium text-xs font-mono">
                    <span className="bg-indigo-950 text-indigo-400 w-5 h-5 flex items-center justify-center rounded-full border border-indigo-800">4</span>
                    数据哈希哈希校验 (Adler32 Checksum)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    跳过头部计算 payload 总长的 Adler32 校验码，任何网络篡改或磁盘损坏均触发 <code className="text-rose-400 font-mono">SNAPSHOT_ERR_CHECKSUM</code>。
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-2 text-indigo-300 font-medium text-xs font-mono">
                    <span className="bg-indigo-950 text-indigo-400 w-5 h-5 flex items-center justify-center rounded-full border border-indigo-800">5</span>
                    内存对齐页映射 (Mmap Alignment)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    根据 section 描述信息依次分配堆及代码页。对对齐要求严格的 CODE_SPACE 分区须对齐 4KB 页边界进行页分配。
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-2 text-indigo-300 font-medium text-xs font-mono">
                    <span className="bg-indigo-950 text-indigo-400 w-5 h-5 flex items-center justify-center rounded-full border border-indigo-800">6</span>
                    指令与只读分配 (DEP/W^X Mapping)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    严格配置页属性权限。代码页设为可执行不可写(<code className="text-emerald-400 font-mono">r-x</code>)，根对象区设为只读(<code className="text-emerald-400 font-mono">r--</code>)，确保安全性。
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-2 text-indigo-300 font-medium text-xs font-mono">
                    <span className="bg-indigo-950 text-indigo-400 w-5 h-5 flex items-center justify-center rounded-full border border-indigo-800">7</span>
                    ASLR 机制地址重定位 (Relocation Fixup)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    遍历重定位表修复二进制中硬编码的跨分区段指针，确保在 ASLR 动态分配下的堆虚拟地址链条完好连通。
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 mb-2 text-indigo-300 font-medium text-xs font-mono">
                    <span className="bg-indigo-950 text-indigo-400 w-5 h-5 flex items-center justify-center rounded-full border border-indigo-800">8</span>
                    宿主核心外部指针符号绑定 (External Resolving)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    对 C++ 的 API 回调（例如 Math.sqrt等宿主级重绑定函数）执行哈希字典表指针比对及加载。顺序一字不能错。
                  </p>
                </div>
              </div>
            </div>

            {/* Lifecycle constraints block */}
            <div className="bg-slate-950 p-5 rounded-lg border border-slate-800/80 space-y-3">
              <h4 className="font-medium text-slate-200 text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                生命周期管理核心指令 (Rules CLN & TS)
              </h4>
              <ul className="list-disc pl-5 text-xs text-slate-400 space-y-2">
                <li><strong className="text-slate-300">TS-1 / 线程不并发：</strong> <code className="text-indigo-300 font-mono">Load()</code> 和 <code className="text-indigo-300 font-mono">Unload()</code> 为串行独占，多线程调用须配置并发自旋互斥器。</li>
                <li><strong className="text-slate-300">TS-3 / 计数依存：</strong> 快照内存 Blob 的卸载必须等待所有依赖它的 <code className="text-indigo-300 font-mono">v8::Isolate</code> 调用 <code className="text-indigo-300 font-mono">Dispose()</code> 析构完成。</li>
                <li><strong className="text-slate-300">CLN-1 / 幂等清理：</strong> 任何初始化或修复加载退出失败，Loader 均有义务自动释放已占有 mmap 对。不可遗留孤儿映射内存。</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'binary' && (
          <div className="space-y-6">
            <p className="text-sm text-slate-400">
              V8 快照在二进制布局上划分了精密的区块头。快照字节头部配置控制了包括 V8 标志、沙箱(Sandboxed Layout)、指针压缩(32-bit offset Pointer Compression)在内的编译设定。
            </p>

            {/* Binary C Struct */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5" />
                  snapshot_header.h
                </span>
                <button
                  onClick={() => copyToClipboard(cStructHeader, 'header')}
                  className="flex items-center gap-1.5 text-xs text-indigo-400 bg-slate-950 hover:bg-slate-800 px-2.5 py-1.5 rounded border border-slate-800 font-mono transition"
                >
                  {copiedSection === 'header' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy C Header</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[11px] leading-relaxed bg-slate-950 p-4 rounded-lg font-mono text-emerald-400 border border-slate-800 overflow-x-auto scrollbar">
                {cStructHeader}
              </pre>
            </div>

            {/* Memory layout of sections */}
            <div className="space-y-3">
              <h3 className="font-display font-medium text-slate-200 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                V8 虚拟分区规格 (Sections Definition)
              </h3>
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs bg-slate-950">
                  <header></header>
                  <thead className="bg-slate-900 text-slate-300 font-mono border-b border-slate-800">
                    <tr>
                      <th className="p-3">ID (Hex)</th>
                      <th className="p-3">类型名称</th>
                      <th className="p-3">默认页属性</th>
                      <th className="p-3">设计功用描述</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-400 font-mono">
                    <tr>
                      <td className="p-3 text-indigo-300">0x01</td>
                      <td className="p-3 text-slate-200">CODE_SPACE</td>
                      <td className="p-3 text-rose-400">r-x (只读执行)</td>
                      <td className="p-3 text-xs font-sans">存储 V8 预编译的机器代码以及嵌入式内置汇编段等。须启用 W^X 保护机制防范恶意篡改。</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-indigo-300">0x02</td>
                      <td className="p-3 text-slate-200">MAP_SPACE</td>
                      <td className="p-3 text-amber-300">rw- (读写)</td>
                      <td className="p-3 text-xs font-sans">V8 的各种 Shape「隐藏类」结构。控制字段偏移、动态方法字典映射关系。</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-indigo-300">0x03</td>
                      <td className="p-3 text-slate-200">OLD_SPACE</td>
                      <td className="p-3 text-amber-300">rw- (读写)</td>
                      <td className="p-3 text-xs font-sans">存储生命周期超过单次 GC 垃圾回收限制的各类老生代堆对象、常备静态文本。</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-indigo-300">0x04</td>
                      <td className="p-3 text-slate-200">READ_ONLY_SPACE</td>
                      <td className="p-3 text-emerald-400">r-- (绝对只读)</td>
                      <td className="p-3 text-xs font-sans">基础类型根、永久字符串、无法修改的引擎原生内部固定键值（例如 undefined/null/true）。</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-indigo-300">0x05</td>
                      <td className="p-3 text-slate-200">SHARED_SPACE</td>
                      <td className="p-3 text-emerald-400">r-- (绝对只读)</td>
                      <td className="p-3 text-xs font-sans">多个独立 JavaScript Isolate 之间高并发共享的非变更全局变量以及跨进程元数据。</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-indigo-300">0x06</td>
                      <td className="p-3 text-slate-200">LARGE_OBJECT_SPACE</td>
                      <td className="p-3 text-amber-300">rw- (读写)</td>
                      <td className="p-3 text-xs font-sans">尺寸超过 1MB 阈值、规避了常规划级搬运的直接大容量数据缓存区。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'refs' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm text-slate-400">
                因为 C++ 的编译环境不同，内置系统 C API 的函数绝对地址（比如 <code className="text-indigo-400 font-mono">Math.sqrt</code>）不能直接硬编码存入二进制文件。因此契约引入了外部指针重绑映射机制，即 <strong>External Reference Binding</strong>。
              </p>
              <div className="bg-slate-950 p-4 border border-indigo-900/30 rounded-lg text-xs leading-relaxed text-indigo-300 space-y-2">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">🛡️ 外部绑定的约束四律</span>
                <p><strong>EXT-1 (顺序不变律)：</strong> 外部引用数组在整个快照演进迭代过程中，索引顺序不容插入发生变更，变动必须严格在数组尾部 Append 挂载。</p>
                <p><strong>EXT-2 (数量合规律)：</strong> 引擎检测到头部宣告的 external_ref_count 必须小于等于 Loader 函数体实际传参登记的数组总长，短缺会导致内存解构失效崩溃。</p>
              </div>
            </div>

            {/* Relocation math snippet */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5" />
                  relocation_logic.c
                </span>
                <button
                  onClick={() => copyToClipboard(relocCStruct, 'reloc')}
                  className="flex items-center gap-1.5 text-xs text-indigo-400 bg-slate-950 hover:bg-slate-800 px-2.5 py-1.5 rounded border border-slate-800 font-mono transition"
                >
                  {copiedSection === 'reloc' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Relocation Code</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[11px] leading-relaxed bg-slate-950 p-4 rounded-lg font-mono text-emerald-400 border border-slate-800 overflow-x-auto scrollbar">
                {relocCStruct}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'compat' && (
          <div className="space-y-6">
            <h3 className="font-display font-medium text-slate-200 text-sm flex items-center gap-2">
              <Hash className="w-4 h-4 text-indigo-400" />
              全面兼容性决策判定表 (Compatibility Matrix)
            </h3>
            <p className="text-sm text-slate-400">
              Loader 面临各种历史遗留快照或者非配对引擎，需根据契约设置自动兼容/强制拒绝层级。主要依据 <strong>V8 Major.Minor</strong> 以及构建编译位参数进行判定：
            </p>

            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 bg-slate-900 border-b border-slate-800 p-3 font-mono text-xs text-slate-300 font-medium">
                <div>指标参数</div>
                <div>状态差异</div>
                <div className="text-center">加载策略</div>
                <div className="text-right">系统异常响应</div>
              </div>
              <div className="divide-y divide-slate-800 text-xs font-mono bg-slate-950">
                <div className="grid grid-cols-4 p-3 items-center">
                  <div className="text-indigo-400 font-medium">V8 Major</div>
                  <div className="text-slate-300">主版本不匹配 (e.g. 12 vs 13)</div>
                  <div className="text-center"><span className="bg-rose-950 text-rose-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold">CRITICAL_FAIL</span></div>
                  <div className="text-right text-rose-400 text-[10px]">SNAPSHOT_ERR_V8_MAJOR_MISMATCH</div>
                </div>

                <div className="grid grid-cols-4 p-3 items-center">
                  <div className="text-indigo-400 font-medium">V8 Minor</div>
                  <div className="text-slate-300">次版本带误差 (e.g. 12.4 vs 12.5)</div>
                  <div className="text-center"><span className="bg-amber-950 text-amber-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold">WARN_UPGRADE</span></div>
                  <div className="text-right text-amber-400 text-[10px]">SNAPSHOT_ERR_V8_MINOR_MISMATCH</div>
                </div>

                <div className="grid grid-cols-4 p-3 items-center">
                  <div className="text-indigo-400 font-medium">Pointer Comp</div>
                  <div className="text-slate-300">编译压缩物理偏移不合 (true vs false)</div>
                  <div className="text-center"><span className="bg-rose-950 text-rose-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold">STRICT_REJECT</span></div>
                  <div className="text-right text-rose-400 text-[10px]">SNAPSHOT_ERR_FLAG_INCOMPATIBLE</div>
                </div>

                <div className="grid grid-cols-4 p-3 items-center">
                  <div className="text-indigo-400 font-medium">Sandbox Mode</div>
                  <div className="text-slate-300">沙箱边界状态差异</div>
                  <div className="text-center"><span className="bg-rose-950 text-rose-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold">STRICT_REJECT</span></div>
                  <div className="text-right text-rose-400 text-[10px]">SNAPSHOT_ERR_FLAG_INCOMPATIBLE</div>
                </div>

                <div className="grid grid-cols-4 p-3 items-center">
                  <div className="text-indigo-400 font-medium">Turbofan</div>
                  <div className="text-slate-300">优化编译器使能条件不搭</div>
                  <div className="text-center"><span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold">WARN_DEGRADE</span></div>
                  <div className="text-right text-amber-400 text-[10px]">性能退回非 TurboFan 降级警告</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
