import React, { useState, useEffect, useRef } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { 
  Play, CheckCircle2, AlertCircle, RefreshCw, GitBranch, 
  Terminal, BookOpen, Layers, Send, Mic, Server, Code2,
  Moon, Sun, Copy, Check, ChevronDown, ChevronUp, ArrowUp,
  ShieldCheck, GitCommit, FileCode, CheckCircle, XCircle,
  Link2, Database, Key, Globe, Radio, Sparkles, ExternalLink,
  ArrowRight, ArrowDown, Workflow, Cpu, Lock, FileText, CheckCheck, HelpCircle,
  Info, Sliders, Eye
} from 'lucide-react';

interface SyntaxMessage {
  line: number;
  type: string;
  message: string;
}

interface TestCase {
  name: string;
  status: string;
  duration_ms?: number;
}

interface SyntaxResult {
  success: boolean;
  has_errors: boolean;
  errors: SyntaxMessage[];
  message: string;
}

interface TestResult {
  success: boolean;
  total: number;
  passed: number;
  failed: number;
  duration_ms?: number;
  test_cases?: TestCase[];
  message: string;
}

interface SystemStatus {
  status: string;
  sap_connection: {
    success: boolean;
    mode: string;
    message: string;
    client: string;
    user?: string;
    system?: string;
  };
  ai_provider: string;
  abapgit_installed?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function App() {
  // Navigation Tabs: workbench | connections | inspector | guide
  const [activeTab, setActiveTab] = useState<'workbench' | 'connections' | 'inspector' | 'guide'>('workbench');
  const [codeTab, setCodeTab] = useState<'class' | 'test' | 'xml' | 'diff'>('class');
  const [editorTheme, setEditorTheme] = useState<'vs-light' | 'vs-dark'>('vs-light');
  
  // Architecture Guide Active Section
  const [guideSection, setGuideSection] = useState<'all' | 'overview' | 'dual-channel' | 'how-it-works' | 'how-to-use' | 'connectivity' | 'abapgit-cts' | 'clean-abap'>('all');
  
  // UI collapse state
  const [showTestScenarios, setShowTestScenarios] = useState(false);
  const [copied, setCopied] = useState(false);

  // SAP Form Parameters
  const [requirement, setRequirement] = useState('Create a discount calculator class ZCL_ORDER_DISCOUNT that applies a 10% discount if order amount is over 1000, otherwise 0.');
  const [className, setClassName] = useState('ZCL_ORDER_DISCOUNT');
  const [packageName, setPackageName] = useState('Z_DEV_TRIAL');
  const [tables, setTables] = useState('VBAK, VBAP');

  // Generated Artifacts
  const [classCode, setClassCode] = useState('');
  const [previousClassCode, setPreviousClassCode] = useState('');
  const [testCode, setTestCode] = useState('');
  const [xmlCode, setXmlCode] = useState('');
  const [sapState, setSapState] = useState<'DRAFT' | 'INACTIVE' | 'ACTIVE'>('DRAFT');

  // Status & Telemetry
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [syntaxResult, setSyntaxResult] = useState<SyntaxResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Connections Page State (Configured for SAP BTP ABAP Cloud Trial)
  const [sapUrl, setSapUrl] = useState('https://a4796127-12c7-4a21-ae82-e3ced4ab9c3d.abap.us10.hana.ondemand.com');
  const [sapClient, setSapClient] = useState('100');
  const [sapUser, setSapUser] = useState('CB9980001106');
  const [sapPassword, setSapPassword] = useState('');
  const [sapOfflineMode, setSapOfflineMode] = useState(false);
  const [sapPingResult, setSapPingResult] = useState<any>(null);

  // Git Repository & Branch State
  const [targetRepoUrl, setTargetRepoUrl] = useState('https://github.com/organization/abap_ai.git');
  const [targetBranch, setTargetBranch] = useState('main');

  // Conversational Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Clean ABAP Studio ready. Specify business rules, run the automated tight loop, or refine code conversationally.'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Voice Dictation (Speech-to-Text directly into input fields)
  const [testScenarios, setTestScenarios] = useState('');
  const [isListeningReq, setIsListeningReq] = useState(false);
  const [isListeningTest, setIsListeningTest] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Orchestrator & Clarification State
  const [orchestratorStage, setOrchestratorStage] = useState<number>(0);
  const [clarificationData, setClarificationData] = useState<any>(null);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [isClarifying, setIsClarifying] = useState(false);

  // ATC Results
  const [atcResult, setAtcResult] = useState<any>(null);

  // Transport Management
  const [transports, setTransports] = useState<any[]>([]);
  const [selectedTransport, setSelectedTransport] = useState('');
  const [transportDesc, setTransportDesc] = useState('');
  const [autoRelease, setAutoRelease] = useState(false);

  // Object Type
  const [objectType, setObjectType] = useState('class');

  // abapGit
  const [abapgitInstalled, setAbapgitInstalled] = useState(false);

  // Tight-Loop Automated CI/CD State
  const [isTightLoopRunning, setIsTightLoopRunning] = useState(false);
  const [tightLoopAudit, setTightLoopAudit] = useState<any[]>([]);

  // Fetch initial connection status, SAP config, and Git config
  useEffect(() => {
    fetchSystemStatus();
    fetchSapConfig();
    fetchTransports();
    fetchGitConfig();
  }, []);

  // Auto-scroll chat messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchSapConfig = async () => {
    try {
      const res = await fetch('/api/sap/config');
      if (res.ok) {
        const data = await res.json();
        if (data.url) setSapUrl(data.url);
        if (data.client) setSapClient(data.client);
        if (data.user) setSapUser(data.user);
        if (data.offline_mode !== undefined) setSapOfflineMode(data.offline_mode);
      }
    } catch {
      // Retain defaults
    }
  };

  const fetchGitConfig = async () => {
    try {
      const res = await fetch('/api/git/config');
      if (res.ok) {
        const data = await res.json();
        if (data.repo_url) {
          const sanitized = data.repo_url.replace(/rajeetcodeN/g, 'organization');
          setTargetRepoUrl(sanitized);
        }
        if (data.branch) setTargetBranch(data.branch);
      }
    } catch {
      // Retain default configuration
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(data);
        if (data.abapgit_installed !== undefined) {
          setAbapgitInstalled(data.abapgit_installed);
        }
      }
    } catch {
      setSystemStatus({
        status: 'offline',
        sap_connection: {
          success: true,
          mode: 'offline_simulation',
          message: 'SAP DEV reachable (Offline Mock Mode)',
          client: '100'
        },
        ai_provider: 'gemini'
      });
    }
  };

  // Voice Dictation Handlers (Speech to Text directly into fields)
  const toggleDictation = (target: 'requirement' | 'testScenarios') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListeningReq || isListeningTest) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListeningReq(false);
      setIsListeningTest(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      if (target === 'requirement') {
        setIsListeningReq(true);
      } else {
        setIsListeningTest(true);
      }

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript;
          }
        }
        if (transcript.trim()) {
          if (target === 'requirement') {
            setRequirement(prev => (prev ? prev + ' ' + transcript.trim() : transcript.trim()));
          } else {
            setTestScenarios(prev => (prev ? prev + ' ' + transcript.trim() : transcript.trim()));
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListeningReq(false);
        setIsListeningTest(false);
      };

      recognition.onend = () => {
        setIsListeningReq(false);
        setIsListeningTest(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListeningReq(false);
      setIsListeningTest(false);
    }
  };

  // Clipboard copy
  const handleCopyCode = () => {
    const codeToCopy = codeTab === 'class' ? classCode : codeTab === 'test' ? testCode : xmlCode;
    if (codeToCopy) {
      navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Connections Page Handlers
  const handleSaveSapConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sap/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: sapUrl,
          client: sapClient,
          user: sapUser,
          password: sapPassword,
          offline_mode: sapOfflineMode
        })
      });
      const data = await res.json();
      setSapPingResult(data.ping);
      setActionNotice(data.ping?.message || 'SAP connection updated successfully.');
      fetchSystemStatus();
    } catch {
      setActionNotice('Failed to update SAP connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSapPing = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sap/ping', { method: 'POST' });
      const data = await res.json();
      setSapPingResult(data);
      setActionNotice(data.message || 'SAP ping response received.');
      fetchSystemStatus();
    } catch {
      setActionNotice('SAP ping request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGitConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/git/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: targetRepoUrl,
          branch: targetBranch
        })
      });
      const data = await res.json();
      setActionNotice(`Git configuration saved: ${data.repo_url} [${data.branch}]`);
      fetchGitConfig();
    } catch {
      setActionNotice('Failed to save Git configuration.');
    } finally {
      setLoading(false);
    }
  };

  // ATC Check
  const runAtcCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/atc-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ object_name: className, object_type: 'CLAS' })
      });
      const data = await res.json();
      setAtcResult(data.atc);
      setActionNotice(data.message || 'ATC check completed.');
    } catch {
      setActionNotice('ATC check request failed.');
    } finally {
      setLoading(false);
    }
  };

  // CTS Transports
  const fetchTransports = async () => {
    try {
      const res = await fetch('/api/transport/list');
      const data = await res.json();
      setTransports(data.transports || []);
    } catch {
      // Ignore
    }
  };

  const createTransport = async () => {
    if (!transportDesc) return;
    setLoading(true);
    try {
      const res = await fetch('/api/transport/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: transportDesc })
      });
      await res.json();
      setTransportDesc('');
      fetchTransports();
      setActionNotice('Transport request created.');
    } catch {
      setActionNotice('Failed to create transport.');
    } finally {
      setLoading(false);
    }
  };

  const releaseTransport = async () => {
    if (!selectedTransport) return;
    setLoading(true);
    try {
      const res = await fetch('/api/transport/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transport_id: selectedTransport })
      });
      await res.json();
      fetchTransports();
      setSelectedTransport('');
      setActionNotice('Transport request released.');
    } catch {
      setActionNotice('Failed to release transport.');
    } finally {
      setLoading(false);
    }
  };

  const writeToSap = async () => {
    if (!classCode) return;
    setLoading(true);
    try {
      const res = await fetch('/api/write-to-sap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name: className, source_code: classCode })
      });
      await res.json();
      setActionNotice('Source code written directly into SAP DEV buffer.');
    } catch {
      setActionNotice('Failed to write to SAP.');
    } finally {
      setLoading(false);
    }
  };

  const triggerAbapgitPull = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/abapgit/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: targetRepoUrl, package: packageName })
      });
      await res.json();
      setActionNotice('abapGit pull executed.');
    } catch {
      setActionNotice('Failed to trigger abapGit pull.');
    } finally {
      setLoading(false);
    }
  };

  // AI Orchestrator: Stage 1 Clarification
  const handleClarify = async () => {
    if (!requirement.trim()) return;
    setIsClarifying(true);
    setActionNotice(null);
    setOrchestratorStage(1);

    try {
      const res = await fetch('/api/orchestrate/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement,
          object_type: objectType,
          class_name: className
        })
      });
      const data = await res.json();
      setClarificationData(data);
      const defaults: Record<string, string> = {};
      data.questions?.forEach((q: any) => {
        defaults[q.id] = q.default || q.options?.[0] || '';
      });
      setClarificationAnswers(defaults);
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: `Analyze & Clarify requirement: ${requirement}` },
        { role: 'assistant', content: `AI Stage 1: Clarified functional scope with ${data.questions?.length || 0} business decisions and ${data.detected_edge_cases?.length || 0} edge cases. Choose your preferred options to continue.` }
      ]);
    } catch {
      setActionNotice('Clarification analysis failed. Proceed with Quick Generate or Tight Loop.');
      setOrchestratorStage(0);
    } finally {
      setIsClarifying(false);
    }
  };

  const handleRunTightLoop = async () => {
    if (!requirement.trim()) return;
    setIsTightLoopRunning(true);
    setLoading(true);
    setActionNotice(null);
    setOrchestratorStage(1);

    try {
      setOrchestratorStage(2);
      const res = await fetch('/api/orchestrate/tight-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement,
          class_name: className,
          package_name: packageName,
          tables,
          object_type: objectType,
          test_scenarios: testScenarios,
          clarification_answers: clarificationAnswers,
          target_repo_url: targetRepoUrl,
          target_branch: targetBranch,
          max_retries: 3
        })
      });
      setOrchestratorStage(4);
      const data = await res.json();
      setOrchestratorStage(5);

      setPreviousClassCode(classCode);
      setClassCode(data.class_code);
      setTestCode(data.test_code);
      setXmlCode(data.xml_code);
      setSyntaxResult(data.syntax);
      setTestResult(data.unit_tests);
      if (data.atc) setAtcResult(data.atc);
      setSapState('ACTIVE');
      setOrchestratorStage(6);
      setTightLoopAudit(data.audit_trail || []);

      const itCount = data.completed_iteration || 1;
      const finalMsg = data.success 
        ? `Tight loop completed in ${itCount} iteration(s). Clean ABAP generated -> Git committed -> SAP synchronized -> Syntax valid (0 errors) -> 100% unit tests passed.`
        : `Tight loop completed with warnings after ${itCount} iteration(s). Inspect compiler diagnostics.`;

      setActionNotice(finalMsg);
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: `Run Automated Tight Loop: ${requirement}` },
        { role: 'assistant', content: finalMsg }
      ]);
    } catch {
      setActionNotice('Tight loop execution failed. Ensure backend API is online.');
      setOrchestratorStage(0);
    } finally {
      setIsTightLoopRunning(false);
      setLoading(false);
    }
  };

  const handlePullFromSap = async () => {
    if (!className.trim()) return;
    setLoading(true);
    try {
      if (objectType === 'report') {
        const res = await fetch(`/api/program/${className.trim()}`);
        const data = await res.json();
        if (data.source_code) {
          setPreviousClassCode(classCode);
          setClassCode(data.source_code);
          setActionNotice(data.message || `Loaded SE38 report ${className.toUpperCase()} from SAP DEV.`);
          setChatMessages(prev => [
            ...prev,
            { role: 'assistant', content: `Retrieved existing SE38 report ${className.toUpperCase()} source from SAP DEV. You can now inspect it or instruct modifications via conversational refinement.` }
          ]);
        } else {
          setActionNotice(data.message || 'Report not found in SAP DEV.');
        }
      } else {
        const res = await fetch(`/api/class/${className.trim()}`);
        const data = await res.json();
        if (data.source_code) {
          setPreviousClassCode(classCode);
          setClassCode(data.source_code);
          setActionNotice(data.message || `Loaded existing class ${className.toUpperCase()} from SAP DEV.`);
          setChatMessages(prev => [
            ...prev,
            { role: 'assistant', content: `Retrieved existing class ${className.toUpperCase()} source from SAP DEV. You can now inspect the code in the editor, compare diffs, or instruct refinements.` }
          ]);
        } else {
          setActionNotice(data.message || `Class ${className.toUpperCase()} not found in SAP DEV.`);
        }
      }
    } catch {
      setActionNotice('Failed to pull object from SAP.');
    } finally {
      setLoading(false);
    }
  };

  // API Actions: Synthesis & Verification Pipeline
  const handleGenerate = async (overrideAnswers?: Record<string, string>) => {
    if (!requirement.trim()) return;
    setLoading(true);
    setActionNotice(null);
    setOrchestratorStage(3);

    const answersToUse = overrideAnswers || clarificationAnswers;

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement,
          class_name: className,
          package_name: packageName,
          tables,
          object_type: objectType,
          test_scenarios: testScenarios,
          clarification_answers: answersToUse
        })
      });
      setOrchestratorStage(4);
      const data = await res.json();

      setOrchestratorStage(5);
      setPreviousClassCode(classCode);
      setClassCode(data.class_code);
      setTestCode(data.test_code);
      setXmlCode(data.xml_code);
      setSyntaxResult(data.syntax);
      setTestResult(data.unit_tests);
      if (data.atc) setAtcResult(data.atc);
      setSapState('INACTIVE');
      setOrchestratorStage(6);

      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: `Generate ABAP: ${requirement} (Object: ${className})` },
        { role: 'assistant', content: `Artifacts synthesized. Syntax: ${data.syntax?.has_errors ? 'FAIL' : 'VALID'}. Unit tests: ${data.unit_tests?.passed || 0}/${data.unit_tests?.total || 0} passed. ATC: ${data.atc?.errors || 0}E / ${data.atc?.warnings || 0}W.` }
      ]);
    } catch (err) {
      setActionNotice('Generation failed. Ensure backend API is active.');
      setOrchestratorStage(0);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!chatInput.trim()) return;
    const prompt = chatInput.trim();
    setChatInput('');
    setLoading(true);

    setChatMessages(prev => [...prev, { role: 'user', content: prompt }]);

    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          class_name: className,
          package_name: packageName,
          tables,
          object_type: objectType,
          test_scenarios: testScenarios
        })
      });
      const data = await res.json();

      setPreviousClassCode(classCode);
      setClassCode(data.class_code);
      setTestCode(data.test_code);
      setXmlCode(data.xml_code);
      setSyntaxResult(data.syntax);
      setTestResult(data.unit_tests);
      if (data.atc) setAtcResult(data.atc);

      setChatMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Refined ${data.class_name}: ${prompt}. Compiler syntax and unit tests updated.` }
      ]);
    } catch (err) {
      setActionNotice('Refinement request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSyntax = async () => {
    if (!classCode) return;
    setLoading(true);
    try {
      const res = await fetch('/api/syntax-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name: className, source_code: classCode })
      });
      const data = await res.json();
      setSyntaxResult(data);
      setActionNotice(data.message);
    } catch {
      setActionNotice('Syntax check request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunTests = async () => {
    if (!classCode) return;
    setLoading(true);
    try {
      const res = await fetch('/api/unit-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name: className })
      });
      const data = await res.json();
      setTestResult(data);
      setActionNotice(data.message);
    } catch {
      setActionNotice('Unit test execution request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!classCode) return;
    setLoading(true);
    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          class_name: className,
          transport_id: selectedTransport,
          auto_release: autoRelease
        })
      });
      const data = await res.json();
      if (data.success) {
        setSapState('ACTIVE');
      }
      setActionNotice(data.message);
    } catch {
      setActionNotice('Activation request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePushToGit = async () => {
    if (!classCode) return;
    setLoading(true);
    try {
      const res = await fetch('/api/git-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_name: className,
          class_code: classCode,
          test_code: testCode,
          xml_code: xmlCode,
          target_repo_url: targetRepoUrl,
          target_branch: targetBranch
        })
      });
      const data = await res.json();
      setActionNotice(data.message);
    } catch {
      setActionNotice('Git synchronization request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-100 font-sans text-slate-800 antialiased select-none">
      {/* Top Navbar */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-5 shadow-xs shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-600 text-white shadow-xs">
            <Code2 className="h-4.5 w-4.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-slate-900">SAP Clean ABAP Studio</span>
          </div>
        </div>

        {/* Center Navigation Tabs: 4 Main Hubs */}
        <nav className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200">
          <button
            onClick={() => setActiveTab('workbench')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'workbench' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Workbench
          </button>
          <button
            onClick={() => setActiveTab('connections')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'connections' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Link2 className="h-3.5 w-3.5 text-indigo-600" />
            Connections (SAP & Git)
          </button>
          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'inspector' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Terminal className="h-3.5 w-3.5 text-emerald-600" />
            Test & Syntax Inspector
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'guide' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 text-amber-600" />
            Architecture Guide
          </button>
        </nav>

        {/* Right Status & Controls */}
        <div className="flex items-center gap-2.5 text-xs">
          {/* SAP Connection Status Pill (Clickable -> Switches to Connections Tab) */}
          <button
            onClick={() => setActiveTab('connections')}
            title="Configure SAP & Git Connections"
            className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-1 border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer"
          >
            <span className={`h-2 w-2 rounded-full ${systemStatus?.sap_connection?.mode === 'live' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="font-mono text-[11px] text-slate-700 font-medium">
              SAP DEV: {systemStatus?.sap_connection?.mode === 'live' ? 'LIVE' : 'SIMULATION'} ({systemStatus?.sap_connection?.client || '100'})
            </span>
          </button>

          {/* Git Branch Badge */}
          <button
            onClick={() => setActiveTab('connections')}
            title="Target Git Remote"
            className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 border border-slate-200 text-slate-600 hover:border-slate-300 font-mono text-[11px]"
          >
            <GitBranch className="h-3 w-3 text-blue-600" />
            <span>origin/{targetBranch || 'main'}</span>
          </button>

          {/* Editor Theme Switch */}
          <button
            onClick={() => setEditorTheme(prev => prev === 'vs-light' ? 'vs-dark' : 'vs-light')}
            title={`Switch to ${editorTheme === 'vs-light' ? 'Dark' : 'Light'} Editor Theme`}
            className="flex items-center gap-1 rounded-md bg-slate-50 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition"
          >
            {editorTheme === 'vs-light' ? <Moon className="h-3.5 w-3.5 text-slate-600" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 overflow-hidden p-3 flex flex-col">
        {/* ========================================================= */}
        {/* WORKBENCH TAB (CLEAN, DE-CLUSTERED DASHBOARD) */}
        {/* ========================================================= */}
        {activeTab === 'workbench' && (
          <div className="flex flex-col h-full gap-2.5 overflow-hidden">
            {/* AI Closed-Loop Pipeline Stepper Ribbon (Slim & Modern) */}
            <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 shadow-xs shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Pipeline:</span>
              </div>

              {/* 5 Connected Steps */}
              <div className="flex items-center gap-1.5 flex-1 justify-center">
                {[
                  { step: 1, label: 'Clarify' },
                  { step: 2, label: 'Spec' },
                  { step: 3, label: 'Clean ABAP' },
                  { step: 4, label: 'Compiler' },
                  { step: 5, label: 'Unit Tests' },
                ].map(({ step, label }, idx) => {
                  const isCurrent = orchestratorStage === step;
                  const isDone = orchestratorStage > step || orchestratorStage === 6;
                  return (
                    <React.Fragment key={step}>
                      {idx > 0 && (
                        <div className={`h-0.5 w-4 rounded ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                      )}
                      <div
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                          isCurrent
                            ? 'bg-blue-600 text-white font-semibold shadow-xs ring-2 ring-blue-200'
                            : isDone
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <div className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                          isCurrent ? 'bg-white text-blue-600' : isDone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {isDone ? <Check className="h-2.5 w-2.5" /> : step}
                        </div>
                        <span className="text-[11px] font-medium">{label}</span>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Dynamic Status Pill */}
              <div className="shrink-0 text-right">
                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-mono text-blue-800 border border-blue-200">
                  {orchestratorStage === 0 && 'Ready for Intake'}
                  {orchestratorStage === 1 && 'Disambiguating Rules...'}
                  {orchestratorStage === 2 && 'Structuring Spec...'}
                  {orchestratorStage === 3 && 'Synthesizing Clean ABAP...'}
                  {orchestratorStage === 4 && 'In-Memory Compiler Check...'}
                  {orchestratorStage === 5 && 'Executing Unit Tests...'}
                  {orchestratorStage === 6 && 'Verification Complete'}
                </span>
              </div>
            </div>

            {/* Split 12-Column Workbench Grid */}
            <div className="grid flex-1 grid-cols-12 gap-2.5 overflow-hidden">
              {/* Left Column: Intake & Refinement */}
              <div className="col-span-5 flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                {/* Scrollable Intake Form */}
                <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">1. Requirement Intake</h2>
                      <p className="text-[11px] text-slate-500">Dictate business logic or enter specifications.</p>
                    </div>
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                      AI Generator
                    </span>
                  </div>

                  {/* Requirement Specification Styled Like a Modern Chat Box with Integrated Mic & Arrow Button */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                        Requirement Specification:
                      </label>
                      {isListeningReq && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                          Listening... Speak requirement
                        </span>
                      )}
                    </div>

                    <div className={`relative rounded-2xl border transition-all shadow-xs bg-white flex flex-col p-3 ${
                      isListeningReq 
                        ? 'border-rose-400 ring-2 ring-rose-100' 
                        : 'border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 hover:border-slate-400'
                    }`}>
                      <textarea
                        value={requirement}
                        onChange={(e) => setRequirement(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleRunTightLoop();
                          }
                        }}
                        rows={3}
                        className="w-full text-xs font-mono border-none focus:outline-none focus:ring-0 resize-none bg-transparent text-slate-900 placeholder-slate-400 p-0 leading-relaxed"
                        placeholder="Type business requirements or calculation rules... (Press Enter to run Tight Loop)"
                      />

                      {/* Integrated Bottom Toolbar with Hint, Mic & Arrow Submit */}
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400 font-mono select-none">
                          Enter to run Tight Loop &bull; Shift+Enter for newline
                        </span>
                        <div className="flex items-center gap-1.5">
                          {/* Mic Dictation Button */}
                          <button
                            type="button"
                            onClick={() => toggleDictation('requirement')}
                            title={isListeningReq ? 'Stop voice recording' : 'Voice Dictate'}
                            className={`h-7 w-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                              isListeningReq 
                                ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse' 
                                : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'
                            }`}
                          >
                            <Mic className="h-3.5 w-3.5" />
                          </button>

                          {/* Arrow Submit Button */}
                          <button
                            type="button"
                            onClick={handleRunTightLoop}
                            disabled={isTightLoopRunning || loading || !requirement.trim()}
                            title="Run Automated Tight Loop (Git -> SAP -> Test)"
                            className="h-7 w-7 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 disabled:hover:bg-blue-600 transition shadow-2xs cursor-pointer"
                          >
                            {isTightLoopRunning ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowUp className="h-3.5 w-3.5 stroke-[2.5]" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Acceptance Criteria Accordion */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowTestScenarios(prev => !prev)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:text-slate-900 transition"
                    >
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                        Acceptance Criteria & Test Scenarios
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <span>{showTestScenarios ? 'Collapse' : 'Add Scenarios (Optional)'}</span>
                        {showTestScenarios ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </div>
                    </button>
                    {showTestScenarios && (
                      <div className="p-2.5 pt-1 border-t border-slate-200 bg-white space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">Specify custom boundary test cases for ABAP Unit:</span>
                          <button
                            type="button"
                            onClick={() => toggleDictation('testScenarios')}
                            className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded transition ${
                              isListeningTest ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse' : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <Mic className="h-2.5 w-2.5" />
                            {isListeningTest ? 'Listening...' : 'Dictate'}
                          </button>
                        </div>
                        <textarea
                          value={testScenarios}
                          onChange={(e) => setTestScenarios(e.target.value)}
                          rows={2}
                          className="w-full rounded border border-slate-300 p-2 text-xs font-mono focus:border-blue-600 focus:outline-none"
                          placeholder="e.g. Test 1: Order > 1000 gives 10%; Test 2: Negative amount raises cx_sy_conversion_overflow"
                        />
                      </div>
                    )}
                  </div>

                  {/* Compact Parameters Grid (2x2) */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Object Type:</label>
                      <select
                        value={objectType}
                        onChange={(e) => setObjectType(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                      >
                        <option value="class">Class</option>
                        <option value="report">Report</option>
                        <option value="interface">Interface</option>
                        <option value="function_module">Function Module</option>
                        <option value="cds_view">CDS View</option>
                        <option value="badi">BAdI Implementation</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">Object Name:</label>
                        <button
                          type="button"
                          onClick={handlePullFromSap}
                          disabled={loading || !className.trim()}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold"
                          title="Pull existing source code from SAP DEV into editor"
                        >
                          Pull SAP
                        </button>
                      </div>
                      <input
                        type="text"
                        value={className}
                        onChange={(e) => setClassName(e.target.value.toUpperCase())}
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">SAP Package:</label>
                      <input
                        type="text"
                        value={packageName}
                        onChange={(e) => setPackageName(e.target.value.toUpperCase())}
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Tables / CDS Views:</label>
                      <input
                        type="text"
                        value={tables}
                        onChange={(e) => setTables(e.target.value)}
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                        placeholder="e.g. VBAK, VBAP"
                      />
                    </div>
                  </div>

                  {/* Clarification Panel (When Active) */}
                  {clarificationData && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-blue-200 pb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                          <h3 className="text-xs font-bold text-blue-900">Stage 1: Business Logic Disambiguation</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setClarificationData(null)}
                          className="text-[10px] text-slate-500 hover:text-slate-800"
                        >
                          Dismiss
                        </button>
                      </div>

                      {clarificationData.detected_edge_cases?.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block mb-1">
                            Detected Edge Cases:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {clarificationData.detected_edge_cases.map((ec: string, idx: number) => (
                              <span key={idx} className="rounded bg-white border border-blue-200 px-1.5 py-0.5 text-[10px] text-blue-900">
                                {ec}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                          Confirm Technical Decisions:
                        </span>
                        {clarificationData.questions?.map((q: any) => (
                          <div key={q.id} className="rounded border border-blue-100 bg-white p-2 text-xs space-y-1 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-800">{q.question}</span>
                              <span className="text-[9px] rounded bg-slate-100 text-slate-600 px-1 py-0.5">{q.category}</span>
                            </div>
                            <div className="flex flex-col gap-1 pt-1">
                              {q.options?.map((opt: string, optIdx: number) => (
                                <label key={optIdx} className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700 hover:text-blue-700">
                                  <input
                                    type="radio"
                                    name={q.id}
                                    value={opt}
                                    checked={clarificationAnswers[q.id] === opt}
                                    onChange={() => setClarificationAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                    className="text-blue-600 focus:ring-blue-500"
                                  />
                                  <span>{opt}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGenerate(clarificationAnswers)}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-700 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-800 transition"
                      >
                        {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        Confirm Decisions & Synthesize Clean ABAP
                      </button>
                    </div>
                  )}

                  {/* Primary & Secondary Action CTAs */}
                  <div className="space-y-1.5 pt-1">
                    <button
                      type="button"
                      onClick={handleRunTightLoop}
                      disabled={isTightLoopRunning || loading || !requirement.trim()}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 py-2 text-xs font-bold text-white shadow-xs hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 transition-all"
                      title="Generates code, creates atomic git commit, syncs to SAP, tests in-memory and self-heals"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isTightLoopRunning ? 'animate-spin' : ''}`} />
                      Run Automated Tight Loop (Git &rarr; SAP Sync &rarr; Test)
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={handleClarify}
                        disabled={isClarifying || loading || !requirement.trim()}
                        className="flex items-center justify-center gap-1.5 rounded-md bg-blue-50 border border-blue-200 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition"
                      >
                        <Layers className="h-3 w-3" />
                        Analyze & Clarify
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerate()}
                        disabled={loading || !requirement.trim()}
                        className="flex items-center justify-center gap-1.5 rounded-md bg-slate-50 border border-slate-300 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition"
                      >
                        <Play className="h-3 w-3 text-slate-500" />
                        Quick Generate
                      </button>
                    </div>
                  </div>
                </div>

                {/* Conversational Refinement (Pinned Bottom Section) */}
                <div className="border-t border-slate-200 bg-slate-50/80 p-3 flex flex-col h-56 shrink-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">2. Conversational Refinement</h3>
                      <p className="text-[10px] text-slate-500">Request modifications or additional business methods.</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">Interactive Loop</span>
                  </div>

                  {/* Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 rounded-lg border border-slate-200 bg-white p-2 text-xs">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`rounded-md p-2 text-xs leading-relaxed ${
                          msg.role === 'user' 
                            ? 'bg-blue-50 border border-blue-200 text-blue-900 ml-4' 
                            : 'bg-slate-50 border border-slate-200 text-slate-800 mr-4'
                        }`}
                      >
                        <span className="font-bold text-[9px] uppercase tracking-wider text-slate-500 block mb-0.5">
                          {msg.role === 'user' ? 'User' : 'Studio Assistant'}
                        </span>
                        {msg.content}
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Modern Chat Input with Arrow Icon */}
                  <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 shadow-2xs focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 hover:border-slate-400 transition">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                      placeholder="Ask to modify exceptions, thresholds, new methods..."
                      className="flex-1 border-none bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-0 p-0"
                    />
                    <button
                      type="button"
                      onClick={handleRefine}
                      disabled={loading || !chatInput.trim()}
                      title="Send refinement message"
                      className="h-6 w-6 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 transition shadow-2xs cursor-pointer shrink-0"
                    >
                      <ArrowUp className="h-3 w-3 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Code Studio & Operations */}
              <div className="col-span-7 flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden p-3 gap-2">
                {/* Row 1: Code Tabs (Left) & Quality Check Actions (Right) */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 shrink-0">
                  {/* Left: Code Tabs */}
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      onClick={() => setCodeTab('class')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                        codeTab === 'class' 
                          ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <FileCode className="h-3 w-3" />
                      {className.toLowerCase()}.clas.abap
                    </button>
                    <button
                      onClick={() => setCodeTab('test')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                        codeTab === 'test' 
                          ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      locals_imp.abap (Tests)
                    </button>
                    <button
                      onClick={() => setCodeTab('xml')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                        codeTab === 'xml' 
                          ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <GitCommit className="h-3 w-3" />
                      .clas.xml
                    </button>
                    <button
                      onClick={() => setCodeTab('diff')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono transition cursor-pointer ${
                        codeTab === 'diff' 
                          ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <GitBranch className="h-3 w-3" />
                      Diff
                    </button>
                  </div>

                  {/* Right: Validation Actions & Copy */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCheckSyntax}
                      disabled={loading || !classCode}
                      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
                      title="Run In-Memory Syntax Check"
                    >
                      <CheckCircle className="h-3 w-3 text-emerald-600" />
                      Syntax
                    </button>
                    <button
                      onClick={handleRunTests}
                      disabled={loading || !classCode}
                      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
                      title="Execute ABAP Unit Test Suite"
                    >
                      <Play className="h-3 w-3 text-blue-600" />
                      Tests
                    </button>
                    <button
                      onClick={runAtcCheck}
                      disabled={loading || !classCode}
                      className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
                      title="Run ABAP Test Cockpit (ATC)"
                    >
                      <ShieldCheck className="h-3 w-3 text-indigo-600" />
                      ATC
                    </button>
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      title="Copy code to clipboard"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Row 2: Telemetry Badges (Left) & Deployment Actions (Right) */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs shrink-0">
                  {/* Left: Telemetry Status Badges */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Compiler Syntax */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Syntax:</span>
                      {syntaxResult === null ? (
                        <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">PENDING</span>
                      ) : !syntaxResult.has_errors ? (
                        <span className="rounded bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 text-[10px] font-mono font-bold text-emerald-800">
                          VALID (0 ERR)
                        </span>
                      ) : (
                        <span className="rounded bg-rose-100 border border-rose-300 px-1.5 py-0.2 text-[10px] font-mono font-bold text-rose-800">
                          {syntaxResult.errors?.length || 1} ERRORS
                        </span>
                      )}
                    </div>

                    <div className="h-3 w-px bg-slate-300 hidden sm:block" />

                    {/* Unit Tests */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Tests:</span>
                      {testResult === null ? (
                        <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-mono text-slate-600">NOT RUN</span>
                      ) : testResult.failed === 0 ? (
                        <span className="rounded bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 text-[10px] font-mono font-bold text-emerald-800">
                          {testResult.passed}/{testResult.total} PASSED (100%)
                        </span>
                      ) : (
                        <span className="rounded bg-rose-100 border border-rose-300 px-1.5 py-0.2 text-[10px] font-mono font-bold text-rose-800">
                          {testResult.failed} FAILED
                        </span>
                      )}
                    </div>

                    <div className="h-3 w-px bg-slate-300 hidden sm:block" />

                    {/* ATC Static Analysis */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">ATC:</span>
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-0.2 text-[10px] font-mono text-slate-700">
                        {atcResult ? `${atcResult.errors}E / ${atcResult.warnings}W / ${atcResult.infos}I` : 'Pending'}
                      </span>
                    </div>

                    <div className="h-3 w-px bg-slate-300 hidden sm:block" />

                    {/* SAP State */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">State:</span>
                      <span className={`rounded px-1.5 py-0.2 text-[10px] font-mono font-bold border ${
                        sapState === 'ACTIVE'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : 'bg-amber-100 border-amber-300 text-amber-800'
                      }`}>
                        {sapState}
                      </span>
                    </div>

                    <div className="h-3 w-px bg-slate-300 hidden sm:block" />

                    {/* Package */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Package:</span>
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-0.2 text-[10px] font-mono font-bold text-slate-700">
                        {packageName}
                      </span>
                    </div>

                    {tightLoopAudit.length > 0 && (
                      <span className="rounded bg-emerald-50 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        Tight Loop: {tightLoopAudit.length} Verified
                      </span>
                    )}
                  </div>

                  {/* Right: Deployment Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={handleActivate}
                      disabled={loading || !classCode}
                      className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                      title="Activate in SAP DEV (Requires developer review)"
                    >
                      <Server className="h-3 w-3" />
                      Activate in SAP
                    </button>
                    <button
                      onClick={handlePushToGit}
                      disabled={loading || !classCode}
                      className="flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-slate-900 disabled:opacity-50 transition cursor-pointer"
                      title={`Commit & Push to ${targetBranch || 'main'}`}
                    >
                      <GitBranch className="h-3 w-3" />
                      Push Git
                    </button>
                    <button
                      onClick={writeToSap}
                      disabled={loading || !classCode}
                      className="flex items-center gap-1 rounded-md border border-purple-300 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition cursor-pointer"
                      title="Direct ADT Write into SAP memory buffer"
                    >
                      <Server className="h-3 w-3" />
                      Direct ADT
                    </button>
                  </div>
                </div>

                {/* Toast Notification Banner */}
                {actionNotice && (
                  <div className={`rounded-lg px-3 py-1.5 text-xs flex items-center justify-between shrink-0 shadow-2xs ${
                    actionNotice.includes('401') || actionNotice.toLowerCase().includes('logon failed')
                      ? 'bg-amber-50 border border-amber-200 text-amber-900'
                      : 'bg-blue-50 border border-blue-200 text-blue-900'
                  }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <AlertCircle className={`h-3.5 w-3.5 shrink-0 ${
                        actionNotice.includes('401') || actionNotice.toLowerCase().includes('logon failed')
                          ? 'text-amber-600'
                          : 'text-blue-600'
                      }`} />
                      <span>{actionNotice}</span>
                      {(actionNotice.includes('401') || actionNotice.toLowerCase().includes('logon failed')) && (
                        <button
                          type="button"
                          onClick={() => window.open(`${sapUrl}/sap/bc/adt/discovery`, '_blank')}
                          className="inline-flex items-center gap-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 px-2 py-0.5 text-[11px] font-semibold transition ml-2 cursor-pointer"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Open SAP Logon Page</span>
                        </button>
                      )}
                    </div>
                    <button 
                      onClick={() => setActionNotice(null)} 
                      className="text-slate-400 hover:text-slate-700 font-bold ml-2 text-xs cursor-pointer"
                    >
                      &times;
                    </button>
                  </div>
                )}

                {/* Monaco Editor Canvas (Full Vertical Space) */}
                <div className="flex-1 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-inner">
                  {codeTab === 'class' && (
                    <Editor
                      height="100%"
                      language="apex"
                      theme={editorTheme}
                      value={classCode || '* Click Run Automated Tight Loop or Quick Generate to synthesize Clean ABAP class.'}
                      onChange={(val) => setClassCode(val || '')}
                      options={{ 
                        minimap: { enabled: false }, 
                        fontSize: 12, 
                        lineNumbers: 'on', 
                        scrollBeyondLastLine: false,
                        renderWhitespace: 'selection',
                        automaticLayout: true,
                        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace'
                      }}
                    />
                  )}
                  {codeTab === 'test' && (
                    <Editor
                      height="100%"
                      language="apex"
                      theme={editorTheme}
                      value={testCode || '* ABAP Unit test suite will appear here.'}
                      onChange={(val) => setTestCode(val || '')}
                      options={{ 
                        minimap: { enabled: false }, 
                        fontSize: 12, 
                        lineNumbers: 'on', 
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace'
                      }}
                    />
                  )}
                  {codeTab === 'xml' && (
                    <Editor
                      height="100%"
                      language="xml"
                      theme={editorTheme}
                      value={xmlCode || '<!-- abapGit XML metadata definition -->'}
                      onChange={(val) => setXmlCode(val || '')}
                      options={{ 
                        minimap: { enabled: false }, 
                        fontSize: 12, 
                        lineNumbers: 'on', 
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace'
                      }}
                    />
                  )}
                  {codeTab === 'diff' && (
                    <DiffEditor
                      height="100%"
                      language="apex"
                      theme={editorTheme}
                      original={previousClassCode || classCode}
                      modified={classCode}
                      options={{ 
                        minimap: { enabled: false }, 
                        fontSize: 12, 
                        readOnly: true,
                        automaticLayout: true,
                        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace'
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* CONNECTIONS TAB: SAP & GIT CONFIGURATION CENTER */}
        {/* ========================================================= */}
        {activeTab === 'connections' && (
          <div className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-xs overflow-y-auto space-y-6">
            <div>
              <h1 className="text-lg font-bold text-slate-900">System Connections & DevOps Hub</h1>
              <p className="text-xs text-slate-500">Configure connection parameters for on-premise SAP DEV systems, Git repositories, and CTS transports.</p>
            </div>

            <div className="grid grid-cols-3 gap-5">
              {/* Card 1: SAP DEV Connection */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-blue-600" />
                      <h3 className="text-xs font-bold uppercase text-slate-800">SAP DEV Connection</h3>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                      systemStatus?.sap_connection?.mode === 'live' 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {systemStatus?.sap_connection?.mode === 'live' ? 'LIVE CONNECTED' : 'SIMULATION MODE'}
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block">SAP Base URL:</label>
                    <input
                      type="text"
                      value={sapUrl}
                      onChange={(e) => setSapUrl(e.target.value)}
                      placeholder="http://sap-dev-host:8000"
                      className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block">SAP Client:</label>
                      <input
                        type="text"
                        value={sapClient}
                        onChange={(e) => setSapClient(e.target.value)}
                        placeholder="100"
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block">Username:</label>
                      <input
                        type="text"
                        value={sapUser}
                        onChange={(e) => setSapUser(e.target.value)}
                        placeholder="DEVELOPER"
                        className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block">Password:</label>
                    <input
                      type="password"
                      value={sapPassword}
                      onChange={(e) => setSapPassword(e.target.value)}
                      placeholder="Leave blank to retain configured password"
                      className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">Operating Mode:</label>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                        <input
                          type="radio"
                          name="sapMode"
                          checked={!sapOfflineMode}
                          onChange={() => setSapOfflineMode(false)}
                          className="text-blue-600"
                        />
                        <span>Live SAP Instance (Requires SICF /sap/bc/adt active)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                        <input
                          type="radio"
                          name="sapMode"
                          checked={sapOfflineMode}
                          onChange={() => setSapOfflineMode(true)}
                          className="text-blue-600"
                        />
                        <span>Offline Simulation (In-memory mock for disconnected work)</span>
                      </label>
                    </div>
                  </div>

                  {/* Ping Result Box */}
                  {sapPingResult && (
                    <div className="rounded border border-slate-200 bg-white p-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Ping Result: {sapPingResult.mode}</span>
                      </div>
                      <p className="text-[11px] text-slate-600">{sapPingResult.message}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex gap-2">
                    <button
                      onClick={handleTestSapPing}
                      disabled={loading}
                      className="flex-1 rounded-md border border-slate-300 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Test ADT Ping
                    </button>
                    <button
                      onClick={handleSaveSapConfig}
                      disabled={loading}
                      className="flex-1 rounded-md bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition cursor-pointer"
                    >
                      Save SAP Config
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(`${sapUrl}/sap/bc/adt/discovery`, '_blank')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition cursor-pointer"
                      title="Open SAP BTP Discovery / Logon endpoint in a new browser tab"
                    >
                      <ExternalLink className="h-3 w-3 text-slate-500" />
                      <span>Logon in Browser</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open('https://cockpit.hanatrial.ondemand.com', '_blank')}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition cursor-pointer"
                      title="Open SAP BTP Trial Cockpit"
                    >
                      <ExternalLink className="h-3 w-3 text-slate-500" />
                      <span>BTP Cockpit</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Card 2: Git & abapGit Repository */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-indigo-600" />
                      <h3 className="text-xs font-bold uppercase text-slate-800">Git & abapGit Channel</h3>
                    </div>
                    <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700 font-mono">
                      origin/{targetBranch || 'main'}
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block">Target Git Remote URL:</label>
                    <input
                      type="text"
                      value={targetRepoUrl}
                      onChange={(e) => setTargetRepoUrl(e.target.value)}
                      placeholder="https://github.com/organization/abap_ai.git"
                      className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-slate-500">Atomic commits and generated artifacts are pushed to this destination.</p>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block">Target Branch:</label>
                    <input
                      type="text"
                      value={targetBranch}
                      onChange={(e) => setTargetBranch(e.target.value)}
                      placeholder="main"
                      className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div className="rounded border border-slate-200 bg-white p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">abapGit System Status:</span>
                      <span className={`font-bold ${abapgitInstalled ? 'text-emerald-600' : 'text-slate-600'}`}>
                        {abapgitInstalled ? 'Installed (ZABAPGIT)' : 'Standard RFC Mode'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">abapGit pulls /src/ artifacts into SAP DEV packages automatically during the tight loop.</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={triggerAbapgitPull}
                    disabled={loading}
                    className="flex-1 rounded-md border border-slate-300 bg-white py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Trigger abapGit Pull
                  </button>
                  <button
                    onClick={handleSaveGitConfig}
                    disabled={loading}
                    className="flex-1 rounded-md bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    Save Git Config
                  </button>
                </div>
              </div>

              {/* Card 3: CTS Transport Request Management */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3.5 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-emerald-600" />
                      <h3 className="text-xs font-bold uppercase text-slate-800">CTS Transports</h3>
                    </div>
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      SE09 / SE10
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block">Active Transport Request:</label>
                    <select
                      value={selectedTransport}
                      onChange={(e) => setSelectedTransport(e.target.value)}
                      className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                    >
                      <option value="">$TMP (Local Object - No Transport)</option>
                      {transports.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.id} - {t.description}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-700 block">Create New Transport:</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={transportDesc}
                        onChange={(e) => setTransportDesc(e.target.value)}
                        placeholder="Transport description..."
                        className="flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                      <button
                        onClick={createTransport}
                        disabled={loading || !transportDesc.trim()}
                        className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                      >
                        Create
                      </button>
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={autoRelease}
                        onChange={(e) => setAutoRelease(e.target.checked)}
                        className="rounded text-blue-600"
                      />
                      <span>Auto-release transport upon activation</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <button
                    onClick={releaseTransport}
                    disabled={loading || !selectedTransport}
                    className="w-full rounded-md border border-amber-300 bg-amber-50 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition"
                  >
                    Release Selected Transport ({selectedTransport || 'None Selected'})
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* INSPECTOR VIEW */}
        {/* ========================================================= */}
        {activeTab === 'inspector' && (
          <div className="grid h-full grid-cols-2 gap-3 overflow-hidden">
            {/* In-Memory Syntax Diagnostics */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">In-Memory Syntax Diagnostics</h2>
                  <p className="text-[11px] text-slate-500">Live compiler analysis from /sap/bc/adt/syntaxcheck</p>
                </div>
                <button
                  onClick={handleCheckSyntax}
                  disabled={loading || !classCode}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Re-check Syntax
                </button>
              </div>

              {syntaxResult === null ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                  No syntax check executed yet. Generate code or click Re-check Syntax.
                </div>
              ) : !syntaxResult.has_errors ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    [SYNTAX VALID] 0 Compiler Errors
                  </div>
                  <p className="mt-1 text-xs text-emerald-700">{syntaxResult.message}</p>
                  <p className="mt-2 text-[10px] text-emerald-600 font-mono">Validated in memory against SAP 7.50+ / S/4HANA specification.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-rose-600" />
                    [SYNTAX ERRORS DETECTED]
                  </div>
                  <div className="space-y-1.5">
                    {syntaxResult.errors?.map((err, idx) => (
                      <div key={idx} className="rounded-lg border border-rose-200 bg-white p-2.5 text-xs text-slate-800">
                        <span className="font-mono font-bold text-rose-600">Line {err.line}:</span> {err.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ABAP Unit Test Suite Execution */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs overflow-y-auto space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">ABAP Unit Test Suite Execution</h2>
                  <p className="text-[11px] text-slate-500">Test results from /sap/bc/adt/abapunit/testruns</p>
                </div>
                <button
                  onClick={handleRunTests}
                  disabled={loading || !classCode}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Re-run Unit Tests
                </button>
              </div>

              {testResult === null ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                  No unit tests executed yet.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                    <div>
                      <span className="font-semibold text-slate-800 block">Class: {className}</span>
                      <span className="text-slate-500 font-mono text-[10px]">Execution Time: {testResult.duration_ms || 12} ms</span>
                    </div>
                    <span className={`rounded px-2.5 py-1 font-bold text-xs font-mono border ${
                      testResult.failed === 0 
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800' 
                        : 'bg-rose-100 border-rose-300 text-rose-800'
                    }`}>
                      {testResult.passed} / {testResult.total} PASSED ({testResult.total > 0 ? Math.round((testResult.passed / testResult.total) * 100) : 100}%)
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {testResult.test_cases?.map((tc, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between rounded-lg border p-2 text-xs ${
                          tc.status === 'PASSED'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border-rose-200 bg-rose-50 text-rose-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="font-mono font-medium">{tc.name}</span>
                        </div>
                        <span className="font-mono text-slate-500 text-[10px]">{tc.duration_ms || 4} ms</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ATC Findings */}
              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">ATC Static Code Findings</h3>
                {atcResult ? (
                  <div>
                    <div className="flex gap-4 mb-2 text-xs">
                      <span className="text-rose-600 font-semibold">Errors: {atcResult.errors}</span>
                      <span className="text-amber-600 font-semibold">Warnings: {atcResult.warnings}</span>
                      <span className="text-blue-600 font-semibold">Info: {atcResult.infos}</span>
                    </div>
                    <table className="w-full text-xs border border-slate-200 rounded">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 text-[10px]">
                          <th className="text-left py-1.5 px-2">Severity</th>
                          <th className="text-left py-1.5 px-2">Line</th>
                          <th className="text-left py-1.5 px-2">Check ID</th>
                          <th className="text-left py-1.5 px-2">Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atcResult.findings?.map((f: any, i: number) => (
                          <tr key={i} className="border-b border-slate-100 text-slate-700">
                            <td className="py-1 px-2 capitalize">{f.severity}</td>
                            <td className="py-1 px-2 font-mono">{f.line}</td>
                            <td className="py-1 px-2 font-mono text-[10px]">{f.check_id}</td>
                            <td className="py-1 px-2">{f.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No ATC results available. Run ATC from the workbench.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* ARCHITECTURE GUIDE TAB */}
        {/* ========================================================= */}
        {activeTab === 'guide' && (
          <div className="h-full flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {/* Guide Header & Navigation Filter */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    <h1 className="text-base font-bold text-slate-900">System Architecture & Operations Guide</h1>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Technical manual, execution diagrams, SAP ADT connection specifications, and abapGit serialization protocols.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 text-[11px]">
                  <span className="px-2 py-0.5 font-medium text-slate-400">Filter:</span>
                  {[
                    { id: 'all', label: 'All Sections' },
                    { id: 'overview', label: '1. Overview & Diagram' },
                    { id: 'dual-channel', label: '2. Dual-Channel Model' },
                    { id: 'how-it-works', label: '3. How It Works (Loop)' },
                    { id: 'how-to-use', label: '4. How to Use' },
                    { id: 'connectivity', label: '5. SAP Connectivity' },
                    { id: 'abapgit-cts', label: '6. abapGit & CTS' },
                    { id: 'clean-abap', label: '7. Clean ABAP & Safety' },
                  ].map((sec) => (
                    <button
                      key={sec.id}
                      onClick={() => setGuideSection(sec.id as any)}
                      className={`px-2.5 py-1 rounded font-medium transition ${
                        guideSection === sec.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {sec.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Guide Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-12 scroll-smooth text-slate-700">

              {/* SECTION 1: SYSTEM OVERVIEW & ARCHITECTURE PHILOSOPHY */}
              {(guideSection === 'all' || guideSection === 'overview') && (
                <section id="guide-overview" className="space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-blue-700 border border-blue-200">
                      <Cpu className="h-3 w-3" /> Section 1: Platform Fundamentals & Architecture Blueprint
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-2">System Philosophy & Architecture Overview</h2>
                    <p className="text-xs text-slate-500">
                      Autonomous ABAP software engineering without manual copy-pasting or obsolete legacy syntax.
                    </p>
                  </div>

                  {/* MODERN LIGHT ARCHITECTURE BLUEPRINT (DIAGRAM 1) */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 shadow-xs space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <Workflow className="h-4 w-4 text-blue-600" />
                        <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">
                          System Architecture Diagram: End-to-End Component Topology
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 font-semibold">
                        Architecture Flow
                      </span>
                    </div>

                    {/* Layer 1: Developer Client */}
                    <div className="rounded-xl border border-blue-200 bg-white p-4 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-blue-600 text-white font-bold text-[10px] px-2 py-0.5 uppercase tracking-wide">Tier 1</span>
                          <span className="font-bold text-xs text-slate-900">Developer Client & React Studio</span>
                        </div>
                        <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Port 8080 (Vite / React)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs pt-1">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-900 block text-[11px]">Monaco Editor</span>
                          <span className="text-[10px] text-slate-500">Clean ABAP 7.50+ / vs-light</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-900 block text-[11px]">Dual-Tier Toolbar</span>
                          <span className="text-[10px] text-slate-500">Tabs, Syntax, Tests, Diff</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-900 block text-[11px]">Intake & Dictation</span>
                          <span className="text-[10px] text-slate-500">Voice Speech-to-Text & Chat</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-900 block text-[11px]">Live Diagnostics</span>
                          <span className="text-[10px] text-slate-500">Telemetry & Connections Hub</span>
                        </div>
                      </div>
                    </div>

                    {/* Connector 1 -> 2 */}
                    <div className="flex flex-col items-center justify-center -my-1 text-slate-400">
                      <div className="h-3 w-0.5 bg-slate-300" />
                      <span className="bg-white px-3 py-0.5 text-[10px] font-mono text-slate-600 border border-slate-200 rounded-full shadow-2xs font-medium">
                        REST API (HTTP / WebSockets)
                      </span>
                      <div className="h-3 w-0.5 bg-slate-300" />
                      <ArrowDown className="h-3.5 w-3.5 text-slate-500 -mt-1" />
                    </div>

                    {/* Layer 2: FastAPI Core Orchestrator */}
                    <div className="rounded-xl border border-indigo-200 bg-white p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-indigo-600 text-white font-bold text-[10px] px-2 py-0.5 uppercase tracking-wide">Tier 2</span>
                          <span className="font-bold text-xs text-slate-900">FastAPI Autonomous Orchestrator</span>
                        </div>
                        <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">Python 3.10+ (Uvicorn)</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-900 block text-[11px]">Disambiguation Engine</span>
                          <span className="text-[10px] text-indigo-600 font-mono block mb-1">POST /api/orchestrate/clarify</span>
                          <p className="text-[11px] text-slate-600 leading-snug">Evaluates requirements, identifies ambiguities, and formulates 3 decision cards.</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-900 block text-[11px]">Clean ABAP Synthesizer</span>
                          <span className="text-[10px] text-indigo-600 font-mono block mb-1">POST /api/orchestrate/tight-loop</span>
                          <p className="text-[11px] text-slate-600 leading-snug">Synthesizes .clas.abap, locals_imp.abap, and .clas.xml multi-file artifacts.</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="font-semibold text-slate-900 block text-[11px]">Autonomous Self-Healing</span>
                          <span className="text-[10px] text-indigo-600 font-mono block mb-1">Feedback Iteration Engine</span>
                          <p className="text-[11px] text-slate-600 leading-snug">Auto-repairs compiler errors and unit test failures across up to 3 passes.</p>
                        </div>
                      </div>

                      {/* Sub-components of Tier 2 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                        <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-slate-900 block text-[11px]">Git & abapGit Bridge</span>
                            <span className="text-[10px] text-slate-500">Atomic commits, /src multi-file layout, CTS transport assignment</span>
                          </div>
                          <GitBranch className="h-4 w-4 text-indigo-600 shrink-0" />
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-slate-900 block text-[11px]">SAP ADT REST Client</span>
                            <span className="text-[10px] text-slate-500">CSRF token handling, in-memory /syntaxcheck, /abapunit, /activation</span>
                          </div>
                          <Server className="h-4 w-4 text-indigo-600 shrink-0" />
                        </div>
                      </div>
                    </div>

                    {/* Dual Connector 2 -> 3 */}
                    <div className="grid grid-cols-2 gap-4 -my-1 text-slate-400">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-0.5 bg-slate-300" />
                        <span className="bg-white px-2.5 py-0.5 text-[10px] font-mono text-slate-600 border border-slate-200 rounded-full shadow-2xs font-medium">
                          Git Push (HTTPS/SSH)
                        </span>
                        <div className="h-3 w-0.5 bg-slate-300" />
                        <ArrowDown className="h-3.5 w-3.5 text-slate-500 -mt-1" />
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-0.5 bg-slate-300" />
                        <span className="bg-white px-2.5 py-0.5 text-[10px] font-mono text-slate-600 border border-slate-200 rounded-full shadow-2xs font-medium">
                          ADT REST (/sap/bc/adt/*)
                        </span>
                        <div className="h-3 w-0.5 bg-slate-300" />
                        <ArrowDown className="h-3.5 w-3.5 text-slate-500 -mt-1" />
                      </div>
                    </div>

                    {/* Layer 3: Remote Repository & SAP Server */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Remote Git Target */}
                      <div className="rounded-xl border border-blue-200 bg-white p-4 space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                            <GitCommit className="h-3.5 w-3.5 text-blue-600" />
                            Remote Git Repository (GitHub / GitLab)
                          </div>
                          <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Version Control</span>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 font-mono text-[10px] space-y-0.5 text-slate-700">
                          <div>/src/ZCL_ORDER_DISCOUNT.clas.abap</div>
                          <div>/src/ZCL_ORDER_DISCOUNT.clas.locals_imp.abap</div>
                          <div>/src/ZCL_ORDER_DISCOUNT.clas.xml</div>
                          <div>/src/package.devc.xml</div>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Full audit trail with SHA-1 commits, branch tracking, and abapGit sync pull trigger.
                        </p>
                      </div>

                      {/* On-Premise SAP Server */}
                      <div className="rounded-xl border border-emerald-200 bg-white p-4 space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                            <Server className="h-3.5 w-3.5 text-emerald-600" />
                            On-Premise SAP DEV System
                          </div>
                          <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">NetWeaver 7.50+ / S/4HANA</span>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200 font-mono text-[10px] space-y-0.5 text-slate-700">
                          <div>/sap/bc/adt/syntaxcheck (In-Memory Compiler)</div>
                          <div>/sap/bc/adt/abapunit/testruns (Kernel Test Runner)</div>
                          <div>/sap/bc/adt/activation (DDIC Activation Gate)</div>
                          <div>abapGit Pull (ZABAPGIT Package Sync)</div>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Live kernel execution, Data Dictionary verification, and CTS Workbench Transport assignment.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-rose-700 font-semibold text-xs">
                        <AlertCircle className="h-4 w-4" />
                        The Obsolete Syntax Trap
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Public LLMs default to procedural ABAP constructs from the 1990s (FORM routines, header lines, non-Unicode syntax). This studio enforces strict modern Clean ABAP 7.50+ patterns (expressions, inline data, OOP).
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-amber-700 font-semibold text-xs">
                        <Database className="h-4 w-4" />
                        The Hallucinated DDIC Barrier
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Disconnected chatbots invent non-existent table joins and invalid fields. This studio integrates directly with live SAP Data Dictionary in memory to validate structures before committing code.
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-blue-700 font-semibold text-xs">
                        <GitBranch className="h-4 w-4" />
                        The Copy-Paste & Audit Breach
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Copying code into SAP GUI SE24/SE38 loses version history, skips automated unit testing, and bypasses pull requests. This studio serializes code into standard abapGit multi-file repositories for auditability.
                      </p>
                    </div>
                  </div>

                  {/* 4 Architectural Pillars */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Core Architectural Components</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <span className="font-semibold text-slate-900 block mb-1">FastAPI Orchestrator</span>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          Python backend managing prompt composition, state persistence, ADT REST endpoints, and the self-healing iteration engine.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <span className="font-semibold text-slate-900 block mb-1">React Studio Workbench</span>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          Tailwind-powered developer UI featuring Monaco ABAP editors, dual-tier command toolbar, interactive diffs, and speech dictation.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <span className="font-semibold text-slate-900 block mb-1">SAP ADT REST Client</span>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          Authenticated HTTP/HTTPS client handling SAP CSRF tokens, session cookies, and ADT XML payloads for syntax check, tests, and activation.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                        <span className="font-semibold text-slate-900 block mb-1">abapGit & CTS Bridge</span>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          Serializes classes into multi-file Git structures (.clas.abap, .locals_imp.abap, .clas.xml) with atomic commits and CTS Workbench Transport tracking.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* SECTION 2: DUAL-CHANNEL EXECUTION MODEL */}
              {(guideSection === 'all' || guideSection === 'dual-channel') && (
                <section id="guide-dual-channel" className="space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-indigo-700 border border-indigo-200">
                      <Workflow className="h-3 w-3" /> Section 2: Deployment Pipelines & Flowchart
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-2">Dual-Channel Deployment Model: Git & abapGit vs Direct ADT</h2>
                    <p className="text-xs text-slate-500">
                      Visual comparison and architectural breakdown between repository-first version control and direct buffer prototyping.
                    </p>
                  </div>

                  {/* Visual Stepper Nodes */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-6">
                    {/* Channel A Flow */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-blue-600 text-white font-bold text-[10px] px-2 py-0.5 uppercase tracking-wide">Channel A</span>
                          <span className="font-bold text-xs text-blue-900">Git & abapGit Repository Channel (Recommended DevOps Flow)</span>
                        </div>
                        <span className="text-[10px] font-mono text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200">Audited / Production CI/CD</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2">
                        {[
                          { step: '1', title: 'AI Synthesis', desc: 'Synthesizes Clean ABAP & ABAP Unit tests' },
                          { step: '2', title: 'Serialization', desc: '.clas.abap, locals_imp, and .clas.xml written to /src' },
                          { step: '3', title: 'Git Commit & Push', desc: 'Atomic commit pushed to GitHub/GitLab remote branch' },
                          { step: '4', title: 'abapGit Pull', desc: 'Pulls remote branch directly into target SAP package' },
                          { step: '5', title: 'Human Gate', desc: 'Developer reviews diff and approves activation' },
                          { step: '6', title: 'CTS Release', desc: 'Changes captured in Workbench Transport Request' },
                        ].map((node, i) => (
                          <div key={i} className="relative rounded-lg border border-blue-200 bg-white p-2.5 text-center shadow-2xs">
                            <span className="inline-block rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold h-5 w-5 leading-5 mb-1">
                              {node.step}
                            </span>
                            <div className="font-bold text-[11px] text-slate-900">{node.title}</div>
                            <div className="text-[10px] text-slate-500 mt-1 leading-tight">{node.desc}</div>
                          </div>
                        ))}
                      </div>

                      <div className="text-[11px] text-blue-900 bg-white/80 rounded-lg p-3 border border-blue-100 space-y-1">
                        <span className="font-semibold block">Key Characteristics:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                          <li>Total auditability: Every change tracked via immutable Git commits with author signatures.</li>
                          <li>Branching & Pull Requests: Enables collaborative review and conflict resolution before merging.</li>
                          <li>abapGit Standard: Objects conform to open-source abapGit serialization schema.</li>
                        </ul>
                      </div>
                    </div>

                    {/* Channel B Flow */}
                    <div className="rounded-xl border border-slate-300 bg-white p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-700 text-white font-bold text-[10px] px-2 py-0.5 uppercase tracking-wide">Channel B</span>
                          <span className="font-bold text-xs text-slate-900">Direct ADT REST Channel (Rapid Prototyping Flow)</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Scratchpad / Sandbox Iteration</span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2">
                        {[
                          { step: '1', title: 'AI Synthesis', desc: 'Synthesizes single-buffer class implementation' },
                          { step: '2', title: 'Lock Object', desc: 'Acquires developer lock on class in SAP' },
                          { step: '3', title: 'PUT Source', desc: 'Writes buffer to /oo/classes/.../source/main' },
                          { step: '4', title: 'In-Memory Check', desc: 'Validates syntax against live compiler' },
                          { step: '5', title: 'Human Gate', desc: 'Developer verifies tests and gives confirmation' },
                          { step: '6', title: 'DDIC Activate', desc: 'Transitions object from Inactive to Active' },
                        ].map((node, i) => (
                          <div key={i} className="relative rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-center shadow-2xs">
                            <span className="inline-block rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold h-5 w-5 leading-5 mb-1">
                              {node.step}
                            </span>
                            <div className="font-bold text-[11px] text-slate-900">{node.title}</div>
                            <div className="text-[10px] text-slate-500 mt-1 leading-tight">{node.desc}</div>
                          </div>
                        ))}
                      </div>

                      <div className="text-[11px] text-slate-800 bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-1">
                        <span className="font-semibold block">Key Characteristics:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                          <li>Instant turnaround: Writes directly into SAP inactive runtime buffer without hitting Git.</li>
                          <li>Ideal for single-developer experiments, rapid bug investigation, and sandbox testing.</li>
                          <li>Bypasses remote Git branches; does not produce a Git audit trail.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Channel Comparison Table */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">Feature Comparison Matrix</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-600 font-semibold">
                            <th className="py-2 px-3">Dimension</th>
                            <th className="py-2 px-3 text-blue-800">Channel A: Git & abapGit</th>
                            <th className="py-2 px-3 text-slate-800">Channel B: Direct ADT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Primary Objective</td>
                            <td className="py-2 px-3 text-blue-900 font-medium">Audited Production CI/CD & Team Development</td>
                            <td className="py-2 px-3 text-slate-700">Rapid Sandbox Prototyping & Hotfixes</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Audit Trail</td>
                            <td className="py-2 px-3 text-slate-700">Full Git commit logs with SHA-1 hashes and branch tracking</td>
                            <td className="py-2 px-3 text-slate-700">SAP object version database in table VRSD</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Peer Review Support</td>
                            <td className="py-2 px-3 text-slate-700">GitHub/GitLab Pull Requests and diff inspections</td>
                            <td className="py-2 px-3 text-slate-700">Single-developer object lock</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Multi-File Serialization</td>
                            <td className="py-2 px-3 text-slate-700">Generates .clas.abap, locals_imp.abap, and .clas.xml</td>
                            <td className="py-2 px-3 text-slate-700">Single class source stream buffer</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Rollback Capability</td>
                            <td className="py-2 px-3 text-slate-700">Instant git revert or checkout of any historical commit</td>
                            <td className="py-2 px-3 text-slate-700">Manual rollback via SAP Version Management</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Transport Integration</td>
                            <td className="py-2 px-3 text-slate-700">CTS Workbench Transport Requests (SE09/SE10)</td>
                            <td className="py-2 px-3 text-slate-700">CTS Workbench Transport Requests (SE09/SE10)</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Activation Gate</td>
                            <td className="py-2 px-3 text-emerald-800 font-semibold">Strict Human Gate confirmation required</td>
                            <td className="py-2 px-3 text-emerald-800 font-semibold">Strict Human Gate confirmation required</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              )}

              {/* SECTION 3: HOW IT WORKS UNDER THE HOOD (6-STAGE CLOSED LOOP) */}
              {(guideSection === 'all' || guideSection === 'how-it-works') && (
                <section id="guide-how-it-works" className="space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-emerald-700 border border-emerald-200">
                      <RefreshCw className="h-3 w-3" /> Section 3: Execution Mechanism & Decision Flowchart
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-2">How It Works Under the Hood: The 6-Stage Autonomous Closed Loop</h2>
                    <p className="text-xs text-slate-500">
                      Detailed walkthrough of the automated synthesis, validation, self-healing, and activation cycle.
                    </p>
                  </div>

                  {/* Visual Stepper Pipeline */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      {
                        stage: 'Stage 1',
                        name: 'Clarification & Intake',
                        endpoint: 'POST /api/orchestrate/clarify',
                        desc: 'Evaluates functional requirements, identifies business ambiguities, and formulates 3 structured decision cards (Edge Cases, Database Tables, and Exception Handling).',
                        badge: 'Requirements Phase',
                        color: 'border-blue-200 bg-blue-50/30 text-blue-900'
                      },
                      {
                        stage: 'Stage 2',
                        name: 'Synthesis & Serialization',
                        endpoint: 'POST /api/orchestrate/tight-loop',
                        desc: 'Synthesizes Clean ABAP 7.50+ code across 3 files: global definition (.clas.abap), local test classes (.locals_imp.abap), and abapGit metadata envelope (.clas.xml).',
                        badge: 'Code Generation',
                        color: 'border-indigo-200 bg-indigo-50/30 text-indigo-900'
                      },
                      {
                        stage: 'Stage 3',
                        name: 'In-Memory Syntax Check',
                        endpoint: '/sap/bc/adt/syntaxcheck',
                        desc: 'Transmits code buffer to SAP ADT in-memory compiler. Validates syntax against live SAP Data Dictionary without persisting invalid code to the database.',
                        badge: 'Compiler Gate',
                        color: 'border-amber-200 bg-amber-50/30 text-amber-900'
                      },
                      {
                        stage: 'Stage 4',
                        name: 'ABAP Unit Test Execution',
                        endpoint: '/sap/bc/adt/abapunit/testruns',
                        desc: 'Executes test methods in the SAP kernel. Evaluates assertions (assert_equals, assert_bound) and measures execution durations in milliseconds.',
                        badge: 'Automated Testing',
                        color: 'border-purple-200 bg-purple-50/30 text-purple-900'
                      },
                      {
                        stage: 'Stage 5',
                        name: 'Self-Healing Feedback Loop',
                        endpoint: 'Iterative Autonomous Engine',
                        desc: 'If compiler errors or unit test failures occur, exact error lines and failure diagnostics are fed back into the model to auto-correct code across up to 3 passes.',
                        badge: 'Self-Healing',
                        color: 'border-rose-200 bg-rose-50/30 text-rose-900'
                      },
                      {
                        stage: 'Stage 6',
                        name: 'Human Review & Activation Gate',
                        endpoint: '/sap/bc/adt/activation',
                        desc: 'Autonomous execution pauses. The developer inspects side-by-side diffs and confirms activation. The system invokes ADT activation to transition from Inactive to Active.',
                        badge: 'Human Governance Gate',
                        color: 'border-emerald-200 bg-emerald-50/30 text-emerald-900'
                      },
                    ].map((step, idx) => (
                      <div key={idx} className={`rounded-xl border p-4 flex flex-col justify-between space-y-2.5 ${step.color}`}>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs uppercase tracking-wider">{step.stage}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 border border-slate-200">
                              {step.badge}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-slate-900 mt-1">{step.name}</h4>
                          <span className="font-mono text-[10px] text-slate-500 block mb-2">{step.endpoint}</span>
                          <p className="text-xs text-slate-700 leading-relaxed">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Self-Healing Mechanism Detail Callout */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">The Self-Healing Mechanism Explained</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      When an in-memory syntax error occurs (for example, missing variable declaration or illegal constructor expression), the orchestrator intercepts the exact line number, error code, and compiler description from the SAP ADT XML response. Rather than failing and halting, it automatically formats a diagnostic remediation payload and re-prompts the synthesizer. The synthesizer repairs the pinpointed line while maintaining Clean ABAP conventions. The loop re-runs syntax and unit tests until zero errors remain or the iteration threshold (3 passes) is met.
                    </p>
                  </div>
                </section>
              )}

              {/* SECTION 4: HOW TO USE (STEP-BY-STEP OPERATOR GUIDE) */}
              {(guideSection === 'all' || guideSection === 'how-to-use') && (
                <section id="guide-how-to-use" className="space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-cyan-700 border border-cyan-200">
                      <Terminal className="h-3 w-3" /> Section 4: Operator Manual & Process Workflow
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-2">How to Use the Studio: Step-by-Step Operator Guide</h2>
                    <p className="text-xs text-slate-500">
                      Practical instructions for developers and architects executing end-to-end ABAP workflows.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        step: 'Step 1',
                        title: 'Input Requirements via Prompt or Voice Dictation',
                        action: 'Enter functional description into the prompt box or click the microphone icon to speak requirements. Configure target Class Name (e.g., ZCL_ORDER_DISCOUNT), Package ($TMP for local or ZDEV for transportable development), and relevant database tables (e.g., VBAK, VBAP).'
                      },
                      {
                        step: 'Step 2',
                        title: 'Formulate Plan & Review Clarification Cards',
                        action: 'Click "Clarify & Formulate Plan". The assistant evaluates your input and renders 3 interactive decision cards: Business Logic Edge Cases, Database Schema Selection, and Error Handling Strategy. Select option chips to tailor behavior or proceed with recommended defaults.'
                      },
                      {
                        step: 'Step 3',
                        title: 'Execute the Automated Tight Loop',
                        action: 'Click "Run Automated Tight Loop" for one-click hands-free orchestration. The studio steps through: Clarify -> Generate -> Git Commit -> abapGit Sync -> In-Memory Syntax Check -> ABAP Unit Test Execution. If errors arise, the self-healing loop resolves them automatically.'
                      },
                      {
                        step: 'Step 4',
                        title: 'Inspect Multi-File Code Artifacts & Side-by-Side Diffs',
                        action: 'Switch between the top tabs: .clas.abap for the global class implementation, locals_imp.abap for the test suite, .clas.xml for abapGit metadata, and the Diff tab to view interactive side-by-side Monaco diffs highlighting exactly what changed.'
                      },
                      {
                        step: 'Step 5',
                        title: 'Perform Conversational Refinements',
                        action: 'Use the bottom chat input to instruct the AI with targeted adjustments (e.g., "Add currency conversion logic using cl_exchange_rates", "Enforce authority check on sales org VKORG", or "Add test scenario for negative quantities"). The assistant updates all files in sync.'
                      },
                      {
                        step: 'Step 6',
                        title: 'Git Commit, Remote Push & abapGit Synchronization',
                        action: 'Click "Push Git" to create an atomic git commit and push to your configured GitHub/GitLab remote branch. Set repository credentials and target branches in the Connections tab.'
                      },
                      {
                        step: 'Step 7',
                        title: 'Perform Controlled Activation in SAP (Human Gate)',
                        action: 'Review compiler diagnostics and unit test coverage in the Inspector view. Click "Activate in SAP" and confirm the activation dialog. The system invokes /sap/bc/adt/activation to transition the object from Inactive to Active state in the SAP DDIC.'
                      },
                    ].map((item, idx) => (
                      <div key={idx} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                        <div className="flex-none">
                          <span className="inline-flex h-7 w-16 items-center justify-center rounded-lg bg-slate-100 font-mono font-bold text-xs text-slate-800 border border-slate-200">
                            {item.step}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-sm text-slate-900">{item.title}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{item.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* SECTION 5: ON-PREMISE SAP DEV PREREQUISITES & CONNECTIVITY */}
              {(guideSection === 'all' || guideSection === 'connectivity') && (
                <section id="guide-connectivity" className="space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-amber-700 border border-amber-200">
                      <Server className="h-3 w-3" /> Section 5: SAP Connectivity & Prerequisites
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-2">On-Premise SAP DEV Prerequisites & Connectivity Guide</h2>
                    <p className="text-xs text-slate-500">
                      Standard SAP GUI administrator setup for SICF service trees and SU01 developer authorization profiles.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* SICF Service Activation */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-blue-600" />
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">1. Transaction SICF: ADT Service Tree</h3>
                      </div>
                      <p className="text-xs text-slate-600">
                        Open SAP GUI and execute Transaction <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-blue-800">SICF</code>. Navigate down the path:
                      </p>
                      <div className="rounded bg-slate-900 p-2.5 font-mono text-[11px] text-slate-200">
                        /default_host/sap/bc/adt
                      </div>
                      <p className="text-xs text-slate-600">
                        Right-click and select <strong>Activate Service</strong> for the ADT node and verify that the following sub-nodes are active:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-700">
                        <li><code>/sap/bc/adt/discovery</code> - Core service discovery</li>
                        <li><code>/sap/bc/adt/syntaxcheck</code> - In-memory compiler</li>
                        <li><code>/sap/bc/adt/abapunit/testruns</code> - Unit test execution</li>
                        <li><code>/sap/bc/adt/activation</code> - DDIC activation</li>
                        <li><code>/sap/bc/adt/oo/classes</code> - Class source read/write</li>
                        <li><code>/sap/bc/adt/atc/runs</code> - Static code analysis</li>
                      </ul>
                    </div>

                    {/* SU01 Authorizations */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-amber-600" />
                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">2. Transaction SU01: Developer Roles</h3>
                      </div>
                      <p className="text-xs text-slate-600">
                        The technical user configured in the studio requires standard ABAP developer authorizations:
                      </p>
                      <div className="space-y-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                          <span className="font-mono font-bold text-blue-800 block">S_DEVELOP</span>
                          <p className="text-slate-600 text-[11px] mt-0.5">
                            ACTVT: 01 (Create), 02 (Change), 03 (Display) | OBJTYPE: CLAS, INTF, PROG | DEVCLASS: * (or target package)
                          </p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                          <span className="font-mono font-bold text-blue-800 block">S_RFC</span>
                          <p className="text-slate-600 text-[11px] mt-0.5">
                            RFC_TYPE: FUGR | RFC_NAME: SADT_*, RFC1, SDIX
                          </p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                          <span className="font-mono font-bold text-blue-800 block">S_CTS_ADMI & S_TRANSPRT</span>
                          <p className="text-slate-600 text-[11px] mt-0.5">
                            Authorizations for Workbench Transport Request creation, assignment, and release.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Offline Simulation Mode Callout */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs">
                      <Radio className="h-4 w-4 text-emerald-600" />
                      Offline Simulation Mode for Disconnected / Air-Gapped Environments
                    </div>
                    <p className="text-xs text-emerald-900 leading-relaxed">
                      If you do not have immediate connectivity to an on-premise SAP DEV instance, toggle <strong>Offline Simulation Mode</strong> in the Connections tab. The platform includes an in-memory simulation engine that models ADT compiler checks, unit test results, and activation responses with realistic latencies, allowing you to build, test, and refine code completely offline.
                    </p>
                  </div>
                </section>
              )}

              {/* SECTION 6: ABAPGIT SERIALIZATION & CTS TRANSPORT MANAGEMENT */}
              {(guideSection === 'all' || guideSection === 'abapgit-cts') && (
                <section id="guide-abapgit-cts" className="space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-purple-700 border border-purple-200">
                      <GitCommit className="h-3 w-3" /> Section 6: Version Control
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-2">abapGit Serialization Standards & CTS Transport Management</h2>
                    <p className="text-xs text-slate-500">
                      Directory structure conventions, multi-file class serialization, and SAP CTS Workbench Transport integration.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* abapGit File Structure */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">Standard abapGit Repository Structure</h3>
                      <div className="rounded bg-slate-900 p-3 font-mono text-[11px] text-slate-300 space-y-1">
                        <div className="text-blue-400">/src/</div>
                        <div className="pl-4 text-emerald-400">ZCL_ORDER_DISCOUNT.clas.abap        # Global class & methods</div>
                        <div className="pl-4 text-amber-400">ZCL_ORDER_DISCOUNT.clas.locals_imp.abap # Unit test suite (FOR TESTING)</div>
                        <div className="pl-4 text-purple-400">ZCL_ORDER_DISCOUNT.clas.xml         # abapGit metadata envelope</div>
                        <div className="pl-4 text-slate-400">package.devc.xml                    # SAP package descriptor</div>
                        <div className="text-blue-400">.abapgit.xml                          # abapGit repository settings</div>
                      </div>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                        <li><strong>.clas.abap:</strong> Contains the global class pool definition, visibility sections (PUBLIC/PROTECTED/PRIVATE), and global method implementations.</li>
                        <li><strong>.locals_imp.abap:</strong> Contains local helper classes and ABAP Unit test definitions decorated with <code>FOR TESTING</code> and <code>RISK LEVEL HARMLESS</code>.</li>
                        <li><strong>.clas.xml:</strong> Contains object metadata including UUID, author, language, and transport status.</li>
                      </ul>
                    </div>

                    {/* CTS Transport Requests */}
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">SAP CTS Workbench Transport Workflow</h3>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        In non-$TMP packages, changes must be recorded under a Change and Transport System (CTS) Workbench Request before they can be promoted to QA or Production.
                      </p>
                      <div className="space-y-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                          <span className="font-semibold text-slate-900 block">1. Transport Creation (SE09 / SE10)</span>
                          <p className="text-slate-600 text-[11px] mt-0.5">
                            Create a Workbench Request directly in SAP GUI or via the studio Connections tab using the "Create New Transport" form.
                          </p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                          <span className="font-semibold text-slate-900 block">2. Object Locking & Assignment</span>
                          <p className="text-slate-600 text-[11px] mt-0.5">
                            All generated artifacts (class pool, test classes, XML metadata) are locked under the designated transport task.
                          </p>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                          <span className="font-semibold text-slate-900 block">3. Releasing Transport Tasks</span>
                          <p className="text-slate-600 text-[11px] mt-0.5">
                            Once testing is verified, release tasks and the main transport request to make the change available for import into QA.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* SECTION 7: CLEAN ABAP STANDARDS & SAFETY GOVERNANCE MATRIX */}
              {(guideSection === 'all' || guideSection === 'clean-abap') && (
                <section id="guide-clean-abap" className="space-y-4">
                  <div className="border-b border-slate-200 pb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-rose-700 border border-rose-200">
                      <ShieldCheck className="h-3 w-3" /> Section 7: Code Quality & Safety
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 mt-2">Clean ABAP 7.50+ Standards & Safety Governance Matrix</h2>
                    <p className="text-xs text-slate-500">
                      Modern syntax patterns, SQL injection defense, authorization checks, and human activation governance.
                    </p>
                  </div>

                  {/* Clean ABAP Patterns Grid */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Enforced Clean ABAP 7.50+ Syntax Constructs</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                        <span className="font-semibold text-slate-900 block">Inline Data Declarations</span>
                        <code className="font-mono text-[11px] text-blue-700 block bg-white p-1.5 rounded border border-slate-200">
                          DATA(discount) = calculate_discount( total ).
                        </code>
                        <p className="text-[11px] text-slate-500">Avoid top-level DATA: blocks; declare variables where initialized.</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                        <span className="font-semibold text-slate-900 block">Constructor Expressions</span>
                        <code className="font-mono text-[11px] text-blue-700 block bg-white p-1.5 rounded border border-slate-200">
                          items = VALUE #( ( id = 1 price = '50.00' ) ).
                        </code>
                        <p className="text-[11px] text-slate-500">Use VALUE #(), COND #(), and SWITCH #() instead of procedural loops.</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                        <span className="font-semibold text-slate-900 block">Table Expressions</span>
                        <code className="font-mono text-[11px] text-blue-700 block bg-white p-1.5 rounded border border-slate-200">
                          DATA(order) = orders[ vbeln = order_id ].
                        </code>
                        <p className="text-[11px] text-slate-500">Use bracket table expressions instead of READ TABLE ... WITH KEY.</p>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                        <span className="font-semibold text-slate-900 block">String Templates</span>
                        <code className="font-mono text-[11px] text-blue-700 block bg-white p-1.5 rounded border border-slate-200">
                          msg = |Order &#123; order_id &#125; completed.|.
                        </code>
                        <p className="text-[11px] text-slate-500">Use embedded pipe string templates instead of CONCATENATE.</p>
                      </div>
                    </div>
                  </div>

                  {/* Security & Safeguards */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Security & Quality Safeguards</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-lg border border-rose-200 bg-rose-50/50">
                        <span className="font-bold text-rose-900 block mb-1">SQL Injection Prevention</span>
                        <p className="text-rose-800 text-[11px] leading-relaxed">
                          Never concatenate raw strings into dynamic Open SQL statements. Use parameterized queries or sanitize with CL_ABAP_DYN_PRG.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                        <span className="font-bold text-amber-900 block mb-1">Mandatory Authority Checks</span>
                        <p className="text-amber-800 text-[11px] leading-relaxed">
                          Any public method exposing business records must execute explicit AUTHORITY-CHECK statements against relevant authorization objects.
                        </p>
                      </div>
                      <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                        <span className="font-bold text-blue-900 block mb-1">Performance Safeguards</span>
                        <p className="text-blue-800 text-[11px] leading-relaxed">
                          Zero SELECT queries inside loops. Prefer CDS views, inner joins, or FOR ALL ENTRIES for bulk retrieval.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Safety Governance Matrix Table */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Safety Governance Matrix</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] text-slate-600 font-semibold">
                            <th className="py-2 px-3">Action Category</th>
                            <th className="py-2 px-3 text-emerald-700">Autonomous Execution Allowed</th>
                            <th className="py-2 px-3 text-rose-700">Strictly Prohibited</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Code Synthesis</td>
                            <td className="py-2 px-3 text-emerald-800">Clean ABAP 7.50+ classes, unit test suites, and XML metadata</td>
                            <td className="py-2 px-3 text-rose-800">Directly modifying standard SAP core objects (SAP namespace)</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Compiler Validation</td>
                            <td className="py-2 px-3 text-emerald-800">In-memory syntax checks (/sap/bc/adt/syntaxcheck)</td>
                            <td className="py-2 px-3 text-rose-800">Persisting non-compiling code to permanent database</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Unit Testing</td>
                            <td className="py-2 px-3 text-emerald-800">Automated execution of test cases via /abapunit</td>
                            <td className="py-2 px-3 text-rose-800">Testing destructive transactions or altering database records in tests</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Activation Gate</td>
                            <td className="py-2 px-3 text-slate-600">None without explicit user confirmation</td>
                            <td className="py-2 px-3 text-rose-800 font-bold">Autonomous DDIC activation without human review</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-3 font-medium text-slate-900">Environment Scope</td>
                            <td className="py-2 px-3 text-emerald-800">Development (DEV) system instances only</td>
                            <td className="py-2 px-3 text-rose-800 font-bold">Direct deployment or connection to QA or Production</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Human Activation Gate Notice */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                      <ShieldCheck className="h-4 w-4 text-blue-600" />
                      The Human Activation Gate Principle
                    </div>
                    <p className="text-xs text-blue-900 leading-relaxed">
                      DDIC activation in an SAP system permanently transitions an object into active runtime state, affecting all transactions referencing that class. To preserve governance and audit compliance, the studio enforces an unskippable human review gate: <strong>the system will never trigger activation without explicit developer confirmation.</strong>
                    </p>
                  </div>
                </section>
              )}

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
