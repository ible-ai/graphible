// components/SetupWizard/StepComponents.jsx - Fixed version without scrolling issues
// Compact, beautiful components for each setup step

import { useState } from 'react';
import {
    Brain,
    Server,
    Globe,
    Download,
    Terminal,
    Copy,
    Check,
    AlertCircle,
    Loader,
    ExternalLink,
    Play,
    Shield,
    Zap,
    Clock,
    Settings
} from 'lucide-react';

import {
    SETUP_MESSAGES,
    OLLAMA_INSTRUCTIONS,
    GOOGLE_AI_MODELS,
    PRIVACY_NOTICE,
    CONNECTION_STATUS
} from '../../constants/setupWizardConstants';
import { copyToClipboard } from '../../utils/setupWizardUtils';

// Shared Componentss
const StepContainer = ({ children, className = "" }) => (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
        {children}
    </div>
);

const StepHeader = ({ title, subtitle, description, icon: Icon, compact = false }) => (
    <div className="text-center mb-6">
        {Icon && (
            <div className="w-14 h-14 mx-auto mb-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center">
                <Icon className="text-indigo-600" size={28} />
            </div>
        )}
        <h1 className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold text-slate-800 mb-2`}>{title}</h1>
        <p className={`${compact ? 'text-lg' : 'text-xl'} text-indigo-600 mb-3`}>{subtitle}</p>
        <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
);

const CompactCard = ({ children, className = "", onClick, delay = 0 }) => (
    <div
        className={`bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} ${className}`}
        style={{ animationDelay: `${delay}ms` }}
        onClick={onClick}
    >
        {children}
    </div>
);

const StatusBadge = ({ status, children }) => {
    const styles = {
        [CONNECTION_STATUS.SUCCESS]: "bg-emerald-100 text-emerald-700 border-emerald-200",
        [CONNECTION_STATUS.ERROR]: "bg-rose-100 text-rose-700 border-rose-200",
        [CONNECTION_STATUS.DETECTING]: "bg-blue-100 text-blue-700 border-blue-200",
        [CONNECTION_STATUS.IDLE]: "bg-slate-100 text-slate-700 border-slate-200"
    };

    return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${styles[status] || styles[CONNECTION_STATUS.IDLE]}`}>
            {children}
        </span>
    );
};

// Welcome Step
export const WelcomeStep = ({ onNext }) => (
    <StepContainer>
        <StepHeader
            title={SETUP_MESSAGES.WELCOME.title}
            subtitle={SETUP_MESSAGES.WELCOME.subtitle}
            description={SETUP_MESSAGES.WELCOME.description}
            icon={Brain}
            compact
        />

        <div className="grid grid-cols-3 gap-4 mb-6">
            <CompactCard className="p-4 text-center" delay={100}>
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                    <Zap className="text-white" size={20} />
                </div>
                <h3 className="font-semibold text-slate-800 mb-1 text-sm">Interactive Learning</h3>
                <p className="text-xs text-slate-600">Explore ideas through visual nodes</p>
            </CompactCard>

            <CompactCard className="p-4 text-center" delay={200}>
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                    <Brain className="text-white" size={20} />
                </div>
                <h3 className="font-semibold text-slate-800 mb-1 text-sm">Smart Context</h3>
                <p className="text-xs text-slate-600">Select exactly what to include</p>
            </CompactCard>

            <CompactCard className="p-4 text-center" delay={300}>
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-pink-500 rounded-xl mx-auto mb-3 flex items-center justify-center">
                    <Globe className="text-white" size={20} />
                </div>
                <h3 className="font-semibold text-slate-800 mb-1 text-sm">Branching Paths</h3>
                <p className="text-xs text-slate-600">Explore multiple directions</p>
            </CompactCard>
        </div>

        <div className="text-center">
            <button
                onClick={onNext}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
                Get Started
            </button>
        </div>
    </StepContainer>
);

// Detection Step
export const DetectionStep = ({ detectionResults, isDetecting }) => (
    <StepContainer>
        <StepHeader
            title={SETUP_MESSAGES.DETECTION.title}
            subtitle={SETUP_MESSAGES.DETECTION.subtitle}
            description={SETUP_MESSAGES.DETECTION.description}
            icon={isDetecting ? Loader : Brain}
            compact
        />

        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Local Models Detection */}
            <CompactCard className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Server className="text-slate-600" size={20} />
                        <div>
                            <h3 className="font-semibold text-slate-800 text-sm">Local Models</h3>
                            <p className="text-xs text-slate-500">Private, unlimited</p>
                        </div>
                    </div>
                    <StatusBadge status={detectionResults?.local?.status || CONNECTION_STATUS.IDLE}>
                        {isDetecting ? <Loader className="animate-spin mr-1" size={12} /> : null}
                        {detectionResults?.local?.status === CONNECTION_STATUS.SUCCESS ? 'Found' :
                            detectionResults?.local?.status === CONNECTION_STATUS.ERROR ? 'None' :
                                isDetecting ? 'Checking...' : 'Pending'}
                    </StatusBadge>
                </div>

                {detectionResults?.local?.status === CONNECTION_STATUS.SUCCESS && (
                    <div className="bg-emerald-50 rounded-lg p-2">
                        <p className="text-emerald-800 text-xs font-medium">
                            {detectionResults.local.models.length} model(s) available
                        </p>
                    </div>
                )}

                {detectionResults?.local?.status === CONNECTION_STATUS.ERROR && (
                    <div className="bg-slate-50 rounded-lg p-2">
                        <p className="text-slate-600 text-xs">{detectionResults.local.error}</p>
                    </div>
                )}
            </CompactCard>

            {/* External APIs Detection */}
            <CompactCard className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Globe className="text-slate-600" size={20} />
                        <div>
                            <h3 className="font-semibold text-slate-800 text-sm">Cloud Models</h3>
                            <p className="text-xs text-slate-500">Powerful, instant</p>
                        </div>
                    </div>
                    <StatusBadge status={CONNECTION_STATUS.SUCCESS}>Available</StatusBadge>
                </div>

                <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-blue-800 text-xs">Google AI ready</p>
                </div>
            </CompactCard>
        </div>

        {isDetecting && (
            <div className="text-center py-6">
                <Loader className="animate-spin mx-auto mb-3 text-indigo-600" size={24} />
                <p className="text-slate-600 text-sm">Scanning for models...</p>
            </div>
        )}
    </StepContainer>
);

// Model Choice Step
export const ModelChoiceStep = ({ detectionResults, onChooseLocal, onChooseExternal, onChooseDemo }) => {
    const hasLocalModels = detectionResults?.local?.status === CONNECTION_STATUS.SUCCESS &&
        detectionResults.local.models.length > 0;

    return (
        <StepContainer>
            <StepHeader
                title="Choose Your LLM"
                description="Each option has different benefits. You can change this later."
                compact
            />

            <div className="grid gap-3 max-w-3xl mx-auto">
                {/* Demo Mode - Highlighted */}
                <CompactCard className="p-4 border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50" delay={100}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                                <Play className="text-white" size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Try the Demo</h3>
                                <p className="text-amber-700 font-medium text-xs">Recommended first step</p>
                            </div>
                        </div>
                        <div className="bg-amber-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                            INSTANT
                        </div>
                    </div>

                    <p className="text-slate-700 mb-3 text-sm">
                        Experience Graphible with pre-loaded content. Perfect for understanding the interface.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                        <div className="space-y-1">
                            <div className="flex items-center gap-1 text-emerald-700">
                                <Check size={12} />
                                <span>Works instantly</span>
                            </div>
                            <div className="flex items-center gap-1 text-emerald-700">
                                <Check size={12} />
                                <span>No setup required</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-1 text-emerald-700">
                                <Check size={12} />
                                <span>Interactive tutorial</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-500">
                                <AlertCircle size={12} />
                                <span>Limited content</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onChooseDemo}
                        className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all duration-200 font-semibold text-sm"
                    >
                        Try Demo First
                    </button>
                </CompactCard>

                <div className="grid grid-cols-2 gap-3">
                    {/* Local Models */}
                    <CompactCard className={`p-4 ${hasLocalModels ? 'border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50' : ''}`} delay={200}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center">
                                    <Server className="text-white" size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Local Models</h3>
                                    <p className="text-slate-600 text-xs">Private & unlimited</p>
                                </div>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-bold ${hasLocalModels ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                                }`}>
                                {hasLocalModels ? 'READY' : 'SETUP'}
                            </div>
                        </div>

                        <p className="text-slate-700 mb-3 text-xs">
                            Run AI on your computer. Complete privacy, no costs.
                        </p>

                        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1 text-emerald-700">
                                    <Check size={10} />
                                    <span>100% private</span>
                                </div>
                                <div className="flex items-center gap-1 text-emerald-700">
                                    <Check size={10} />
                                    <span>No API costs</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1 text-slate-500">
                                    <Clock size={10} />
                                    <span>Setup needed</span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-500">
                                    <Download size={10} />
                                    <span>Large downloads</span>
                                </div>
                            </div>
                        </div>

                        {hasLocalModels && (
                            <div className="bg-emerald-100 rounded-lg p-2 mb-3">
                                <p className="text-emerald-800 text-xs font-medium">
                                    ✨ {detectionResults.local.models.length} model(s) ready!
                                </p>
                            </div>
                        )}

                        <button
                            onClick={onChooseLocal}
                            className={`w-full px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-sm ${hasLocalModels
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600'
                                : 'bg-slate-600 text-white hover:bg-slate-700'
                                }`}
                        >
                            {hasLocalModels ? 'Use Local' : 'Set Up Local'}
                        </button>
                    </CompactCard>

                    {/* External Models */}
                    <CompactCard className="p-4" delay={300}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                                    <Globe className="text-white" size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">Cloud Models</h3>
                                    <p className="text-slate-600 text-xs">Powerful & instant</p>
                                </div>
                            </div>
                            <div className="bg-indigo-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                                INSTANT
                            </div>
                        </div>

                        <p className="text-slate-700 mb-3 text-xs">
                            Connect to Google's AI. No downloads, maximum capability.
                        </p>

                        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1 text-emerald-700">
                                    <Check size={10} />
                                    <span>Instant setup</span>
                                </div>
                                <div className="flex items-center gap-1 text-emerald-700">
                                    <Check size={10} />
                                    <span>Most capable</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1 text-slate-500">
                                    <Globe size={10} />
                                    <span>Requires internet</span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-500">
                                    <AlertCircle size={10} />
                                    <span>API costs</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={onChooseExternal}
                            className="w-full px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 font-semibold text-sm"
                        >
                            Use Cloud Models
                        </button>
                    </CompactCard>
                </div>
            </div>
        </StepContainer>
    );
};

// Local Setup Step
export const LocalSetupStep = ({ detectionResults, onConfigurationChange, onTest }) => {
    const [copiedCommand, setCopiedCommand] = useState(null);
    const [config, setConfig] = useState({
        address: 'http://localhost:11434',
        model: 'gemma3:4b'
    });

    const handleCopy = async (command, id) => {
        const result = await copyToClipboard(command);
        if (result.success) {
            setCopiedCommand(id);
            setTimeout(() => setCopiedCommand(null), 2000);
        }
    };

    const handleConfigChange = (updates) => {
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        onConfigurationChange(newConfig);
    };

    const hasModels = detectionResults?.local?.models?.length > 0;

    return (
        <StepContainer>
            <StepHeader
                title={SETUP_MESSAGES.LOCAL_SETUP.title}
                subtitle={SETUP_MESSAGES.LOCAL_SETUP.subtitle}
                description="Follow the steps below to get Ollama running"
                icon={Server}
                compact
            />

            <div className="max-w-3xl mx-auto">
                {!hasModels && (
                    <div className="grid gap-3 mb-6">
                        {OLLAMA_INSTRUCTIONS.slice(0, 2).map((instruction, index) => (
                            <CompactCard key={instruction.id} className="p-4" delay={index * 100}>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <span className="text-white font-bold text-sm">{index + 1}</span>
                                    </div>

                                    <div className="flex-1">
                                        <h4 className="font-semibold text-slate-800 text-sm mb-1">{instruction.title}</h4>
                                        <p className="text-slate-600 text-xs mb-2">{instruction.description}</p>

                                        {instruction.url && (
                                            <a
                                                href={instruction.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium hover:bg-indigo-200"
                                            >
                                                <ExternalLink size={12} />
                                                {instruction.action}
                                            </a>
                                        )}

                                        {instruction.command && (
                                            <div className="bg-slate-900 rounded p-2 font-mono text-xs mt-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-slate-400 text-xs">Terminal</span>
                                                    <button
                                                        onClick={() => handleCopy(instruction.command, instruction.id)}
                                                        className="flex items-center gap-1 px-1 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs"
                                                    >
                                                        {copiedCommand === instruction.id ? <Check size={10} /> : <Copy size={10} />}
                                                        {copiedCommand === instruction.id ? 'Copied!' : 'Copy'}
                                                    </button>
                                                </div>
                                                <code className="text-green-400 text-xs">{instruction.command}</code>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CompactCard>
                        ))}
                    </div>
                )}

                {/* Configuration */}
                <CompactCard className="p-4 mb-4">
                    <h3 className="font-semibold text-slate-800 mb-3 text-sm">Configuration</h3>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                Server Address
                            </label>
                            <input
                                type="text"
                                value={config.address}
                                onChange={(e) => handleConfigChange({ address: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                placeholder="http://localhost:11434"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                                Model Name
                            </label>
                            {hasModels ? (
                                <select
                                    value={config.model}
                                    onChange={(e) => handleConfigChange({ model: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {detectionResults.local.models.map((model, i) => (
                                        <option key={i} value={model.name}>{model.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={config.model}
                                    onChange={(e) => handleConfigChange({ model: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="gemma3:4b"
                                />
                            )}
                        </div>
                    </div>
                </CompactCard>

                <div className="text-center">
                    <button
                        onClick={() => onTest({ type: 'local', ...config })}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-semibold"
                    >
                        Test Connection
                    </button>
                </div>
            </div>
        </StepContainer>
    );
};

// API Setup Step
export const ApiSetupStep = ({ onConfigurationChange, onTest }) => {
    const [config, setConfig] = useState({
        provider: 'google',
        model: 'gemini-2.5-flash-lite',
        apiKey: ''
    });

    const handleConfigChange = (updates) => {
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        onConfigurationChange(newConfig);
    };

    return (
        <StepContainer>
            <StepHeader
                title={SETUP_MESSAGES.API_SETUP.title}
                subtitle={SETUP_MESSAGES.API_SETUP.subtitle}
                compact
            />

            <div className="max-w-2xl mx-auto">
                {/* Privacy Notice */}
                <CompactCard className="p-4 bg-blue-50 border-blue-200 mb-4">
                    <div className="flex items-start gap-2">
                        <Shield className="text-blue-600 flex-shrink-0 mt-1" size={16} />
                        <div>
                            <h3 className="font-semibold text-blue-800 mb-2 text-sm">{PRIVACY_NOTICE.title}</h3>
                            <div className="text-blue-700 text-xs space-y-1">
                                {PRIVACY_NOTICE.points.slice(0, 2).map((point, i) => (
                                    <div key={i} className="flex items-start gap-1">
                                        <Check size={10} className="flex-shrink-0 mt-0.5" />
                                        <span>{point}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CompactCard>

                {/* Model Selection */}
                <div className="mb-6">
                    <div className="grid gap-4">
                        {GOOGLE_AI_MODELS.map((model, index) => (
                            <CompactCard
                                key={model.id}
                                className={`p-2 cursor-pointer transition-all ${config.model === model.id
                                    ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200'
                                    : 'hover:border-slate-300'
                                    }`}
                                delay={index * 100}
                                onClick={() => handleConfigChange({ model: model.id })}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h5 className="font-semibold text-slate-800">{model.name}</h5>
                                            {model.recommendation && (
                                                <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-small">
                                                    {model.recommendation}
                                                </span>
                                            )}
                                            <p className="text-slate-600 text-xs mb-3">{model.description}</p>
                                        </div>

                                    </div>

                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${config.model === model.id
                                        ? 'border-indigo-500 bg-indigo-500'
                                        : 'border-slate-300'
                                        }`}>
                                        {config.model === model.id && (
                                            <Check className="text-white" size={12} />
                                        )}
                                    </div>
                                </div>
                            </CompactCard>
                        ))}
                    </div>
                </div>

                {/* API Key Input */}
                <CompactCard className="p-6 mb-6">
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Google AI API Key
                        </label>
                        <input
                            type="password"
                            value={config.apiKey}
                            onChange={(e) => handleConfigChange({ apiKey: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                            placeholder="Enter your API key..."
                        />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-500"
                        >
                            <ExternalLink size={14} />
                            Get your free API key
                        </a>

                        <button
                            onClick={() => setShowPrivacy(!showPrivacy)}
                            className="text-slate-500 hover:text-slate-700"
                        >
                            Privacy details
                        </button>
                    </div>
                </CompactCard>

                <div className="text-center">
                    <button
                        onClick={() => onTest({ type: 'external', ...config })}
                        disabled={!config.apiKey.trim()}
                        className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Test Connection
                    </button>
                </div>
            </div>
        </StepContainer>
    );
};
