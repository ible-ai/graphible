// Component for managing deleted nodes
import { useState } from 'react';
import { X, RotateCcw, Trash2, Clock } from 'lucide-react';

const DeletionStoreModal = ({
    isOpen,
    onClose,
    deletedNodes,
    onRestoreNode,
    onPermanentlyDeleteNode
}) => {
    const [selectedItems, setSelectedItems] = useState(new Set());

    if (!isOpen) return null;

    const deletedNodesList = Array.from(deletedNodes.values());

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    const toggleSelection = (nodeId) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(nodeId)) {
                newSet.delete(nodeId);
            } else {
                newSet.add(nodeId);
            }
            return newSet;
        });
    };

    const restoreSelected = () => {
        selectedItems.forEach(nodeId => onRestoreNode(nodeId));
        setSelectedItems(new Set());
    };

    const permanentlyDeleteSelected = () => {
        if (window.confirm(`Permanently delete ${selectedItems.size} node(s)? This cannot be undone.`)) {
            selectedItems.forEach(nodeId => onPermanentlyDeleteNode(nodeId));
            setSelectedItems(new Set());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 font-inter">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                            <Trash2 className="text-red-600" size={16} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800">Deleted Nodes</h2>
                            <p className="text-sm text-slate-600">
                                {deletedNodesList.length} deleted node{deletedNodesList.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Bulk actions */}
                {selectedItems.size > 0 && (
                    <div className="p-4 bg-blue-50 border-b border-blue-200">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-blue-800">
                                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={restoreSelected}
                                    className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-1"
                                >
                                    <RotateCcw size={14} />
                                    Restore Selected
                                </button>
                                <button
                                    onClick={permanentlyDeleteSelected}
                                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center gap-1"
                                >
                                    <Trash2 size={14} />
                                    Delete Forever
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {deletedNodesList.length === 0 ? (
                        <div className="text-center py-12">
                            <Trash2 className="mx-auto text-slate-300 mb-4" size={48} />
                            <p className="text-slate-500">No deleted nodes</p>
                            <p className="text-sm text-slate-400 mt-1">
                                Deleted nodes will appear here for easy restoration
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {deletedNodesList
                                .sort((a, b) => b.deletedAt - a.deletedAt) // Most recent first
                                .map((item) => (
                                    <div
                                        key={item.node.id}
                                        className={`border rounded-xl p-4 transition-all duration-200 ${selectedItems.has(item.node.id)
                                                ? 'border-blue-300 bg-blue-50'
                                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            {/* Selection checkbox */}
                                            <label className="mt-1 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.has(item.node.id)}
                                                    onChange={() => toggleSelection(item.node.id)}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                            </label>

                                            {/* Node info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between mb-2">
                                                    <div>
                                                        <h3 className="font-semibold text-slate-800 mb-1">
                                                            {item.node.label || `Node ${item.node.id}`}
                                                        </h3>
                                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                                            <span className="flex items-center gap-1">
                                                                <Clock size={12} />
                                                                {formatTimestamp(item.deletedAt)}
                                                            </span>
                                                            <span>Type: {item.node.type}</span>
                                                            {item.connections.length > 0 && (
                                                                <span>{item.connections.length} connection{item.connections.length !== 1 ? 's' : ''}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 ml-4">
                                                        <button
                                                            onClick={() => onRestoreNode(item.node.id)}
                                                            className="px-3 py-1 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm flex items-center gap-1"
                                                        >
                                                            <RotateCcw size={12} />
                                                            Restore
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm('Permanently delete this node? This cannot be undone.')) {
                                                                    onPermanentlyDeleteNode(item.node.id);
                                                                }
                                                            }}
                                                            className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm flex items-center gap-1"
                                                        >
                                                            <Trash2 size={12} />
                                                            Delete Forever
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-slate-600 line-clamp-2">
                                                    {item.node.description || 'No description'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 p-4">
                    <div className="flex justify-between items-center text-sm text-slate-500">
                        <span>
                            Tip: Select multiple nodes to restore or delete them in bulk
                        </span>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeletionStoreModal;