// Shared types, constants, and configurations for the Setup Wizard

export const SETUP_STEPS = {
    WELCOME: 'welcome',
    DETECTION: 'detection',
    MODEL_CHOICE: 'model_choice',
    LOCAL_SETUP: 'local_setup',
    API_SETUP: 'api_setup',
    TESTING: 'testing',
    SUCCESS: 'success',
    DEMO_MODE: 'demo_mode'
};

export const CONNECTION_STATUS = {
    IDLE: 'idle',
    DETECTING: 'detecting',
    TESTING: 'testing',
    SUCCESS: 'success',
    ERROR: 'error',
    PARTIAL: 'partial'
};

export const MODEL_TYPES = {
    LOCAL: 'local',
    EXTERNAL: 'external',
    DEMO: 'demo'
};

export const SETUP_THEMES = {
    GRADIENT: {
        primary: 'from-indigo-600 to-purple-600',
        secondary: 'from-indigo-50 to-purple-50',
        accent: 'text-indigo-600',
        success: 'from-emerald-500 to-teal-500',
        error: 'from-rose-500 to-red-500',
        warning: 'from-amber-500 to-orange-500'
    }
};

export const DEMO_GRAPH_DATA = {
    name: "Understanding Neural Networks",
    nodes: [
        {
            id: 0,
            label: "Neural Networks Overview",
            type: "root",
            description: "A comprehensive introduction to neural networks and their applications in modern AI",
            content: "Neural networks are computational models inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information through weighted connections and activation functions.",
            worldX: 0,
            worldY: 0,
            batchId: 0,
            width: 320,
            createdAt: Date.now()
        },
        {
            id: 1,
            label: "Basic Architecture",
            type: "concept",
            description: "Understanding the fundamental structure of neural networks including layers, nodes, and connections",
            content: "A neural network consists of:\n* Input layer: Receives data\n* Hidden layers: Process information\n* Output layer: Produces results\n* Weights and biases: Control signal strength",
            worldX: 300,
            worldY: -150,
            batchId: 0,
            width: 280,
            createdAt: Date.now()
        },
        {
            id: 2,
            label: "Activation Functions",
            type: "concept",
            description: "How neurons decide whether to activate based on input signals",
            content: `Activation functions introduce non-linearity:\n* ReLU: $max(0, x)$\n* Sigmoid: $1/(1+e^{-x})$\n* Tanh: $(e^x - e^{-x})/(e^x + e^{-x})$\n* Softmax: For probability distributions`,
            worldX: 300,
            worldY: 150,
            batchId: 0,
            width: 280,
            createdAt: Date.now()
        },
        {
            id: 3,
            label: "Training Process",
            type: "detail",
            description: "How neural networks learn through backpropagation and gradient descent",
            content: "Training involves:\n1. Forward pass: Data flows through network\n2. Loss calculation: Compare output to target\n3. Backpropagation: Calculate gradients\n4. Weight updates: Adjust parameters\n5. Repeat until convergence",
            worldX: 600,
            worldY: 0,
            batchId: 0,
            width: 280,
            createdAt: Date.now()
        }
    ],
    connections: [
        { from: 0, to: 1 },
        { from: 0, to: 2 },
        { from: 1, to: 3 },
        { from: 2, to: 3 }
    ],
    currentNodeId: 0
};

export const SETUP_MESSAGES = {
    WELCOME: {
        title: "Welcome to Graphible",
        subtitle: "Let's get you set up with an AI model",
        description: "Graphible transforms AI conversations into interactive knowledge graphs. We'll help you connect to an AI model in just a few steps."
    },
    DETECTION: {
        title: "Detecting Available Models",
        subtitle: "Checking what's already available",
        description: "We're scanning for local models and testing API connectivity..."
    },
    LOCAL_SETUP: {
        title: "Local Model Setup",
        subtitle: "Run AI models privately on your machine",
        description: "Local models provide privacy and unlimited usage, but require initial setup."
    },
    API_SETUP: {
        title: "Cloud AI Setup",
    },
    SUCCESS: {
        title: "You're All Set!",
        subtitle: "Your AI model is connected and ready",
        description: "Time to start exploring ideas with your new graph-based AI interface."
    },
    DEMO_MODE: {
        title: "Try the Demo",
        subtitle: "Explore Graphible with pre-loaded content",
        description: "Get a feel for the interface before setting up your own AI model."
    }
};

export const OLLAMA_INSTRUCTIONS = [
    {
        id: 'install',
        title: 'Install Ollama',
        description: 'Download and install Ollama from the official website',
        action: 'Visit ollama.ai',
        url: 'https://ollama.ai',
        icon: 'download'
    },
    {
        id: 'start',
        title: 'Start Ollama Server',
        description: 'Run Ollama with CORS enabled for web access',
        action: 'Copy command',
        command: 'OLLAMA_ORIGINS=* ollama serve',
        icon: 'terminal'
    },
    {
        id: 'model',
        title: 'Download a Model',
        description: 'Pull a model to get started (gemma2:4b recommended)',
        action: 'Copy command',
        command: 'ollama pull gemma2:4b',
        icon: 'download'
    }
];

export const GOOGLE_AI_MODELS = [
    {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        description: 'Fast and efficient for most tasks',
        recommendation: 'Recommended for beginners',
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Balanced performance and capability',
        recommendation: 'Best for most users',
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Maximum capability for complex tasks',
        recommendation: 'For advanced usage',
    }
];

export const PRIVACY_NOTICE = {
    title: "Privacy & Security",
    points: [
        "Your API key is stored locally in your browser",
        "Keys are never sent to our servers",
        "All AI conversations happen directly with your chosen provider",
        "You can clear your key anytime in settings"
    ]
};

export const TROUBLESHOOTING_TIPS = {
    local: [
        "Ensure Ollama is installed and running",
        "Check that CORS is enabled with OLLAMA_ORIGINS=*",
        "Verify a model is downloaded with 'ollama list'",
        "Try restarting the Ollama service"
    ],
    external: [
        "Verify your API key is correct",
        "Check your internet connection",
        "Ensure the selected model is available",
        "Check for any rate limiting"
    ]
};