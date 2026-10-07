// Component for managing node connections
import { useState } from 'react';
import { Link, X, Zap, Trash2 } from 'lucide-react';

const ConnectionManager = ({
    isOpen,
    onClose,
    nodes,
    connections,
    onAddConnection,
    onRemoveConnection
}) => {
    const [connectionMode, setConnectionMode] = useState('add'); // 'add' or 'remove'
    const [selectedFromNode, setSelectedFromNode] = useState(null);

    if (!isOpen) return null;

    const handleNodeClick = (nodeId) => {
        if (connectionMode === 'add') {
            if (selectedFromNode === null) {
                setSelectedFromNode(nodeId);
            } else if (selectedFromNode !== nodeId) {
                onAddConnection(selectedFromNode, nodeId);
                setSelectedFromNode(null);
            } else {
                setSelectedFromNode(null); // Deselect if clicking same node
            }
        }
    };

    const handleConnectionRemove = (fromId, toId) => {
        onRemoveConnection(fromId, toId);
    };

    const reset = () => {
        setSelectedFromNode(null);
        setConnectionMode('add');
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] font-inter">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/15 rounded-lg flex items-center justify-center">
                            <Link className="text-blue-600 dark:text-blue-400" size={16} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-800 dark:text-neutral-100">Manage Connections</h2>
                            <p className="text-sm text-slate-600 dark:text-neutral-300">
                                Add or remove connections between nodes
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Mode selector */}
                <div className="p-4 bg-slate-50 dark:bg-neutral-800/50 border-b border-slate-200 dark:border-neutral-800">
                    <div className="flex items-center gap-4">
                        <div className="flex bg-white dark:bg-neutral-900 rounded-lg p-1 border border-slate-200 dark:border-neutral-800">
                            <button
                                onClick={() => {
                                    setConnectionMode('add');
                                    reset();
                                }}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${connectionMode === 'add'
                                        ? 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300'
                                        : 'text-slate-600 dark:text-neutral-300 hover:text-slate-800 dark:hover:text-neutral-100'
                                    }`}
                            >
                                <Zap size={14} />
                                Add Connections
                            </button>
                            <button
                                onClick={() => {
                                    setConnectionMode('remove');
                                    reset();
                                }}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${connectionMode === 'remove'
                                        ? 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-300'
                                        : 'text-slate-600 dark:text-neutral-300 hover:text-slate-800 dark:hover:text-neutral-100'
                                    }`}
                            >
                                <Trash2 size={14} />
                                Remove Connections
                            </button>
                        </div>

                        {connectionMode === 'add' && selectedFromNode !== null && (
                            <div className="text-sm text-slate-600 dark:text-neutral-300 bg-blue-50 dark:bg-blue-500/10 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-500/30">
                                Selected: {nodes.find(n => n.id === selectedFromNode)?.label} → Click target node
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex h-[60vh]">
                    {/* Nodes panel */}
                    <div className="w-1/2 border-r border-slate-200 dark:border-neutral-800">
                        <div className="p-4 border-b border-slate-200 dark:border-neutral-800">
                            <h3 className="font-semibold text-slate-800 dark:text-neutral-100">Nodes</h3>
                            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                                {connectionMode === 'add'
                                    ? 'Click first node, then click target node to connect'
                                    : 'View existing connections on the right'
                                }
                            </p>
                        </div>
                        <div className="p-4 overflow-y-auto h-full">
                            <div className="space-y-2">
                                {nodes.map((node) => (
                                    <div
                                        key={node.id}
                                        onClick={() => handleNodeClick(node.id)}
                                        className={`p-3 border rounded-lg cursor-pointer transition-all duration-200 ${selectedFromNode === node.id
                                                ? 'border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10'
                                                : 'border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800'
                                            }`}
                                    >
                                        <div className="font-medium text-sm text-slate-800 dark:text-neutral-100">
                                            {node.label || `Node ${node.id}`}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-neutral-400 mt-1 line-clamp-1">
                                            {node.description || 'No description'}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${node.type === 'root'
                                                    ? 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300'
                                                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'
                                                }`}>
                                                {node.type}
                                            </span>
                                            <span className="text-xs text-slate-400 dark:text-neutral-500">
                                                ID: {node.id}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Connections panel */}
                    <div className="w-1/2">
                        <div className="p-4 border-b border-slate-200 dark:border-neutral-800">
                            <h3 className="font-semibold text-slate-800 dark:text-neutral-100">
                                Current Connections ({connections.length})
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                                Existing connections between nodes
                            </p>
                        </div>
                        <div className="p-4 overflow-y-auto h-full">
                            {connections.length === 0 ? (
                                <div className="text-center py-8">
                                    <Link className="mx-auto text-slate-300 dark:text-neutral-600 mb-2" size={32} />
                                    <p className="text-slate-500 dark:text-neutral-400 text-sm">No connections yet</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {connections.map((conn, index) => {
                                        const fromNode = nodes.find(n => n.id === conn.from);
                                        const toNode = nodes.find(n => n.id === conn.to);

                                        if (!fromNode || !toNode) return null;

                                        return (
                                            <div
                                                key={index}
                                                className="p-3 border border-slate-200 dark:border-neutral-800 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className="font-medium text-slate-800 dark:text-neutral-100 truncate">
                                                                {fromNode.label || `Node ${fromNode.id}`}
                                                            </span>
                                                            <span className="text-slate-400 dark:text-neutral-500">→</span>
                                                            <span className="font-medium text-slate-800 dark:text-neutral-100 truncate">
                                                                {toNode.label || `Node ${toNode.id}`}
                                                            </span>
                                                        </div>
                                                        <div className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                                                            {fromNode.id} → {toNode.id}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleConnectionRemove(conn.from, conn.to)}
                                                        className="ml-2 p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                                                        title="Remove connection"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 dark:border-neutral-800 p-4">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-slate-500 dark:text-neutral-400">
                            {connectionMode === 'add'
                                ? 'Tip: Click two nodes in sequence to create a connection'
                                : 'Tip: Click the X button next to any connection to remove it'
                            }
                        </div>
                        <button
                            onClick={() => {
                                reset();
                                onClose();
                            }}
                            className="px-4 py-2 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 rounded-lg hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConnectionManager;