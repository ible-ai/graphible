// User feedback collection interface

import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';

const FeedbackModal = ({ 
  showFeedbackModal, 
  onClose, 
  onSubmit, 
  getQuickFeedbackOptions 
}) => {
  const [feedbackText, setFeedbackText] = useState('');

  const handleClose = useCallback(() => {
    onClose();
    setFeedbackText('');
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    onSubmit(feedbackText);
    setFeedbackText('');
  }, [feedbackText, onSubmit]);

  const handleQuickSubmit = useCallback((option) => {
    onSubmit('', option);
    setFeedbackText('');
  }, [onSubmit]);

  // Handle escape key - always register the effect, but only act when modal is shown
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showFeedbackModal) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showFeedbackModal, handleClose]);

  // Reset feedback text when modal closes
  useEffect(() => {
    if (!showFeedbackModal) {
      setFeedbackText('');
    }
  }, [showFeedbackModal]);

  if (!showFeedbackModal) return null;

  const { isPositive } = showFeedbackModal;
  const quickOptions = getQuickFeedbackOptions(isPositive);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">
            {isPositive ? 'What worked well?' : 'What needs improvement?'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {quickOptions.length > 0 && (
          <div className="mb-4">
            <p className="text-gray-300 text-sm mb-2">Quick options:</p>
            <div className="space-y-2">
              {quickOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickSubmit(option)}
                  className="w-full text-left p-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-white transition-colors"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-2">
            Or describe specifically:
          </label>
          <input
            type="text"
            id="feedback-text"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder={isPositive ? "What did you like?" : "What should be improved?"}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSubmit();
              } else if (e.key === 'Escape') {
                handleClose();
              }
            }}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={!feedbackText.trim() && quickOptions.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Submit Feedback
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;