/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import SpecViewer from './components/SpecViewer';
import BinaryLayoutExplorer from './components/BinaryLayoutExplorer';
import LoaderSimulator from './components/LoaderSimulator';
import TestRunner from './components/TestRunner';
import RiskFixAnalyzer from './components/RiskFixAnalyzer';
import InteractiveBuilder from './components/InteractiveBuilder';

import { 
  Terminal, 
  Cpu, 
  ShieldCheck, 
  BookOpen, 
  Binary, 
  Settings, 
  Sparkles, 
  Layers, 
  FileCode, 
  Activity 
} from 'lucide-react';

type TabId = 'spec' | 'binary' | 'simulator' | 'risks' | 'tests' | 'builder';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('spec');

  // Header diagnostic values representation
  const diagnosticMetrics = [
    { name: '当前协议规范', value: 'V3 (format_version: 3)', color: 'text-indigo-400' },
    { name: '最低引擎主代', value: 'V8 v12.4.1 (baseline)', color: 'text-emerald-400' },
    { name: '虚拟页边界', value: '4096-Byte alignment', color: 'text-amber-400' },
    { name: '安全沙箱防护', value: 'DEP & W^X Enabled', color: 'text-pink-400' }
  ];

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500/30 selection:text-white">
      {/* Decorative ambient background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Primary Header Segment */}
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="bg-indigo-600/10 border border-indigo-500/20 p-2.5 rounded-xl text-indigo-400 shadow-lg shadow-indigo-600/5">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-lg md:text-xl tracking-tight bg-gradient-to-r from-slate-100 via-indigo-200 to-slate-200 bg-clip-text text-transparent">
                  V8 Snapshot Loader Contract Studio
                </h1>
                <span className="bg-indigo-950 text-indigo-400 border border-indigo-900 text-[9.5px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Active V3 Protocol
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                V8 引擎堆内存反序列化和 runtime/loader 契约规范、数据格式及生命周期管理演练平台。
              </p>
            </div>
          </div>

          {/* Diagnostic metrics cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-2 border border-slate-900 rounded-xl max-w-full overflow-x-auto scrollbar">
            {diagnosticMetrics.map((me, idx) => (
              <div key={idx} className="px-3 py-1 bg-slate-900/50 rounded-lg min-w-36 flex flex-col select-none">
                <span className="text-[9.5px] font-mono text-slate-500 font-semibold tracking-wider uppercase">{me.name}</span>
                <span className={`text-[11px] font-mono font-bold mt-0.5 ${me.color}`}>{me.value}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Navigation Tabs bar */}
        <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-900 max-w-full overflow-x-auto text-xs font-mono scrollbar gap-1">
          <button
            onClick={() => setActiveTab('spec')}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${activeTab === 'spec' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <BookOpen className="w-4 h-4" />
            V8 契约规范说明 (Overview)
          </button>
          
          <button
            onClick={() => setActiveTab('binary')}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${activeTab === 'binary' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Binary className="w-4 h-4" />
            二进制头部布局 (Format Matrix)
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${activeTab === 'simulator' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Terminal className="w-4 h-4" />
            装载沙盘模拟器 (Loader Simulation)
          </button>

          <button
            onClick={() => setActiveTab('risks')}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${activeTab === 'risks' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Layers className="w-4 h-4" />
            契约潜在风险 (Risks & Exploit Fixes)
          </button>

          <button
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${activeTab === 'tests' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ShieldCheck className="w-4 h-4" />
            集成断言测试用例 (Test Runner)
          </button>

          <button
            onClick={() => setActiveTab('builder')}
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 transition whitespace-nowrap cursor-pointer ${activeTab === 'builder' ? 'bg-indigo-600 text-white shadow shadow-indigo-600/10' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <FileCode className="w-4 h-4" />
            定制 Loader 组装 (Bespoke Generator)
          </button>
        </div>

        {/* Tab display viewport */}
        <section className="min-h-[500px]">
          {activeTab === 'spec' && <SpecViewer />}
          {activeTab === 'binary' && <BinaryLayoutExplorer />}
          {activeTab === 'simulator' && <LoaderSimulator />}
          {activeTab === 'risks' && <RiskFixAnalyzer />}
          {activeTab === 'tests' && <TestRunner />}
          {activeTab === 'builder' && <InteractiveBuilder />}
        </section>
      </main>

      {/* Global Footer info segment */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500 mt-20 font-mono">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>V8 Snapshot Runtime/Loader Verified Sandbox Contract - Built in May 2026</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="hover:text-indigo-400 cursor-pointer">Protocol Specifications v3.0.4</span>
            <span>·</span>
            <span className="hover:text-indigo-400 cursor-pointer">License: Apache 2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
