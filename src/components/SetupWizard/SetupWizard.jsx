// Main Setup Wizard orchestrator component

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ArrowLeft, AlertTriangle } from 'lucide-react';

import {
    SETUP_STEPS,
    SETUP_STEPS_TITLES,
    MODEL_TYPES,
    DEMO_GRAPH_DATA,
} from '../../constants/setupWizardConstants';
import { DEFAULT_MODEL_CONFIGS } from '../../constants/graphConstants';

import {
    detectAvailableModels,
    testModelConnection,
    saveSetupConfig,
    loadSetupConfig,
} from '../../utils/setupWizardUtils';

import {
    WelcomeStep,
    ChoiceStep,
    SetupStep,
    TestingStep,
    SuccessStep,
} from './StepComponents';

const SetupWizard = ({
    isOpen,
    onClose,
    onComplete,
    onModelChange,
    onLoadDemoGraph
}) => {
    const [currentStep, setCurrentStep] = useState(SETUP_STEPS.WELCOME);
    const [selectedOption, setSelectedOption] = useState(null);
    const [config, setConfig] = useState(null);
    const [testResults, setTestResults] = useState(null);
    const [isTesting, setIsTesting] = useState(false);
    const [error, setError] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const [detectionResults, setDetectionResults] = useState(null);

    // Abort controller for preventing race conditions
    const abortControllerRef = useRef(null);

    // Step progression
    const allSteps = [
        SETUP_STEPS.WELCOME,
        SETUP_STEPS.CHOICE,
        SETUP_STEPS.SETUP,
        SETUP_STEPS.TESTING,
        SETUP_STEPS.SUCCESS
    ];

    const currentStepIndex = allSteps.indexOf(currentStep);
    const progress = ((currentStepIndex + 1) / allSteps.length) * 100;

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

    // Auto-detect when reaching choice step
    useEffect(() => {
        if (currentStep === SETUP_STEPS.CHOICE && !detectionResults) {
            detectAvailableModels()
                .then(results => setDetectionResults(results))
                .catch(err => console.warn('Detection failed:', err));
        }
    }, [currentStep, detectionResults]);

    const handleOptionSelect = useCallback((option) => {
        setSelectedOption(option);
        setError(null);

        if (option === 'demo') {
            // Skip directly to demo
            onLoadDemoGraph(DEMO_GRAPH_DATA);
            onComplete({ type: MODEL_TYPES.DEMO });
            onClose();
            return;
        }

        setCurrentStep(SETUP_STEPS.SETUP);
    }, [onLoadDemoGraph, onComplete, onClose]);

    const handleSetup = useCallback(async () => {
        if (!selectedOption) return;

        let setupConfig;

        if (selectedOption === 'browser') {
            setupConfig = DEFAULT_MODEL_CONFIGS.WEBLLM;
        } else if (selectedOption === 'cloud') {
            if (!apiKey.trim()) {
                setError('Please enter your API key');
                return;
            }
            setupConfig = {
                ...DEFAULT_MODEL_CONFIGS.EXTERNAL,
                apiKey: apiKey.trim()
            };
        } else if (selectedOption === 'local') {
            setupConfig = DEFAULT_MODEL_CONFIGS.LOCAL;
            const detectedModel = detectionResults?.local?.models?.[0]?.name;
            if (detectedModel) {
                setupConfig.model = detectedModel;
            }
        }

        setConfig(setupConfig);
        setCurrentStep(SETUP_STEPS.TESTING);

        // Test the configuration
        try {
            setIsTesting(true);
            const results = await testModelConnection(setupConfig);
            setTestResults(results);

            if (results.success) {
                saveSetupConfig(setupConfig);
                onModelChange(setupConfig);
                onComplete(setupConfig);
                setCurrentStep(SETUP_STEPS.SUCCESS);
            } else {
                setError(results.error || 'Setup failed');
                setCurrentStep(SETUP_STEPS.SETUP);
            }
        } catch (err) {
            setError('Setup failed: ' + err.message);
            setCurrentStep(SETUP_STEPS.SETUP);
        } finally {
            setIsTesting(false);
        }
    }, [selectedOption, apiKey, detectionResults, onModelChange, onComplete]);

    const handleBack = useCallback(() => {
        if (currentStep === SETUP_STEPS.SETUP) {
            setCurrentStep(SETUP_STEPS.CHOICE);
            setError(null);
        } else if (currentStep === SETUP_STEPS.CHOICE) {
            setCurrentStep(SETUP_STEPS.WELCOME);
        }
    }, [currentStep]);

    const handleClose = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Reset state
        setCurrentStep(SETUP_STEPS.WELCOME);
        setSelectedOption(null);
        setConfig(null);
        setTestResults(null);
        setError(null);
        setApiKey('');
        setDetectionResults(null);
        setIsTesting(false);

        onClose();
    }, [onClose]);

    const canGoBack = currentStep === SETUP_STEPS.CHOICE || currentStep === SETUP_STEPS.SETUP;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
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
                            <h2 className="text-xl font-semibold text-slate-800">
                                {SETUP_STEPS_TITLES[currentStep]}
                            </h2>
                            <div className="text-sm text-slate-500">
                                Step {currentStepIndex + 1} of {allSteps.length}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Progress bar */}
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-500 ease-out"
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
                    <div className="bg-red-50 border-b border-red-200 p-4 flex items-center gap-3">
                        <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
                        <div>
                            <div className="font-medium text-red-800 text-sm">Setup Error</div>
                            <div className="text-red-600 text-xs">{error}</div>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="p-8 min-h-[400px] flex items-center justify-center">
                    {currentStep === SETUP_STEPS.WELCOME && (
                        <WelcomeStep onNext={() => setCurrentStep(SETUP_STEPS.CHOICE)} />
                    )}

                    {currentStep === SETUP_STEPS.CHOICE && (
                        <ChoiceStep
                            detectionResults={detectionResults}
                            onSelect={handleOptionSelect}
                            selectedOption={selectedOption}
                        />
                    )}

                    {currentStep === SETUP_STEPS.SETUP && (
                        <SetupStep
                            option={selectedOption}
                            apiKey={apiKey}
                            onApiKeyChange={setApiKey}
                            onSetup={handleSetup}
                            detectionResults={detectionResults}
                        />
                    )}

                    {currentStep === SETUP_STEPS.TESTING && (
                        <TestingStep
                            config={config}
                            isTesting={isTesting}
                            testResults={testResults}
                        />
                    )}

                    {currentStep === SETUP_STEPS.SUCCESS && (
                        <SuccessStep
                            config={config}
                            onFinish={handleClose}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};


export default SetupWizard;