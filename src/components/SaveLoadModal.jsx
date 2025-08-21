// Graph save/load interface

import { useCallback, useEffect } from 'react';
import { X, Save } from 'lucide-react';

const SaveLoadModal = ({
  showSaveLoad,
  savedGraphs,
  hasNodes,
  onClose,
  onSave,
  onLoad,
  onDelete
}) => {

  const handleClose = useCallback(() => {
    if (!showSaveLoad) return null;
    onClose();
  }, [onClose, showSaveLoad]);

  const handleSave = useCallback(() => {
    if (!showSaveLoad) return null;
    onSave();
    onClose();
  }, [onSave, onClose, showSaveLoad]);

  const handleLoad = useCallback((graph) => {
    if (!showSaveLoad) return null;
    onLoad(graph);
  }, [onLoad, showSaveLoad]);

  const handleDelete = useCallback((id) => {
    if (!showSaveLoad) return null;
    onDelete(id);
  }, [onDelete, showSaveLoad]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    if (showSaveLoad) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showSaveLoad, handleClose]);

  if (!showSaveLoad) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">Saved Graphs</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {hasNodes && (
          <div className="mb-4">
            <button
              onClick={handleSave}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              Save Current Graph
            </button>
          </div>
        )}

        <div className="space-y-2">
          {savedGraphs.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No saved graphs yet</p>
          ) : (
            savedGraphs.map((graph) => (
              <div key={graph.id} className="bg-gray-800 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-semibold text-sm truncate">
                    {graph.name}
                  </h4>
                  <button
                    onClick={() => handleDelete(graph.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-gray-400 text-xs mb-2">
                  {new Date(graph.timestamp).toLocaleDateString()} • {graph.nodes.length} nodes
                </p>
                <button
                  onClick={() => handleLoad(graph)}
                  className="w-full px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                >
                  Load Graph
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SaveLoadModal;