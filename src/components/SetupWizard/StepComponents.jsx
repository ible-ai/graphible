// Setup step components

import {
    Brain,
    Server,
    Globe,
    CheckCircle,
    Loader,
    Play,
} from 'lucide-react';

import {
    GOOGLE_AI_MODELS,
    PRIVACY_NOTICE,
    CONNECTION_STATUS
} from '../../constants/setupWizardConstants';


export const WelcomeStep = ({ onNext }) => (
    <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-2xl flex items-center justify-center">
            <Brain className="text-blue-600" size={32} />
        </div>

        <h1 className="text-2xl font-semibold text-slate-800 mb-3">
            Turn conversations into knowledge graphs
        </h1>

        <p className="text-slate-600 mb-8 leading-relaxed">
            Graphible helps you explore ideas by creating visual, interactive knowledge maps from AI conversations. Let's get you set up in under a minute.
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
                {/* Browser option - prominently featured */}
                <button
                    onClick={() => onSelect('browser')}
                    className="w-full p-6 border-2 border-blue-200 bg-blue-50 rounded-xl text-left hover:border-blue-300 hover:bg-blue-100 transition-all group"
                >
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <Brain className="text-white" size={24} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-slate-800">AI in your browser</h4>
                                <span className="px-2 py-1 bg-blue-500 text-white rounded-full text-xs font-medium">
                                    Recommended
                                </span>
                            </div>
                            <p className="text-slate-600 text-sm mb-3">
                                Private AI that runs directly in your browser. No servers, no data sharing.
                            </p>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span>✓ Completely private</span>
                                <span>✓ Works offline</span>
                                <span>✓ No setup needed</span>
                            </div>
                        </div>
                    </div>
                </button>

                {/* Demo option */}
                <button
                    onClick={() => onSelect('demo')}
                    className="w-full p-4 border border-slate-200 rounded-xl text-left hover:border-slate-300 hover:bg-slate-50 transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Play className="text-amber-600" size={20} />
                        </div>
                        <div>
                            <h4 className="font-medium text-slate-800">Try the demo</h4>
                            <p className="text-slate-600 text-sm">Explore with pre-loaded content first</p>
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

export const SetupStep = ({ option, apiKey, onApiKeyChange, onSetup, detectionResults }) => {
    if (option === 'browser') {
        return (
            <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <Brain className="text-blue-600" size={32} />
                </div>

                <h3 className="text-xl font-semibold text-slate-800 mb-3">
                    Ready to use Browser AI
                </h3>

                <p className="text-slate-600 mb-6">
                    Your browser AI is now configured. The model will download automatically when you first use it.
                </p>

                <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left">
                    <div className="text-sm text-blue-800 space-y-1">
                        <div>• Model: Llama 3.2 3B (optimized for web)</div>
                        <div>• Size: ~2GB download</div>
                        <div>• Storage: Saved in your browser</div>
                        <div>• Privacy: Never leaves your device</div>
                    </div>
                </div>

                <button
                    onClick={onSetup}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                >
                    Download & Setup
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
                    Connect to local Ollama
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
                    <div>Type: {config.type === 'webllm' ? 'Browser AI' :
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