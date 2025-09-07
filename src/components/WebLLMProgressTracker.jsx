// Progress indicator for in-browser AI

import { useState, useEffect, useCallback } from 'react';
import { Brain, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { WEBLLM_STATE } from '../constants/graphConstants';

const WebLLMProgressTracker = ({
    webllmLoadState,
    progress,
    modelName,
}) => {
    const [currentPhase, setCurrentPhase] = useState('preparing');
    const [downloadedMB, setDownloadedMB] = useState(0);
    const [totalMB] = useState(2048); // ~2GB model
    const [estimatedTimeLeft, setEstimatedTimeLeft] = useState(null);
    const [downloadSpeed, setDownloadSpeed] = useState(0);

    // Track download progress and calculate metrics
    useEffect(() => {
        if (!progress) return;

        // Determine current phase based on progress
        if (webllmLoadState == WEBLLM_STATE.RELOADING) {
            setCurrentPhase('loading');
        }
        else if (progress.progress < 0.1) {
            setCurrentPhase('preparing');
        } else if (progress.progress < 0.9) {
            setCurrentPhase('downloading');
        } else if (progress.progress < 1.0) {
            setCurrentPhase('loading');
        } else {
            setCurrentPhase('complete');
        }
        if (webllmLoadState == WEBLLM_STATE.DOWNLOADING) return;

        // Calculate downloaded amount
        const downloaded = Math.round(totalMB * progress.progress);
        setDownloadedMB(downloaded);

        // Calculate download speed and ETA (simplified)
        if (progress.progress > 0.1 && progress.progress < 0.9) {
            const elapsed = progress.elapsedTime || 0;
            if (elapsed > 0) {
                const speed = downloaded / (elapsed / 1000); // MB/s
                setDownloadSpeed(speed);

                const remaining = totalMB - downloaded;
                const eta = speed > 0 ? remaining / speed : null;
                setEstimatedTimeLeft(eta);
            }
        }
    }, [progress, totalMB, webllmLoadState]);

    const formatTime = useCallback((seconds) => {
        if (!seconds || seconds < 0) return '';

        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        } else if (seconds < 3600) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.round(seconds % 60);
            return `${mins}m ${secs}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${mins}m`;
        }
    }, []);

    const formatSpeed = useCallback((mbps) => {
        if (mbps < 1) {
            return `${Math.round(mbps * 1000)} KB/s`;
        } else {
            return `${mbps.toFixed(1)} MB/s`;
        }
    }, []);

    const getPhaseMessage = () => {
        switch (currentPhase) {
            case 'preparing':
                return 'Preparing to download AI model...';
            case 'downloading':
                return 'Downloading AI model to your browser...';
            case 'loading':
                return 'Loading model into memory...';
            case 'complete':
                return 'AI model ready!';
            default:
                return 'Setting up...';
        }
    };

    const getPhaseIcon = () => {
        switch (currentPhase) {
            case 'preparing':
                return <Brain className="text-blue-600 animate-pulse" size={24} />;
            case 'downloading':
                return <Download className="text-blue-600 animate-bounce" size={24} />;
            case 'loading':
                return <Brain className="text-blue-600 animate-spin" size={24} />;
            case 'complete':
                return <CheckCircle className="text-green-600" size={24} />;
            default:
                return <AlertTriangle className="text-amber-600" size={24} />;
        }
    };

    if (webllmLoadState == WEBLLM_STATE.NULL || webllmLoadState == WEBLLM_STATE.DONE) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            {getPhaseIcon()}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-800">
                                Setting up Browser AI
                            </h3>
                            <p className="text-sm text-slate-600">
                                {modelName}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Progress Content */}
                <div className="p-6">
                    {/* Status Message */}
                    <div className="text-center mb-6">
                        <p className="text-slate-700 font-medium mb-2">
                            {getPhaseMessage()}
                        </p>

                        {currentPhase === 'downloading' && (
                            <p className="text-sm text-slate-500">
                                This happens once and works offline afterward
                            </p>
                        )}
                    </div>

                    {/* Progress Bar */}
                    {progress && (
                        <div className="mb-6">
                            <div className="flex justify-between text-sm text-slate-600 mb-2">
                                <span>Progress</span>
                                <span>{Math.round((progress.progress || 0) * 100)}%</span>
                            </div>

                            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                                    style={{ width: `${Math.round((progress.progress || 0) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Download Stats */}
                    {currentPhase === 'downloading' && downloadedMB > 0 && (
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="text-center">
                                <div className="text-lg font-semibold text-slate-800">
                                    {downloadedMB} MB
                                </div>
                                <div className="text-xs text-slate-500">
                                    of {totalMB} MB
                                </div>
                            </div>

                            {downloadSpeed > 0 && (
                                <div className="text-center">
                                    <div className="text-lg font-semibold text-slate-800">
                                        {formatSpeed(downloadSpeed)}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        download speed
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Time Estimate */}
                    {estimatedTimeLeft && estimatedTimeLeft > 5 && (
                        <div className="text-center mb-4">
                            <p className="text-sm text-slate-600">
                                About {formatTime(estimatedTimeLeft)} remaining
                            </p>
                        </div>
                    )}

                    {/* Phase-specific information */}
                    <div className="bg-blue-50 rounded-xl p-4">
                        <div className="text-sm text-blue-800">
                            {currentPhase === 'preparing' && (
                                <div>
                                    <div className="font-medium mb-1">Getting ready...</div>
                                    <div>Checking browser compatibility and preparing download</div>
                                </div>
                            )}

                            {currentPhase === 'downloading' && (
                                <div>
                                    <div className="font-medium mb-1">Downloading model</div>
                                    <div>The AI model is being saved to your browser's storage</div>
                                </div>
                            )}

                            {currentPhase === 'loading' && (
                                <div>
                                    <div className="font-medium mb-1">Almost done!</div>
                                    <div>Loading the model into memory for first use</div>
                                </div>
                            )}

                            {currentPhase === 'complete' && (
                                <div>
                                    <div className="font-medium mb-1">Setup complete!</div>
                                    <div>Your browser AI is ready to use</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progress indicators */}
                    {currentPhase === 'downloading' && (
                        <div className="flex items-center justify-center gap-2 text-slate-600 mt-4">
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WebLLMProgressTracker;