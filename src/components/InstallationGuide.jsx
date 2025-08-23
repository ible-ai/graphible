import { useState } from 'react';
import { X, Package, Terminal, Key, ExternalLink, Copy, Check } from 'lucide-react';

const InstallationGuide = ({ showGuide, onClose }) => {
  const [copiedText, setCopiedText] = useState('');

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(''), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  if (!showGuide) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-600 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Setup Guide</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Local Setup */}
          <section>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Terminal className="text-blue-400" size={20} />
              Local Model Setup (Ollama)
            </h3>

            <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="text-white font-medium mb-2">1. Install Ollama</h4>
                  <p className="text-gray-300 text-sm mb-2">
                    Download and install Ollama from the official website:
                  </p>
                  <a
                    href="https://ollama.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <ExternalLink size={16} />
                    ollama.ai
                  </a>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">2. Start Ollama Server</h4>
                  <div className="flex items-center gap-2 bg-gray-900 p-3 rounded font-mono text-sm">
                    <code className="text-green-400 flex-1">OLLAMA_ORIGINS=* ollama serve</code>
                    <button
                      onClick={() => copyToClipboard('OLLAMA_ORIGINS=* ollama serve', 'ollama-serve')}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Copy command"
                    >
                      {copiedText === 'ollama-serve' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">3. Pull a Model</h4>
                  <div className="space-y-2">
                    {[
                      { cmd: 'ollama pull gemma2:2b', desc: 'Lightweight (1.6GB)' },
                      { cmd: 'ollama pull gemma3:4b', desc: 'Recommended (2.5GB)' },
                      { cmd: 'ollama pull llama3.2:3b', desc: 'Alternative (2GB)' }
                    ].map((model, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-900 p-3 rounded">
                        <code className="text-green-400 flex-1 font-mono text-sm">{model.cmd}</code>
                        <span className="text-gray-400 text-xs">{model.desc}</span>
                        <button
                          onClick={() => copyToClipboard(model.cmd, `model-${idx}`)}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          {copiedText === `model-${idx}` ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* External API Setup */}
          <section>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Key className="text-purple-400" size={20} />
              External API Setup (Google AI)
            </h3>

            <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="text-white font-medium mb-2">1. Install Google Generative AI SDK</h4>
                  <p className="text-gray-300 text-sm mb-2">
                    Install the official Google AI SDK for JavaScript:
                  </p>
                  <div className="flex items-center gap-2 bg-gray-900 p-3 rounded font-mono text-sm">
                    <code className="text-green-400 flex-1">npm install @google/genai</code>
                    <button
                      onClick={() => copyToClipboard('npm install @google/genai', 'npm-install')}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {copiedText === 'npm-install' ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <div className="mt-2 p-3 bg-gray-900 rounded">
                    <p className="text-gray-400 text-xs mb-2">Example usage:</p>
                    <code className="text-green-400 text-xs block">
                      {`const ai = new GoogleGenAI(apiKey);
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: "Your prompt here"
});`}
                    </code>
                  </div>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">2. Get API Key</h4>
                  <div className="space-y-2">
                    <p className="text-gray-300 text-sm">
                      Get your free API key from Google AI Studio:
                    </p>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <ExternalLink size={16} />
                      aistudio.google.com/app/apikey
                    </a>
                  </div>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">3. Available Models</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        name: 'Gemini 2.5 Flash Lite',
                        id: 'gemini-2.5-flash-lite',
                        desc: 'Fast, lightweight responses',
                        tokens: '2K tokens'
                      },
                      {
                        name: 'Gemini 2.5 Flash',
                        id: 'gemini-2.5-flash',
                        desc: 'Balanced performance',
                        tokens: '8K tokens'
                      },
                      {
                        name: 'Gemini 2.5 Pro',
                        id: 'gemini-2.5-pro',
                        desc: 'Maximum capability',
                        tokens: '32K tokens'
                      }
                    ].map((model, idx) => (
                      <div key={idx} className="bg-gray-900 p-4 rounded border border-gray-700">
                        <h5 className="text-purple-400 font-medium text-sm">{model.name}</h5>
                        <p className="text-gray-400 text-xs mt-1">{model.desc}</p>
                        <p className="text-gray-500 text-xs mt-2">{model.tokens}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Troubleshooting */}
          <section>
            <h3 className="text-xl font-semibold text-white mb-4">Troubleshooting</h3>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="space-y-4">
                <div>
                  <h4 className="text-red-400 font-medium mb-2">Local Connection Issues</h4>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Ensure Ollama is running with CORS enabled</li>
                    <li>• Check if the model is downloaded</li>
                    <li>• Verify the server address in settings</li>
                    <li>• Try restarting Ollama service</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-red-400 font-medium mb-2">API Connection Issues</h4>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Verify your API key is correct</li>
                    <li>• Check internet connection</li>
                    <li>• Ensure selected model is available</li>
                    <li>• Check for rate limit restrictions</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Got it, let's start!
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallationGuide;