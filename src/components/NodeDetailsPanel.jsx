// Detailed node information display

import { X } from 'lucide-react';
import ReactMarkdown from "react-markdown";

const NodeDetailsPanel = ({ nodeDetails, onClose, feedbackHistory }) => {
  if (!nodeDetails) return null;

  const nodeFeedback = feedbackHistory.filter(f => f.nodeId === nodeDetails.id);

  return (
    <div className="absolute top-24 left-4 bg-black/90 backdrop-blur rounded-lg border border-gray-600 p-6 max-w-md z-50 details-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-lg">{nodeDetails.label}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="text-gray-200 text-sm overflow-y-auto max-h-64">
          <ReactMarkdown>{nodeDetails.content}</ReactMarkdown>
        </div>
      </div>

      {/* Feedback history for this node */}
      {nodeFeedback.length > 0 && (
        <div className="mt-4 bg-gray-800 p-4 rounded-lg">
          <p className="text-white font-semibold mb-2">Feedback History:</p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {nodeFeedback
              .slice(-3)
              .map((feedback, index) => (
                <div key={index} className="text-xs">
                  <span className={`px-2 py-1 rounded ${
                    feedback.isPositive ? 'bg-green-600' : 'bg-red-600'
                  } text-white`}>
                    {feedback.isPositive ? '👍' : '👎'}
                  </span>
                  <span className="text-gray-300 ml-2">{feedback.text}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeDetailsPanel;