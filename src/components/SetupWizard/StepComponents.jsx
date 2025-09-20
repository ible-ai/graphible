// Enhanced setup step components with consent management

import {
    Compass,
    Server,
    Globe,
    CheckCircle,
    Loader,
    Play,
    Shield,
    Download,
    AlertTriangle,
    Lock,
    HardDrive,
} from 'lucide-react';

import {
    GOOGLE_AI_MODELS,
    PRIVACY_NOTICE,
    CONNECTION_STATUS
} from '../../constants/setupWizardConstants';

export const WelcomeStep = ({ onNext }) => (
    <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-2xl flex items-center justify-center">
            <Compass className="text-blue-600" size={32} />
        </div>

        <h1 className="text-2xl font-semibold text-slate-800 mb-3">
            Turn conversations into knowledge graphs
        </h1>

        <p className="text-slate-600 mb-8 leading-relaxed">
            graph.ible helps you explore ideas by creating visual, interactive knowledge maps from AI conversations. Let's get you set up in under a minute.
        </p>

        <button
            onClick={onNext}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-lg hover:shadow-xl"
        >
            Get Started
        </button>
    </div>
);

export const ChoiceStep = ({ detectionResults, onSelect, selectedOption }) => {
    const hasLocal = detectionResults?.local?.status === CONNECTION_STATUS.SUCCESS;

    return (
        <div className="w-full max-w-lg">
            <div className="text-center mb-8">
                <h3 className="text-lg font-medium text-slate-800 mb-2">Choose your AI source</h3>
                <p className="text-slate-600 text-sm">Pick the option that works best for you</p>
            </div>

            <div className="space-y-3">
                {/* Demo option - prominently featured */}
                <button
                    onClick={() => onSelect('demo')}
                    className="w-full p-6 border-2 border-amber-200 bg-amber-50 rounded-xl text-left hover:border-amber-300 hover:bg-amber-100 transition-all group"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <Play className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-slate-800">Try the demo</h4>
                                <span className="px-2 py-1 bg-amber-500 text-white rounded-full text-xs font-medium">
                                    No setup
                                </span>
                            </div>
                            <p className="text-slate-600 text-sm mb-3">
                                Explore with pre-loaded content first. No downloads or setup required.
                            </p>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span>✓ Instant start</span>
                                <span>✓ No downloads</span>
                                <span>✓ See how it works</span>
                            </div>
                        </div>
                    </div>
                </button>

                {/* Browser option */}
                <button
                    onClick={() => onSelect('browser')}
                    className="w-full p-4 border border-slate-200 rounded-xl text-left hover:border-slate-300 hover:bg-slate-50 transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Compass className="text-blue-600" size={20} />
                        </div>
                        <div>
                            <h4 className="font-medium text-slate-800">AI in your browser</h4>
                            <p className="text-slate-600 text-sm">Private AI that runs in your browser (2GB download)</p>
                        </div>
                    </div>
                </button>

                {/* Advanced options - collapsed by default */}
                <details className="w-full">
                    <summary className="cursor-pointer p-4 border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all">
                        <span className="font-medium text-slate-700">Advanced options</span>
                        <span className="text-slate-500 text-sm ml-2">For power users</span>
                    </summary>

                    <div className="mt-2 space-y-2">
                        {/* Cloud option */}
                        <button
                            onClick={() => onSelect('cloud')}
                            className="w-full p-4 border border-slate-200 rounded-xl text-left hover:border-slate-300 hover:bg-slate-50 transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <Globe className="text-purple-600" size={20} />
                                </div>
                                <div>
                                    <h4 className="font-medium text-slate-800">Cloud AI</h4>
                                    <p className="text-slate-600 text-sm">Use Google's AI models (requires API key)</p>
                                </div>
                            </div>
                        </button>

                        {/* Local option */}
                        <button
                            onClick={() => onSelect('local')}
                            className="w-full p-4 border border-slate-200 rounded-xl text-left hover:border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!hasLocal}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                    <Server className="text-slate-600" size={20} />
                                </div>
                                <div>
                                    <h4 className="font-medium text-slate-800">Local server</h4>
                                    <p className="text-slate-600 text-sm">
                                        {hasLocal ? 'Use your Ollama installation' : 'Requires Ollama setup'}
                                    </p>
                                </div>
                            </div>
                        </button>
                    </div>
                </details>
            </div>
        </div>
    );
};

// NEW: Consent Step Component
export const ConsentStep = ({ option, consentData, onConsentDecision }) => {
    const getOptionDetails = () => {
        switch (option) {
            case 'browser':
                return {
                    title: 'In-Browser AI Setup',
                    icon: <Compass className="text-blue-600" size={32} />,
                    iconBg: 'bg-blue-100'
                };
            case 'cloud':
                return {
                    title: 'Cloud AI Setup',
                    icon: <Globe className="text-purple-600" size={32} />,
                    iconBg: 'bg-purple-100'
                };
            case 'local':
                return {
                    title: 'Local AI Setup',
                    icon: <Server className="text-slate-600" size={32} />,
                    iconBg: 'bg-slate-100'
                };
            default:
                return {
                    title: 'AI Setup',
                    icon: <Compass className="text-blue-600" size={16} />,
                    iconBg: 'bg-blue-100'
                };
        }
    };

    const details = getOptionDetails();

    return (
        <div className="max-w-2xl">
            <div className="text-center mb-6">
                <div className={`w-16 h-16 mx-auto mb-4 ${details.iconBg} rounded-2xl flex items-center justify-center`}>
                    {details.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">{details.title}</h3>
            </div>

            <div className="space-y-6">
                {/* Download Information */}
                {consentData.downloadSize && consentData.downloadSize !== 'None' && (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <div className="flex items-start gap-3">
                            <Download className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                            <div>
                                <h4 className="font-semibold text-blue-800 mb-2">One-time Download Required</h4>
                                <div className="text-blue-700 text-sm space-y-1">
                                    <div><strong>Size:</strong> {consentData.downloadSize}</div>
                                    <div><strong>Storage:</strong> {consentData.storageLocation}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Privacy Information */}
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-start gap-3">
                        <Shield className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                        <div>
                            <h4 className="font-semibold text-green-800 mb-2">Privacy & Security</h4>
                            <div className="text-green-700 text-sm space-y-1">
                                {consentData.privacyInfo?.dataStaysLocal && (
                                    <div className="flex items-center gap-2">
                                        <Lock size={12} />
                                        <span>Your data stays on your device</span>
                                    </div>
                                )}
                                {consentData.privacyInfo?.offlineCapable && (
                                    <div className="flex items-center gap-2">
                                        <HardDrive size={12} />
                                        <span>Works completely offline after initial download</span>
                                    </div>
                                )}
                                {!consentData.privacyInfo?.dataStaysLocal && (
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle size={12} />
                                        <span>Data will be sent to external servers</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Consent Actions */}
                <div className="bg-white border-2 border-slate-200 rounded-xl p-6">
                    <div className="flex gap-3">
                        <button
                            onClick={() => onConsentDecision(true)}
                            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={18} />
                            Proceed
                        </button>
                        <button
                            onClick={() => onConsentDecision(false)}
                            className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
                        >
                            Go Back
                        </button>
                    </div>

                    <div className="text-xs text-slate-500 text-center mt-3">
                        You'll download your own copy of open source model weights. This is not an executable.
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SetupStep = ({ option, apiKey, onApiKeyChange, onSetup, detectionResults, consentData }) => {
    if (option === 'browser') {
        return (
            <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <Compass className="text-blue-600" size={32} />
                </div>

                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                    Ready to Download In-Browser AI
                </h3>

                <p className="text-slate-600 mb-6">
                    Thank you for your consent. The AI model will now download automatically when you continue.
                </p>

                <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
                    <div className="text-sm text-blue-800 space-y-1">
                        <div>• Model: Llama 3.2 3B (optimized for web)</div>
                        <div>• Size: ~2GB download</div>
                        <div>• Storage: Saved in your browser</div>
                        <div>• Privacy: Never leaves your device</div>
                    </div>
                </div>

                {consentData.hasConsented && (
                    <div className="bg-green-50 rounded-xl p-3 mb-6 flex items-center gap-2">
                        <CheckCircle className="text-green-600" size={16} />
                        <span className="text-green-700 text-sm">Downloaded at {new Date(consentData.consentTimestamp).toLocaleTimeString()}</span>
                    </div>
                )}

                <button
                    onClick={onSetup}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                >
                    Start Download & Setup
                </button>
            </div>
        );
    }

    if (option === 'cloud') {
        return (
            <div className="max-w-md">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-2xl flex items-center justify-center">
                        <Globe className="text-purple-600" size={32} />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800 mb-2">Connect to Google AI</h3>
                    <p className="text-slate-600 text-sm">Enter your API key to get started</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Google AI API Key
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => onApiKeyChange(e.target.value)}
                            placeholder="Enter your API key..."
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        />
                    </div>

                    <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                        <div className="font-medium mb-1">Need an API key?</div>
                        <div>Get one free at <span className="text-purple-600">aistudio.google.com</span></div>
                    </div>

                    {consentData.hasConsented && (
                        <div className="bg-green-50 rounded-xl p-3 flex items-center gap-2">
                            <CheckCircle className="text-green-600" size={16} />
                            <span className="text-green-700 text-sm">Consent granted</span>
                        </div>
                    )}

                    <button
                        onClick={onSetup}
                        disabled={!apiKey.trim()}
                        className="w-full px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        Connect to Google AI
                    </button>
                </div>
            </div>
        );
    }

    if (option === 'local') {
        return (
            <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-6 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Server className="text-slate-600" size={32} />
                </div>

                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                    Connect to Local Ollama
                </h3>

                <p className="text-slate-600 mb-6">
                    We found Ollama running on your machine. Ready to connect!
                </p>

                <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left text-sm">
                    <div className="text-slate-700 space-y-1">
                        <div>• Server: localhost:11434</div>
                        <div>• Model: {detectionResults?.local?.models?.[0]?.name || 'gemma3:4b'}</div>
                        <div>• Status: Ready</div>
                    </div>
                </div>

                {consentData.hasConsented && (
                    <div className="bg-green-50 rounded-xl p-3 mb-6 flex items-center gap-2">
                        <CheckCircle className="text-green-600" size={16} />
                        <span className="text-green-700 text-sm">Consent granted</span>
                    </div>
                )}

                <button
                    onClick={onSetup}
                    className="px-8 py-3 bg-slate-600 text-white rounded-xl hover:bg-slate-700 transition-colors font-medium"
                >
                    Connect to Ollama
                </button>
            </div>
        );
    }

    return null;
};

export const TestingStep = ({ config, isTesting, testResults }) => (
    <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-2xl flex items-center justify-center">
            {isTesting ? (
                <Loader className="text-blue-600 animate-spin" size={32} />
            ) : testResults?.success ? (
                <CheckCircle className="text-green-600" size={32} />
            ) : (
                <AlertTriangle className="text-red-600" size={32} />
            )}
        </div>

        <h3 className="text-xl font-semibold text-slate-800 mb-3">
            {isTesting ? 'Setting up your AI...' :
                testResults?.success ? 'Setup complete!' : 'Setup failed'}
        </h3>

        <p className="text-slate-600 mb-6">
            {isTesting ? 'This may take a few moments' :
                testResults?.success ? 'Your AI is ready to use' :
                    'Something went wrong during setup'}
        </p>

        {config && (
            <div className="bg-slate-50 rounded-xl p-4 text-sm">
                <div className="text-slate-700">
                    <div className="font-medium mb-2">Configuration:</div>
                    <div>Type: {config.type === 'webllm' ? 'In-Browser AI' :
                        config.type === 'external' ? 'Cloud AI' : 'Local AI'}</div>
                    <div>Model: {config.model}</div>
                </div>
            </div>
        )}

        {isTesting && (
            <div className="flex items-center justify-center gap-2 text-slate-600 mt-6">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
        )}
    </div>
);

// Success Step - Clear next steps
export const SuccessStep = ({ config, onFinish }) => (
    <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-2xl flex items-center justify-center">
            <CheckCircle className="text-green-600" size={32} />
        </div>

        <h3 className="text-xl font-semibold text-slate-800 mb-3">
            You're all set!
        </h3>

        <p className="text-slate-600 mb-6">
            Your AI is connected and ready. Start exploring ideas by typing any topic you're curious about.
        </p>

        <div className="bg-green-50 rounded-xl p-4 mb-6 text-left text-sm">
            <div className="text-green-800">
                <div className="font-medium mb-2">Quick tips:</div>
                <div className="space-y-1">
                    <div>• Click nodes to explore deeper</div>
                    <div>• Use arrow keys to navigate</div>
                    <div>• Select multiple nodes for context</div>
                </div>
            </div>
        </div>

        <button
            onClick={onFinish}
            className="px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium shadow-lg hover:shadow-xl"
        >
            Start Exploring!
        </button>
    </div>
);