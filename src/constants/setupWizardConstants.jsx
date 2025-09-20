// Shared types, constants, and configurations for the Setup Wizard

export const SETUP_STEPS = {
    WELCOME: 'welcome',
    CHOICE: 'choice',
    SETUP: 'setup',
    TESTING: 'testing',
    SUCCESS: 'success',
};

export const SETUP_STEPS_TITLES = {
    [SETUP_STEPS.WELCOME]: 'Welcome to graph.ible',
    [SETUP_STEPS.CHOICE]: 'How would you like to get started?',
    [SETUP_STEPS.SETUP]: 'Quick Setup',
    [SETUP_STEPS.TESTING]: 'Testing...',
    [SETUP_STEPS.SUCCESS]: 'Get ready to explore!'
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
    WEBLLM: 'webllm',
    DEMO: 'demo'
};

export const DEMO_GRAPH_DATA = {
    name: "Understanding Neural Networks",
    nodes: [
        {
            id: 0,
            label: "Neural Networks Overview",
            type: "root",
            description: "A comprehensive introduction to neural networks and their applications in modern AI",
            content: "Neural networks are computational models inspired by biological neural networks. They consist of interconnected nodes (neurons) that process information through weighted connections and activation functions.\n\n**Key Components:**\n- Input layer: Receives data\n- Hidden layers: Process information\n- Output layer: Produces results\n- Weights and biases: Control signal strength\n\n**Applications:**\n- Image recognition\n- Natural language processing\n- Predictive analytics\n- Autonomous systems",
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
            content: "A neural network consists of multiple layers of interconnected nodes:\n\n**Layer Types:**\n- **Input layer**: Receives raw data\n- **Hidden layers**: Process and transform information\n- **Output layer**: Produces final results\n\n**Connections:**\n- Each connection has a weight\n- Weights determine signal strength\n- Biases provide additional flexibility\n\n**Information Flow:**\nData flows forward through the network, with each layer transforming the information before passing it to the next layer.",
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
            content: "Activation functions introduce non-linearity to neural networks:\n\n**Common Functions:**\n- **ReLU**: $f(x) = \\max(0, x)$ - Most popular, simple and effective\n- **Sigmoid**: $f(x) = \\frac{1}{1+e^{-x}}$ - Outputs between 0 and 1\n- **Tanh**: $f(x) = \\frac{e^x - e^{-x}}{e^x + e^{-x}}$ - Outputs between -1 and 1\n- **Softmax**: $f(x_i) = \\frac{e^{x_i}}{\\sum_{j} e^{x_j}}$ - For probability distributions\n\n**Why Non-linearity Matters:**\nWithout activation functions, neural networks would just be linear transformations, limiting their ability to learn complex patterns.",
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
            content: "Training involves iterative improvement through these steps:\n\n**1. Forward Pass:**\n- Data flows through the network\n- Each layer transforms the input\n- Final prediction is generated\n\n**2. Loss Calculation:**\n- Compare prediction to actual target\n- Calculate error using loss function\n- Common losses: Mean Squared Error, Cross-entropy\n\n**3. Backpropagation:**\n- Calculate gradients for each weight\n- Work backwards through the network\n- Use chain rule to propagate errors\n\n**4. Weight Updates:**\n- Adjust weights using gradient descent\n- Learning rate controls step size\n- Repeat until convergence\n\n**Key Insight:** The network learns by minimizing prediction errors across many examples.",
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
        title: "Welcome to graph.ible",
        subtitle: "Turn conversations into knowledge graphs",
        description: "graph.ible helps you explore ideas by creating visual, interactive knowledge maps from AI conversations."
    },
    CHOICE: {
        title: "Choose your AI source",
        subtitle: "Pick the option that works best for you",
        description: "We support multiple ways to run AI - from completely private browser-based models to powerful cloud services."
    },
    SETUP: {
        title: "Quick Setup",
        subtitle: "Just a few more steps",
        description: "We'll get your chosen AI source configured and ready to use."
    },
    TESTING: {
        title: "Testing connection",
        subtitle: "Making sure everything works",
        description: "We're testing your AI connection to ensure smooth operation."
    },
    SUCCESS: {
        title: "You're all set!",
        subtitle: "Your AI is connected and ready",
        description: "Start exploring ideas by typing any topic you're curious about."
    }
};

export const WEBLLM_MODELS = {
    'Llama-3.2-3B-Instruct-q4f32_1-MLC': {
        name: 'Llama 3.2 3B',
        description: 'Balanced performance and size, optimized for web browsers',
        size: '~2GB',
        recommended: true
    }
};


export const GOOGLE_AI_MODELS = [
    {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        description: 'Fast and efficient for most tasks',
        recommendation: 'Recommended',
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Balanced performance and capability',
        recommendation: null,
    },
    {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Maximum capability for complex tasks',
        recommendation: null,
    }
];

export const PRIVACY_NOTICE = {
    title: "Privacy & Security",
    points: [
        "Browser AI runs completely offline on your device",
        "API keys are stored locally in your browser only",
        "No data is sent to our servers",
        "You can clear your data anytime in settings"
    ]
};

export const TROUBLESHOOTING_TIPS = {
    browser: [
        "Ensure you're using Chrome 113+, Firefox 141+, or Safari 26+",
        "Allow the browser to download the AI model (2GB)",
        "Make sure you have enough storage space available",
        "Try refreshing the page if the download gets stuck"
    ],
    local: [
        "Ensure Ollama is installed and running",
        "Check that CORS is enabled: OLLAMA_ORIGINS=*",
        "Verify a model is downloaded with 'ollama list'",
        "Try restarting the Ollama service"
    ],
    cloud: [
        "Verify your API key is correct and active",
        "Check your internet connection",
        "Ensure you haven't exceeded API rate limits",
        "Try generating a new API key if issues persist"
    ],
};