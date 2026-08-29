// Graph save/load interface

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Save, Download, Upload } from 'lucide-react';

const SaveLoadModal = ({
  showSaveLoad,
  savedGraphs,
  hasNodes,
  onClose,
  onSave,
  onLoad,
  onDelete,
  onExport,
  onImport
}) => {
  const fileInputRef = useRef(null);
  const [importError, setImportError] = useState(null);

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportError(null);
    try {
      await onImport(file);
    } catch (error) {
      setImportError(error?.message || 'Could not read that file.');
    }
  };


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
          <div className="mb-4 flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Save size={16} />
              Save Current Graph
            </button>
            <button
              onClick={() => onExport?.()}
              title="Download the current graph as a file"
              className="px-4 py-2 bg-gray-700 text-gray-100 rounded hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Export
            </button>
          </div>
        )}

        <div className="mb-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-4 py-2 bg-gray-800 text-gray-200 rounded hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 border border-gray-600"
          >
            <Upload size={16} />
            Import from file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
            aria-label="Import graph file"
          />
          {importError && (
            <p className="text-red-400 text-xs mt-2">{importError}</p>
          )}
        </div>

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
                <div className="flex gap-2">
                  <button
                    onClick={() => handleLoad(graph)}
                    className="flex-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    Load Graph
                  </button>
                  <button
                    onClick={() => onExport?.(graph)}
                    title="Download this graph as a file"
                    className="px-3 py-1 bg-gray-700 text-gray-200 rounded hover:bg-gray-600 transition-colors text-sm"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SaveLoadModal;