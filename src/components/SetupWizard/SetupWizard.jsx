// Main Setup Wizard orchestrator component

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ArrowLeft, Loader, CheckCircle, AlertTriangle, Brain } from 'lucide-react';

import {
    SETUP_STEPS,
    CONNECTION_STATUS,
    MODEL_TYPES,
    DEMO_GRAPH_DATA,
    SETUP_MESSAGES
} from '../../constants/setupWizardConstants';

import {
    detectAvailableModels,
    testModelConnection,
    saveSetupConfig,
    loadSetupConfig,
    getStepProgress,
    getNextStep,
    getPreviousStep
} from '../../utils/setupWizardUtils';

import {
    WelcomeStep,
    DetectionStep,
    ModelChoiceStep,
    LocalSetupStep,
    ApiSetupStep
} from './StepComponents';

const SetupWizard = ({
    isOpen,
    onClose,
    onComplete,
    onModelChange,
    onLoadDemoGraph
}) => {
    const [currentStep, setCurrentStep] = useState(SETUP_STEPS.WELCOME);
    const [detectionResults, setDetectionResults] = useState(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResults, setTestResults] = useState(null);
    const [config, setConfig] = useState(null);
    const [error, setError] = useState(null);

    // Abort controller for preventing race conditions
    const abortControllerRef = useRef(null);

    // Step progression logic
    const allSteps = [
        SETUP_STEPS.WELCOME,
        SETUP_STEPS.DETECTION,
        SETUP_STEPS.MODEL_CHOICE,
        SETUP_STEPS.LOCAL_SETUP,
        SETUP_STEPS.API_SETUP,
        SETUP_STEPS.TESTING,
        SETUP_STEPS.SUCCESS
    ];

    const currentStepIndex = allSteps.indexOf(currentStep);
    const progress = getStepProgress(currentStep, allSteps);

    // Cleanup on unmount or close
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // Load saved configuration on mount
    useEffect(() => {
        if (isOpen) {
            const saved = loadSetupConfig();
            if (saved.isComplete && saved.config) {
                setCurrentStep(SETUP_STEPS.SUCCESS);
                setConfig(saved.config);
            }
        }
    }, [isOpen]);


    // Model choice handlers
    const handleChooseLocal = () => {
        setCurrentStep(SETUP_STEPS.LOCAL_SETUP);
    };

    const handleChooseExternal = () => {
        setCurrentStep(SETUP_STEPS.API_SETUP);
    };

    const handleChooseDemo = () => {
        onLoadDemoGraph(DEMO_GRAPH_DATA);
        onComplete({ type: MODEL_TYPES.DEMO });
        onClose();
    };

    // Configuration handlers
    const handleLocalConfiguration = (localConfig) => {
        setConfig({
            type: MODEL_TYPES.LOCAL,
            ...localConfig
        });
    };

    const handleApiConfiguration = (apiConfig) => {
        setConfig({
            type: MODEL_TYPES.EXTERNAL,
            ...apiConfig
        });
    };

    // Connection testing with proper abort handling
    const handleTestConnection = useCallback(async (testConfig = config) => {
        if (!testConfig) return;

        // Cancel any previous test
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();

        setIsTesting(true);
        setError(null);
        setTestResults(null);
        setCurrentStep(SETUP_STEPS.TESTING);

        try {
            const results = await testModelConnection(testConfig, abortControllerRef.current.signal);

            // Check if we were aborted
            if (abortControllerRef.current.signal.aborted) {
                return;
            }

            setTestResults(results);

            if (results.success) {
                const saved = saveSetupConfig(testConfig);
                if (saved) {
                    onModelChange(testConfig);
                    onComplete(testConfig);

                    setTimeout(() => {
                        if (!abortControllerRef.current?.signal.aborted) {
                            setCurrentStep(SETUP_STEPS.SUCCESS);
                        }
                    }, 1500);
                } else {
                    setError('Failed to save configuration');
                }
            } else {
                setError(results.error || 'Connection test failed');
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                setError('Connection test failed');
                console.error('Connection test error:', error);
            }
        } finally {
            setIsTesting(false);
        }
    }, [config, onComplete, onModelChange]);

    // Detection logic with proper abort handling
    const handleDetection = useCallback(async () => {
        // Cancel any previous detection
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        setIsDetecting(true);
        setError(null);

        try {
            const results = await detectAvailableModels(abortControllerRef.current.signal);

            // Check if we were aborted
            if (abortControllerRef.current.signal.aborted) {
                return;
            }

            setDetectionResults(results);

            // Auto-advance if we found working local models (with delay to show results)
            if (results.local.status === CONNECTION_STATUS.SUCCESS && results.local.models.length > 0) {
                setTimeout(() => {
                    if (!abortControllerRef.current?.signal.aborted) {
                        const firstModel = results.local.models[0];
                        const autoConfig = {
                            type: MODEL_TYPES.LOCAL,
                            address: 'http://localhost:11434',
                            model: firstModel.name
                        };
                        setConfig(autoConfig);
                        handleTestConnection(autoConfig);
                    }
                }, 1500);
            } else {
                // Move to model choice after showing results briefly
                setTimeout(() => {
                    if (!abortControllerRef.current?.signal.aborted) {
                        setCurrentStep(SETUP_STEPS.MODEL_CHOICE);
                    }
                }, 1200);
            }

        } catch (error) {
            if (error.name !== 'AbortError') {
                setError('Detection failed. Please try again.');
                console.error('Detection error:', error);
            }
        } finally {
            setIsDetecting(false);
        }
    }, [handleTestConnection]);

    // Auto-run detection after welcome (with race condition protection)
    useCallback(() => {
        if (currentStep === SETUP_STEPS.DETECTION && !detectionResults && !isDetecting) {
            const timeoutId = setTimeout(() => {
                handleDetection();
            }, 500); // Small delay to prevent immediate spam

            return () => clearTimeout(timeoutId);
        }
    }, [currentStep, isDetecting, detectionResults, handleDetection]);

    // Navigation handlers
    const handleNext = () => {
        const nextStep = getNextStep(currentStep, detectionResults);
        if (nextStep) {
            setCurrentStep(nextStep);
        }
    };

    const handleBack = () => {
        const prevStep = getPreviousStep(currentStep);
        if (prevStep) {
            setCurrentStep(prevStep);
            setError(null);
        }
    };

    const handleClose = useCallback(() => {
        // Cancel any ongoing operations
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Reset state
        setCurrentStep(SETUP_STEPS.WELCOME);
        setDetectionResults(null);
        setConfig(null);
        setTestResults(null);
        setError(null);
        setIsDetecting(false);
        setIsTesting(false);

        onClose();
    }, [onClose]);

    const canGoBack = currentStep !== SETUP_STEPS.WELCOME &&
        currentStep !== SETUP_STEPS.DETECTION &&
        currentStep !== SETUP_STEPS.TESTING &&
        currentStep !== SETUP_STEPS.SUCCESS;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 rounded-3xl">
            <div className="bg-gradient-to-br from-slate-50 to-white rounded-3xl shadow-2xl w-full max-w-5xl border border-slate-200"
                style={{ height: '85vh' }}>

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-white/80 backdrop-blur-sm h-20">
                    <div className="flex items-center gap-4">
                        {canGoBack && (
                            <button
                                onClick={handleBack}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                                title="Go back"
                            >
                                <ArrowLeft size={20} className="text-slate-600" />
                            </button>
                        )}

                        <div>
                            <h2 className="text-xl font-bold text-slate-800">
                                {currentStep === SETUP_STEPS.WELCOME && 'Welcome to Graphible'}
                                {currentStep === SETUP_STEPS.DETECTION && 'Setting Up...'}
                                {currentStep === SETUP_STEPS.MODEL_CHOICE && 'Choose Your AI'}
                                {currentStep === SETUP_STEPS.LOCAL_SETUP && 'Local Setup'}
                                {currentStep === SETUP_STEPS.API_SETUP && 'Cloud Setup'}
                                {currentStep === SETUP_STEPS.TESTING && 'Testing Connection...'}
                                {currentStep === SETUP_STEPS.SUCCESS && 'Ready to Go!'}
                            </h2>
                            <div className="text-sm text-slate-500">
                                Step {currentStepIndex + 1} of {allSteps.length}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Progress bar */}
                        <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            title="Close setup"
                        >
                            <X size={20} className="text-slate-600" />
                        </button>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="bg-rose-50 border-b border-rose-200 p-4 h-16 flex items-center">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="text-rose-600 flex-shrink-0" size={20} />
                            <div>
                                <div className="font-medium text-rose-800 text-sm">Connection Error</div>
                                <div className="text-rose-600 text-xs">{error}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 flex items-center justify-center p-4"
                    style={{ height: `calc(85vh - ${error ? '144px' : '112px'})` }}>

                    {currentStep === SETUP_STEPS.WELCOME && (
                        <WelcomeStep onNext={handleNext} />
                    )}

                    {currentStep === SETUP_STEPS.DETECTION && (
                        <DetectionStep
                            detectionResults={detectionResults}
                            isDetecting={isDetecting}
                        />
                    )}

                    {currentStep === SETUP_STEPS.MODEL_CHOICE && (
                        <ModelChoiceStep
                            detectionResults={detectionResults}
                            onChooseLocal={handleChooseLocal}
                            onChooseExternal={handleChooseExternal}
                            onChooseDemo={handleChooseDemo}
                        />
                    )}

                    {currentStep === SETUP_STEPS.LOCAL_SETUP && (
                        <LocalSetupStep
                            detectionResults={detectionResults}
                            onConfigurationChange={handleLocalConfiguration}
                            onTest={handleTestConnection}
                        />
                    )}

                    {currentStep === SETUP_STEPS.API_SETUP && (
                        <ApiSetupStep
                            onConfigurationChange={handleApiConfiguration}
                            onTest={handleTestConnection}
                        />
                    )}

                    {currentStep === SETUP_STEPS.TESTING && (
                        <TestingStep
                            config={config}
                            testResults={testResults}
                            isTesting={isTesting}
                            onRetry={() => handleTestConnection()}
                        />
                    )}

                    {currentStep === SETUP_STEPS.SUCCESS && (
                        <SuccessStep
                            config={config}
                            testResults={testResults}
                            onFinish={handleClose}
                            onReconfigure={() => setCurrentStep(SETUP_STEPS.MODEL_CHOICE)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

// Testing Step Component
const TestingStep = ({ config, testResults, isTesting, onRetry }) => (
    <div className="w-full max-w-xl text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center">
            {isTesting ? (
                <Loader className="text-indigo-600 animate-spin" size={40} />
            ) : testResults?.success ? (
                <CheckCircle className="text-emerald-600" size={40} />
            ) : (
                <AlertTriangle className="text-rose-600" size={40} />
            )}
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">
            {isTesting ? 'Testing Connection...' :
                testResults?.success ? 'Connection Successful!' : 'Connection Failed'}
        </h1>

        <p className="text-lg text-indigo-600 mb-6">
            {isTesting ? 'This may take a few moments' :
                testResults?.success ? 'Your AI model is ready to use' :
                    'There was a problem connecting to your AI model'}
        </p>

        {config && (
            <div className="bg-slate-50 rounded-xl p-4 mb-6 text-sm">
                <div className="grid grid-cols-2 gap-4">
                    <div className="text-left">
                        <div className="text-slate-600">Type:</div>
                        <div className="font-medium text-slate-800">
                            {config.type === 'local' ? 'Local Model' : 'Cloud Model'}
                        </div>
                    </div>
                    <div className="text-left">
                        <div className="text-slate-600">Model:</div>
                        <div className="font-medium text-slate-800">{config.model}</div>
                    </div>
                </div>
            </div>
        )}

        {testResults && !testResults.success && (
            <div className="bg-rose-50 rounded-xl p-4 mb-6">
                <div className="font-medium text-rose-800 mb-1 text-sm">{testResults.error}</div>
                {testResults.suggestion && (
                    <div className="text-rose-600 text-xs">💡 {testResults.suggestion}</div>
                )}
            </div>
        )}

        {!isTesting && !testResults?.success && (
            <button
                onClick={onRetry}
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold"
            >
                Try Again
            </button>
        )}

        {isTesting && (
            <div className="flex items-center justify-center gap-2 text-slate-600">
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
        )}
    </div>
);

// Success Step Component
const SuccessStep = ({ config, testResults, onFinish, onReconfigure }) => (
    <div className="w-full max-w-2xl text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center">
            <CheckCircle className="text-emerald-600" size={40} />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">
            {SETUP_MESSAGES.SUCCESS?.title}
        </h1>

        <p className="text-lg text-emerald-600 mb-4">
            {SETUP_MESSAGES.SUCCESS?.subtitle}
        </p>

        <p className="text-slate-600 mb-6">
            {SETUP_MESSAGES.SUCCESS?.description}
        </p>

        {/* Configuration Summary */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 mb-6 border border-emerald-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-white rounded-lg p-3">
                    <div className="font-medium text-slate-800 mb-1">Model Type</div>
                    <div className="text-slate-600">
                        {config?.type === 'local' ? '🖥️ Local' :
                            config?.type === 'external' ? '☁️ Cloud' :
                                '🎭 Demo'}
                    </div>
                </div>

                <div className="bg-white rounded-lg p-3">
                    <div className="font-medium text-slate-800 mb-1">Model Name</div>
                    <div className="text-slate-600">{config?.model || 'Demo Content'}</div>
                </div>
            </div>
        </div>

        {/* Quick Tips*/}
        <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-slate-800 mb-3 text-sm">Quick Start Tips</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    <span>Click nodes to explore</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                    <span>Arrow keys navigate</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                    <span>Select nodes for context</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                    <span>Save graphs for later</span>
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
            <button
                onClick={onFinish}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
                Start Exploring!
            </button>

            <button
                onClick={onReconfigure}
                className="px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 font-medium"
            >
                Change Setup
            </button>
        </div>
    </div>
);

export default SetupWizard;