import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Settings, Globe, Server, Brain, CheckCircle, AlertCircle } from 'lucide-react';
import { LLM_CONFIG, DEFAULT_MODEL_CONFIGS, WEBLLM_STATE } from '../constants/graphConstants';
import WebLLMProgressTracker from '../components/WebLLMProgressTracker';

const ModelSelector = ({
    currentModel,
    onModelChange,
    connectionStatus,
    onTestConnection,
    webllmLoadingProgress,
    webllmLoadState,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(currentModel.type || 'webllm');
    const dropdownRef = useRef(null);

    const shouldShowProgressTracker = (webllmState) => {
        return ((webllmState == WEBLLM_STATE.RELOADING) || (webllmState == WEBLLM_STATE.DOWNLOADING));
    };

    const [localConfig, setLocalConfig] = useState({
        address: currentModel.address || DEFAULT_MODEL_CONFIGS.LOCAL.address,
        model: currentModel.model || DEFAULT_MODEL_CONFIGS.LOCAL.model
    });

    const [externalConfig, setExternalConfig] = useState({
        provider: currentModel.provider || DEFAULT_MODEL_CONFIGS.EXTERNAL.provider,
        model: currentModel.model || DEFAULT_MODEL_CONFIGS.EXTERNAL.model,
        apiKey: currentModel.apiKey || ''
    });

    const [webllmConfig, setWebllmConfig] = useState({
        model: currentModel.model || DEFAULT_MODEL_CONFIGS.WEBLLM.model
    });

    // Load saved API key on component mount
    useEffect(() => {
        const savedApiKey = localStorage.getItem('graphible-google-api-key');
        if (savedApiKey && !externalConfig.apiKey) {
            setExternalConfig(prev => ({ ...prev, apiKey: savedApiKey }));
        }
    }, [externalConfig.apiKey]);

    const googleModels = [
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Fast and lightweight' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Balanced performance' },
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Maximum capability' }
    ];

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSave = () => {
        let config;

        if (activeTab === 'local') {
            config = { type: 'local', ...localConfig };
        } else if (activeTab === 'external') {
            config = { type: 'external', ...externalConfig };
        } else if (activeTab === 'webllm') {
            config = { type: 'webllm', ...webllmConfig };
        }

        // Save Google API key to localStorage if it's an external config
        if (activeTab === 'external' && externalConfig.apiKey.trim()) {
            localStorage.setItem('graphible-google-api-key', externalConfig.apiKey.trim());
        }

        onModelChange(config);
        console.log(config);
        setIsOpen(false);
        // Test the connection with new config
        setTimeout(() => onTestConnection(config), 100);
    };

    const getStatusColor = () => {
        switch (connectionStatus) {
            case 'connected': return 'text-emerald-600';
            case 'pending': return 'text-amber-600';
            default: return 'text-rose-600';
        }
    };

    const getDisplayName = () => {
        if (currentModel.type === 'external') {
            const model = googleModels.find(m => m.id === currentModel.model);
            return model ? model.name : currentModel.model;
        } else if (currentModel.type === 'webllm') {
            const model = LLM_CONFIG.WEBLLM[currentModel.model];
            return model ? model.name : currentModel.model;
        }
        return `${currentModel.model || 'gemma3:4b'}`;
    };

    const getDisplayIcon = useCallback(() => {
        if (currentModel.type === 'external') return Globe;
        if (currentModel.type === 'webllm') return Brain;
        return Server;
    }, [currentModel.type]);

    const DisplayIcon = getDisplayIcon();

    return (
        <div className="relative font-inter" ref={dropdownRef}>
            {/* Main Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 bg-white/80 border border-slate-200 rounded-lg text-slate-700 hover:border-slate-300 hover:bg-white transition-all duration-300 shadow-sm"
                style={{
                    boxShadow: isOpen ? '0 0 0 3px rgb(148 163 184 / 0.1)' : undefined,
                }}
            >
                <div className="flex items-center gap-2">
                    <DisplayIcon size={16} className={
                        currentModel.type === 'external' ? 'text-indigo-600' :
                            currentModel.type === 'webllm' ? 'text-purple-600' :
                                'text-slate-600'
                    } />
                    <span className="text-sm font-medium">{getDisplayName()}</span>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor().replace('text-', 'bg-').replace('400', '500')}`} />
                </div>
                <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Progress indicator for WebLLM */}
            {shouldShowProgressTracker(webllmLoadState) && webllmLoadingProgress && (<WebLLMProgressTracker webllmLoadState={webllmLoadState} progress={webllmLoadingProgress} modelName={currentModel.model}/>)}

            {/* Dropdown */}
            {isOpen && (
                <div
                    className="absolute top-full left-0 mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                    {/* Tab Headers */}
                    <div className="flex border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('webllm')}
                            className={`flex-1 px-3 py-3 text-sm font-medium transition-all duration-200 relative ${activeTab === 'webllm'
                                ? 'text-purple-700 bg-purple-50'
                                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex items-center gap-2 justify-center">
                                <Brain size={14} />
                                Browser
                            </div>
                            {activeTab === 'webllm' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-700" />
                            )}
                        </button>

                        <button
                            onClick={() => setActiveTab('local')}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 relative ${activeTab === 'local'
                                ? 'text-slate-800 bg-slate-50'
                                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex items-center gap-2 justify-center z-2">
                                <Server size={16} />
                                Local Model
                            </div>
                            {activeTab === 'local' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800" />
                            )}
                        </button>

                        <button
                            onClick={() => setActiveTab('external')}
                            className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 relative ${activeTab === 'external'
                                ? 'text-indigo-700 bg-indigo-50'
                                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex items-center gap-2 justify-center">
                                <Globe size={16} />
                                External API
                            </div>
                            {activeTab === 'external' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-700" />
                            )}
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-4">
                        {activeTab === 'webllm' && (
                            <div className="space-y-4">
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-start gap-2">
                                        <Brain className="text-purple-600 flex-shrink-0 mt-0.5" size={16} />
                                        <div>
                                            <h3 className="font-semibold text-purple-800 mb-1 text-sm">AI in Your Browser</h3>
                                            <div className="text-purple-700 text-xs space-y-1">
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle size={10} />
                                                    <span>No installation required</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle size={10} />
                                                    <span>Complete privacy - data stays local</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle size={10} />
                                                    <span>Works offline after initial download</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Select Model
                                    </label>
                                    <div className="space-y-2">
                                        {Object.entries(LLM_CONFIG.WEBLLM).map(([modelId, modelInfo]) => (
                                            <label
                                                key={modelId}
                                                className={`flex items-center p-3 border rounded cursor-pointer transition-all duration-200 ${webllmConfig.model === modelId
                                                    ? 'border-purple-500 bg-purple-50'
                                                    : 'border-slate-200 hover:border-purple-300 hover:bg-purple-25'
                                                    }`}
                                                onClick={() => setWebllmConfig(prev => ({ ...prev, model: modelId }))}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className="font-medium text-sm text-slate-800">{modelInfo.name}</div>
                                                        {modelInfo.recommended && (
                                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                                                Recommended
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-600 mb-2">{modelInfo.description}</div>
                                                    <div className="flex items-center gap-3 text-xs text-slate-500">
                                                        <span>Size: {modelInfo.size}</span>
                                                        <span>Performance: {modelInfo.performance}</span>
                                                    </div>
                                                </div>
                                                <div className={`w-4 h-4 border-2 rounded-full transition-all duration-200 ${webllmConfig.model === modelId
                                                    ? 'border-purple-500 bg-purple-500'
                                                    : 'border-slate-300'
                                                    }`}>
                                                    {webllmConfig.model === modelId && (
                                                        <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={14} />
                                        <div className="text-amber-700 text-xs">
                                            <div className="font-semibold mb-1">Requirements:</div>
                                            <div>• Chrome/Edge 113+, Firefox 141+, or Safari 26+</div>
                                            <div>• First download may take 1-3 minutes</div>
                                            <div>• 8GB+ RAM recommended for larger models</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'local' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-black-300 mb-2">
                                        Server Address
                                    </label>
                                    <input
                                        type="text"
                                        value={localConfig.address}
                                        onChange={(e) => setLocalConfig(prev => ({ ...prev, address: e.target.value }))}
                                        placeholder="http://localhost:11434"
                                        className="w-full px-3 py-2 bg-white-800 border border-gray-600 rounded text-black placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-all duration-200 group"
                                        onFocus={(e) => {
                                            e.target.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.2)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.boxShadow = 'none';
                                        }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-black-300 mb-2">
                                        Model Name
                                    </label>
                                    <input
                                        type="text"
                                        value={localConfig.model}
                                        onChange={(e) => setLocalConfig(prev => ({ ...prev, model: e.target.value }))}
                                        placeholder="gemma3:4b"
                                        className="w-full px-3 py-2 bg-white-800 border border-gray-600 rounded text-black placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-all duration-200"
                                        onFocus={(e) => {
                                            e.target.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.2)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.boxShadow = 'none';
                                        }}
                                    />
                                </div>

                                <div className="text-xs text-black-400 bg-white-800/50 p-3 rounded">
                                    <div className="font-semibold mb-1">Local Setup Instructions:</div>
                                    <div>1. Install <span className="text-blue-400">Ollama</span></div>
                                    <div>2. Run: <code className="bg-gray-100 px-1 rounded">OLLAMA_ORIGINS=* ollama serve</code></div>
                                    <div>3. Pull model: <code className="bg-gray-100 px-1 rounded">ollama pull gemma3:4b</code></div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'external' && (
                            <div className="space-y-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                    <div className="flex items-start gap-2">
                                        <Globe className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                                        <div>
                                            <h3 className="font-semibold text-blue-800 mb-1 text-sm">Cloud AI Models</h3>
                                            <div className="text-blue-700 text-xs space-y-1">
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle size={10} />
                                                    <span>Instant setup</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle size={10} />
                                                    <span>Maximum capability</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <AlertCircle size={10} />
                                                    <span>Requires internet & API costs</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Provider
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={externalConfig.provider}
                                            onChange={(e) => setExternalConfig(prev => ({
                                                ...prev,
                                                provider: e.target.value,
                                                model: 'gemini-2.5-flash-lite' // Reset to default model
                                            }))}
                                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none transition-all duration-200 appearance-none"
                                            onFocus={(e) => {
                                                e.target.style.boxShadow = '0 0 15px rgba(147, 51, 234, 0.2)';
                                            }}
                                            onBlur={(e) => {
                                                e.target.style.boxShadow = 'none';
                                            }}
                                        >
                                            <option value="google">Google AI</option>
                                        </select>
                                        <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Model
                                    </label>
                                    <div className="space-y-2">
                                        {googleModels.map((model) => (
                                            <label
                                                key={model.id}
                                                className={`flex items-center p-3 border rounded cursor-pointer transition-all duration-200 group ${externalConfig.model === model.id
                                                    ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                                                    : 'border-gray-600 hover:border-purple-400 hover:bg-purple-500/5'
                                                    }`}
                                                onMouseEnter={(e) => {
                                                    if (externalConfig.model !== model.id) {
                                                        e.currentTarget.style.boxShadow = '0 0 15px rgba(147, 51, 234, 0.1)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (externalConfig.model !== model.id) {
                                                        e.currentTarget.style.boxShadow = 'none';
                                                    }
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="model"
                                                    value={model.id}
                                                    checked={externalConfig.model === model.id}
                                                    onChange={(e) => setExternalConfig(prev => ({ ...prev, model: e.target.value }))}
                                                    className="sr-only"
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">{model.name}</div>
                                                    <div className="text-xs text-gray-400">{model.description}</div>
                                                </div>
                                                <div className={`w-4 h-4 border-2 rounded-full transition-all duration-200 ${externalConfig.model === model.id
                                                    ? 'border-purple-500 bg-purple-500'
                                                    : 'border-gray-400'
                                                    }`}>
                                                    {externalConfig.model === model.id && (
                                                        <div className="w-2 h-2 bg-white rounded-full m-0.5" />
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={externalConfig.apiKey}
                                        onChange={(e) => setExternalConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                                        placeholder="Enter your Google AI API key"
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-500 focus:border-indigo-500 focus:outline-none transition-all duration-200"
                                    />
                                    <div className="text-xs text-slate-600 mt-1">
                                        Get your API key from <span className="text-indigo-600 font-medium">Google AI Studio</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 border-t border-gray-700 mt-4">
                            <button
                                onClick={handleSave}
                                disabled={
                                    (activeTab === 'external' && !externalConfig.apiKey.trim()) ||
                                    (activeTab === 'local' && (!localConfig.address.trim() || !localConfig.model.trim())) ||
                                    (activeTab === 'webllm' && !webllmConfig.model)
                                }
                                className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded font-medium hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed transition-all duration-200 group relative overflow-hidden"
                                onMouseEnter={(e) => {
                                    if (!e.target.disabled) {
                                        e.target.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.3)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.boxShadow = 'none';
                                }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                <div className="flex items-center gap-2 justify-center relative z-10">
                                    <Settings size={16} />
                                    Apply Settings
                                </div>
                            </button>

                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 bg-gray-700 text-gray-300 rounded font-medium hover:bg-gray-600 hover:text-white transition-all duration-200"
                                onMouseEnter={(e) => {
                                    e.target.style.boxShadow = '0 0 10px rgba(107, 114, 128, 0.2)';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.boxShadow = 'none';
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModelSelector;