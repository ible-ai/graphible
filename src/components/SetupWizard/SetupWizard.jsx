// Main Setup Wizard orchestrator component

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ArrowLeft, ArrowRight, AlertTriangle, RotateCcw } from 'lucide-react';

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
    ConsentStep,
} from './StepComponents';

// All possible steps - more granular navigation
const allSteps = [
    SETUP_STEPS.WELCOME,
    SETUP_STEPS.CHOICE,
    SETUP_STEPS.CONSENT,
    SETUP_STEPS.SETUP,
    SETUP_STEPS.TESTING,
    SETUP_STEPS.SUCCESS
];

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

    // NEW: Navigation and state management
    const [navigationHistory, setNavigationHistory] = useState([SETUP_STEPS.WELCOME]);
    const [completedSteps, setCompletedSteps] = useState(new Set());
    const [stepData, setStepData] = useState({
        selectedOption: null,
        consentData: {},
        apiKey: '',
        config: null,
        skipDemo: false
    });
    const [showExitConfirm, setShowExitConfirm] = useState(false);

    // Consent management state
    const [consentData, setConsentData] = useState({
        downloadSize: null,
        storageLocation: null,
        privacyInfo: null,
        hasConsented: false,
        consentTimestamp: null
    });

    // Abort controller for preventing race conditions
    const abortControllerRef = useRef(null);

    const modalRef = useRef(null);

    // Determine which steps are accessible based on current state
    const getAccessibleSteps = useCallback(() => {
        const accessible = [SETUP_STEPS.WELCOME, SETUP_STEPS.CHOICE];

        if (stepData.selectedOption && stepData.selectedOption !== 'demo') {
            accessible.push(SETUP_STEPS.CONSENT);

            if (consentData.hasConsented) {
                accessible.push(SETUP_STEPS.SETUP);

                if (stepData.config) {
                    accessible.push(SETUP_STEPS.TESTING);

                    if (testResults?.success) {
                        accessible.push(SETUP_STEPS.SUCCESS);
                    }
                }
            }
        }

        return accessible;
    }, [stepData.selectedOption, consentData.hasConsented, stepData.config, testResults]);

    // NEW: Check if user can navigate to a specific step
    const canNavigateToStep = useCallback((step) => {
        const accessible = getAccessibleSteps();
        return accessible.includes(step);
    }, [getAccessibleSteps]);

    // NEW: Enhanced navigation with state preservation
    const navigateToStep = useCallback((step, saveCurrentState = true) => {
        if (!canNavigateToStep(step)) {
            console.warn(`Cannot navigate to step: ${step}`);
            return false;
        }

        // Save current step state before navigating
        if (saveCurrentState) {
            setStepData(prev => ({
                ...prev,
                selectedOption: selectedOption || prev.selectedOption,
                apiKey: apiKey || prev.apiKey,
                config: config || prev.config,
                consentData: consentData
            }));
        }

        // Update navigation history
        setNavigationHistory(prev => {
            const newHistory = [...prev];
            if (newHistory[newHistory.length - 1] !== step) {
                newHistory.push(step);
            }
            return newHistory;
        });

        setCurrentStep(step);
        setError(null);
        return true;
    }, [canNavigateToStep, selectedOption, apiKey, config, consentData]);

    // NEW: Smart back navigation
    const handleBack = useCallback(() => {
        const accessible = getAccessibleSteps();
        const currentIndex = accessible.indexOf(currentStep);

        if (currentIndex > 0) {
            const previousStep = accessible[currentIndex - 1];
            navigateToStep(previousStep, false);
        }
    }, [currentStep, getAccessibleSteps, navigateToStep]);

    // NEW: Smart forward navigation
    const handleNext = useCallback(() => {
        const accessible = getAccessibleSteps();
        const currentIndex = accessible.indexOf(currentStep);

        if (currentIndex < accessible.length - 1) {
            const nextStep = accessible[currentIndex + 1];
            navigateToStep(nextStep, true);
        }
    }, [currentStep, getAccessibleSteps, navigateToStep]);

    // NEW: Reset wizard to start over
    const resetWizard = useCallback(() => {
        setCurrentStep(SETUP_STEPS.WELCOME);
        setSelectedOption(null);
        setConfig(null);
        setTestResults(null);
        setError(null);
        setApiKey('');
        setDetectionResults(null);
        setIsTesting(false);
        setNavigationHistory([SETUP_STEPS.WELCOME]);
        setCompletedSteps(new Set());
        setStepData({
            selectedOption: null,
            consentData: {},
            apiKey: '',
            config: null,
            skipDemo: false
        });
        setConsentData({
            downloadSize: null,
            storageLocation: null,
            privacyInfo: null,
            hasConsented: false,
            consentTimestamp: null
        });
    }, []);

    // NEW: Enhanced close with confirmation
    const handleClose = useCallback(() => {
        if (currentStep !== SETUP_STEPS.WELCOME && !completedSteps.has(SETUP_STEPS.SUCCESS)) {
            setShowExitConfirm(true);
        } else {
            onClose();
        }
    }, [currentStep, completedSteps, onClose]);

    // NEW: Confirm exit
    const confirmExit = useCallback(() => {
        resetWizard();
        setShowExitConfirm(false);
        onClose();
    }, [resetWizard, onClose]);

    // Keyboard navigation handlers
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            // Calculate navigation state inside the handler
            const accessible = getAccessibleSteps();
            const currentIndex = accessible.indexOf(currentStep);
            const canGoBack = currentIndex > 0;
            const canGoForward = currentIndex < accessible.length - 1 &&
                accessible.includes(allSteps[allSteps.indexOf(currentStep) + 1]);

            // Handle global keyboard shortcuts
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    handleClose();
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    if (canGoBack) handleBack();
                    break;

                case 'ArrowRight':
                    e.preventDefault();
                    if (canGoForward) handleNext();
                    break;

                case 'Home':
                    e.preventDefault();
                    navigateToStep(SETUP_STEPS.WELCOME);
                    break;

                case 'r':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        resetWizard();
                    }
                    break;

                case 'Enter':
                    // Handle Enter key on focused elements
                    if (e.target.tagName === 'BUTTON' || e.target.hasAttribute('role')) {
                        // Let the button handle it naturally
                        return;
                    }
                    break;

                case 'Tab':
                    // Ensure tab navigation stays within modal
                    const focusableElements = modalRef.current?.querySelectorAll(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    );

                    if (focusableElements?.length > 0) {
                        const firstElement = focusableElements[0];
                        const lastElement = focusableElements[focusableElements.length - 1];

                        if (e.shiftKey) {
                            // Shift+Tab
                            if (document.activeElement === firstElement) {
                                e.preventDefault();
                                lastElement.focus();
                            }
                        } else {
                            // Tab
                            if (document.activeElement === lastElement) {
                                e.preventDefault();
                                firstElement.focus();
                            }
                        }
                    }
                    break;

                default:
                    // Number keys for step navigation (1-6)
                    if (e.key >= '1' && e.key <= '6') {
                        e.preventDefault();
                        const stepIndex = parseInt(e.key) - 1;
                        if (stepIndex < accessible.length) {
                            navigateToStep(accessible[stepIndex]);
                        }
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        // Focus management - focus the modal when it opens
        if (modalRef.current) {
            const firstFocusable = modalRef.current.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, showExitConfirm, currentStep, handleBack, handleNext, handleClose, navigateToStep, resetWizard, getAccessibleSteps, allSteps]);

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
                setCompletedSteps(new Set([SETUP_STEPS.SUCCESS]));
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

    // Prepare consent information based on selected option
    const prepareConsentInfo = useCallback((option) => {
        if (option === 'browser') {
            return {
                downloadSize: '~2.2GB',
                storageLocation: 'Your browser\'s local storage',
                privacyInfo: {
                    dataStaysLocal: true,
                    noServerConnection: true,
                    offlineCapable: true,
                    thirdPartySharing: false
                },
                risks: [
                    'Large download will use your internet bandwidth',
                    'Will consume browser storage space',
                    'First download may take several minutes'
                ],
                benefits: [
                    'Complete privacy - data never leaves your device',
                    'Works offline after initial download',
                    'No ongoing costs or API keys needed',
                    'Fast response times once loaded'
                ]
            };
        } else if (option === 'cloud') {
            return {
                downloadSize: 'None',
                storageLocation: 'No local storage required',
                privacyInfo: {
                    dataStaysLocal: false,
                    noServerConnection: false,
                    offlineCapable: false,
                    thirdPartySharing: true
                },
                risks: [
                    'Your prompts will be sent to Google\'s servers',
                    'Requires internet connection',
                    'API usage costs may apply',
                    'Subject to Google\'s privacy policy'
                ],
                benefits: [
                    'No download required',
                    'Immediate setup',
                    'Latest AI capabilities',
                    'No local storage needed'
                ]
            };
        } else if (option === 'local') {
            return {
                downloadSize: 'Varies by model',
                storageLocation: 'Your computer (via Ollama)',
                privacyInfo: {
                    dataStaysLocal: true,
                    noServerConnection: true,
                    offlineCapable: true,
                    thirdPartySharing: false
                },
                risks: [
                    'Requires technical setup (Ollama installation)',
                    'Uses significant computer resources',
                    'Model downloads can be large (2-7GB)'
                ],
                benefits: [
                    'Complete privacy and control',
                    'Works offline',
                    'No ongoing costs',
                    'Customizable models'
                ]
            };
        }
        return null;
    }, []);

    // NEW: Enhanced option selection with state preservation
    const handleOptionSelect = useCallback((option) => {
        setSelectedOption(option);
        setError(null);

        // Update step data
        setStepData(prev => ({
            ...prev,
            selectedOption: option
        }));

        if (option === 'demo') {
            // Demo can complete immediately if user wants
            onLoadDemoGraph(DEMO_GRAPH_DATA);
            onComplete({ type: MODEL_TYPES.DEMO });
            onClose();
            return;
        }

        // Prepare consent information for non-demo options
        const consentInfo = prepareConsentInfo(option);
        setConsentData(prev => ({
            ...prev,
            ...consentInfo,
            hasConsented: false
        }));

        // Move to consent step
        navigateToStep(SETUP_STEPS.CONSENT);
    }, [prepareConsentInfo, onLoadDemoGraph, onComplete, onClose, navigateToStep]);

    // NEW: Enhanced consent decision with navigation flexibility
    const handleConsentDecision = useCallback((consented, consentDetails = {}) => {
        setConsentData(prev => ({
            ...prev,
            hasConsented: consented,
            consentTimestamp: consented ? Date.now() : null,
            ...consentDetails
        }));

        if (consented) {
            // Store consent decision
            localStorage.setItem(`graphible-consent-${selectedOption}`, JSON.stringify({
                granted: true,
                timestamp: Date.now(),
                option: selectedOption
            }));

            setCompletedSteps(prev => new Set([...prev, SETUP_STEPS.CONSENT]));
            navigateToStep(SETUP_STEPS.SETUP);
        } else {
            // User declined - let them go back to choice step
            setError('Setup requires your consent to proceed. You can choose a different option or try the demo.');
            // Don't force navigation - let user decide
        }
    }, [selectedOption, navigateToStep]);

    // NEW: Enhanced setup with better error handling
    const handleSetup = useCallback(async () => {
        if (!selectedOption) {
            setError('Please select an option first');
            return;
        }

        // Check consent for options that require it
        if (['browser', 'cloud', 'local'].includes(selectedOption) && !consentData.hasConsented) {
            setError('Consent is required to proceed with this setup');
            navigateToStep(SETUP_STEPS.CONSENT);
            return;
        }

        let setupConfig;

        try {
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
            setStepData(prev => ({
                ...prev,
                config: setupConfig
            }));

            // Mark setup as completed
            setCompletedSteps(prev => new Set([...prev, SETUP_STEPS.SETUP]));

            // Move to testing
            navigateToStep(SETUP_STEPS.TESTING);

            // Test the configuration
            setIsTesting(true);
            const results = await testModelConnection(setupConfig);
            setTestResults(results);

            if (results.success) {
                saveSetupConfig(setupConfig);
                onModelChange(setupConfig);
                setCompletedSteps(prev => new Set([...prev, SETUP_STEPS.TESTING, SETUP_STEPS.SUCCESS]));
                navigateToStep(SETUP_STEPS.SUCCESS);
                // Don't auto-complete - let user finish manually
            } else {
                setError(results.error || 'Setup failed. Please check your configuration and try again.');
                // Stay on testing step so user can see the error and navigate back
            }
        } catch (err) {
            setError('Setup failed: ' + err.message);
            // Stay on current step for user to decide next action
        } finally {
            setIsTesting(false);
        }
    }, [selectedOption, apiKey, detectionResults, onModelChange, consentData.hasConsented, navigateToStep]);

    // NEW: Manual completion
    const handleComplete = useCallback(() => {
        if (config) {
            onComplete(config);
            onClose();
        }
    }, [config, onComplete, onClose]);

    if (!isOpen) return null;

    const accessible = getAccessibleSteps();
    const canGoBack = accessible.indexOf(currentStep) > 0;
    const canGoForward = accessible.indexOf(currentStep) < accessible.length - 1 &&
        accessible.includes(allSteps[allSteps.indexOf(currentStep) + 1]);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                ref={modalRef}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
                role="dialog"
                aria-modal="true"
                aria-labelledby="setup-wizard-title"
                aria-describedby="setup-wizard-description"
            >
                {/* Enhanced Header with Navigation */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            {canGoBack && (
                                <button
                                    onClick={handleBack}
                                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                                    title="Go back"
                                >
                                    <ArrowLeft size={20} className="text-slate-600" />
                                </button>
                            )}

                            <button
                                onClick={resetWizard}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                                title="Start over"
                            >
                                <RotateCcw size={16} className="text-slate-500" />
                            </button>
                        </div>

                        <div>
                            <h2 id="setup-wizard-title" className="text-xl font-semibold text-slate-800">
                                {SETUP_STEPS_TITLES[currentStep]}
                            </h2>
                            <div id="setup-wizard-description" className="flex items-center gap-2 text-sm text-slate-500">
                                <span>Step {accessible.indexOf(currentStep) + 1} of {accessible.length}</span>
                                {selectedOption && (
                                    <span className="text-blue-600">• {selectedOption} mode</span>
                                )}
                                <span className="text-xs text-slate-400">• Use ← → for navigation</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Progress bar */}
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-500 ease-out"
                                style={{ width: `${(accessible.indexOf(currentStep) + 1) / accessible.length * 100}%` }}
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

                {/* Step Navigation Breadcrumbs */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-2 text-sm overflow-x-auto">
                        {accessible.map((step, index) => {
                            const isCurrentStep = step === currentStep;
                            const isCompletedStep = completedSteps.has(step);
                            const isAccessible = canNavigateToStep(step);

                            return (
                                <div key={step} className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => isAccessible && navigateToStep(step)}
                                        disabled={!isAccessible}
                                        className={`px-3 py-1 rounded-lg transition-colors ${isCurrentStep
                                            ? 'bg-blue-500 text-white'
                                            : isCompletedStep
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                : isAccessible
                                                    ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            }`}
                                    >
                                        {SETUP_STEPS_TITLES[step]}
                                        {isCompletedStep && !isCurrentStep && ' ✓'}
                                    </button>
                                    {index < accessible.length - 1 && (
                                        <ArrowRight size={14} className="text-slate-400" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="bg-red-50 border-b border-red-200 p-4 flex items-center gap-3">
                        <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
                        <div className="flex-1">
                            <div className="font-medium text-red-800 text-sm">Setup Error</div>
                            <div className="text-red-600 text-xs">{error}</div>
                        </div>
                        <button
                            onClick={() => setError(null)}
                            className="text-red-400 hover:text-red-600"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="p-8 min-h-[400px] flex items-center justify-center">
                    {currentStep === SETUP_STEPS.WELCOME && (
                        <WelcomeStep onNext={() => navigateToStep(SETUP_STEPS.CHOICE)} />
                    )}

                    {currentStep === SETUP_STEPS.CHOICE && (
                        <ChoiceStep
                            detectionResults={detectionResults}
                            onSelect={handleOptionSelect}
                            selectedOption={selectedOption}
                        />
                    )}

                    {currentStep === SETUP_STEPS.CONSENT && (
                        <ConsentStep
                            option={selectedOption}
                            consentData={consentData}
                            onConsentDecision={handleConsentDecision}
                        />
                    )}

                    {currentStep === SETUP_STEPS.SETUP && (
                        <SetupStep
                            option={selectedOption}
                            apiKey={apiKey}
                            onApiKeyChange={setApiKey}
                            onSetup={handleSetup}
                            detectionResults={detectionResults}
                            consentData={consentData}
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
                            onFinish={handleComplete}
                        />
                    )}
                </div>

                {/* Enhanced Footer with Navigation Controls */}
                <div className="border-t border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {canGoBack && (
                                <button
                                    onClick={handleBack}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    aria-label="Go back to previous step"
                                    title="Go back (←)"
                                >
                                    ← Back
                                </button>
                            )}

                            <button
                                onClick={resetWizard}
                                className="px-4 py-2 text-slate-500 hover:text-slate-700 transition-colors text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none rounded"
                                aria-label="Start setup over from the beginning"
                                title="Start over (Ctrl+R)"
                            >
                                Start Over
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {currentStep === SETUP_STEPS.SUCCESS ? (
                                <button
                                    onClick={handleComplete}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium focus:ring-2 focus:ring-green-500 focus:outline-none"
                                    aria-label="Complete setup and start using Graphible"
                                >
                                    Finish Setup
                                </button>
                            ) : canGoForward ? (
                                <button
                                    onClick={handleNext}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    aria-label="Continue to next step"
                                    title="Next step (→)"
                                >
                                    Next →
                                </button>
                            ) : (
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    aria-label="Close setup wizard"
                                    title="Close (Escape)"
                                >
                                    Close
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Exit Confirmation Modal */}
            {showExitConfirm && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60">
                    <div
                        className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="exit-confirm-title"
                        aria-describedby="exit-confirm-description"
                    >
                        <h3 id="exit-confirm-title" className="text-lg font-semibold text-slate-800 mb-3">
                            Exit Setup?
                        </h3>
                        <p id="exit-confirm-description" className="text-slate-600 mb-6">
                            You're in the middle of setting up Graphible. If you exit now, your progress will be lost.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowExitConfirm(false)}
                                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                autoFocus
                                aria-label="Continue with setup"
                            >
                                Continue Setup
                            </button>
                            <button
                                onClick={confirmExit}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:ring-2 focus:ring-red-500 focus:outline-none"
                                aria-label="Exit setup and lose progress"
                            >
                                Exit Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SetupWizard;
