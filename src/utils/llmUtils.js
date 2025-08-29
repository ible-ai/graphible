// LLM response processing utilities

// Main JSON extraction function with improved reliability
export const extractJsonFromLlmResponse = (responseString) => {
  if (!responseString || typeof responseString !== 'string') {
    return [null, responseString || ''];
  }

  // Clean the response string first
  const cleaned = cleanResponseString(responseString);

  // Try extraction strategies in order of reliability
  const strategies = [
    extractFromCodeBlock,
    extractFromBraceMatching,
    extractFromStreamingFormat
  ];

  for (const strategy of strategies) {
    try {
      const result = strategy(cleaned);
      if (result.success && result.data) {
        // Validate the extracted JSON
        const validation = validateNodeJson(result.data);
        if (validation.valid) {
          return [result.data, result.remainder || ''];
        } else {
          console.warn('Invalid JSON structure:', validation.error);
          continue;
        }
      }
    } catch (error) {
      console.warn(`Strategy failed: ${error.message}`);
      continue;
    }
  }

  return [null, responseString];
};

// Improved response cleaning
const cleanResponseString = (responseString) => {
  return responseString
    // Remove common LLM artifacts
    .replace(/^(Here's the|Here is the|```json|```)/gm, '')
    .replace(/```\s*$/gm, '')
    // Fix common JSON formatting issues
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"') // Convert single quotes to double
    .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
    // Remove extra whitespace
    .trim();
};

// More robust code block extraction
const extractFromCodeBlock = (responseString) => {
  const patterns = [
    /```json\s*\n([\s\S]*?)\n```/g,
    /```json([\s\S]*?)```/g,
    /```\s*\n(\{[\s\S]*?\})\s*\n```/g,
    /```(\{[\s\S]*?\})```/g
  ];

  for (const pattern of patterns) {
    const match = responseString.match(pattern);
    if (match && match[1]) {
      const jsonString = match[1].trim();
      try {
        const jsonData = JSON.parse(jsonString);
        const remainder = responseString.replace(match[0], '').trim();
        return { success: true, data: jsonData, remainder };
      } catch (error) {
        console.warn('Code block JSON parse failed:', error.message);
        continue;
      }
    }
  }

  return { success: false };
};

// Improved brace matching with better error handling
const extractFromBraceMatching = (responseString) => {
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < responseString.length; i++) {
    const char = responseString[i];
    const prevChar = i > 0 ? responseString[i - 1] : '';

    // Handle string state
    if (char === '"' && !escaped) {
      inString = !inString;
    }

    // Handle escape sequences
    escaped = !escaped && prevChar === '\\';

    // Skip if we're inside a string
    if (inString) continue;

    if (char === '{') {
      if (depth === 0) startIndex = i;
      depth++;
    } else if (char === '}') {
      depth--;

      if (depth === 0 && startIndex !== -1) {
        const jsonString = responseString.substring(startIndex, i + 1);
        try {
          const jsonData = JSON.parse(jsonString);
          const remainder = responseString.substring(i + 1);
          return { success: true, data: jsonData, remainder };
        } catch (error) {
          // Reset and continue searching
          depth = 0;
          startIndex = -1;
          continue;
        }
      }
    }
  }

  return { success: false };
};

// Simplified streaming format extraction
const extractFromStreamingFormat = (responseString) => {
  const lines = responseString.split('\n').map(line => line.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip non-JSON lines
    if (!line.startsWith('{')) continue;

    // Try to parse this line as JSON
    try {
      const parsed = JSON.parse(line);
      const remainingLines = lines.slice(i + 1);
      const remainder = remainingLines.join('\n');
      return { success: true, data: parsed, remainder };
    } catch {
      // Try building multi-line JSON
      let jsonCandidate = line;
      for (let j = i + 1; j < lines.length; j++) {
        jsonCandidate += '\n' + lines[j];
        try {
          const parsed = JSON.parse(jsonCandidate);
          const remainingLines = lines.slice(j + 1);
          const remainder = remainingLines.join('\n');
          return { success: true, data: parsed, remainder };
        } catch {
          continue;
        }
      }
    }
  }

  return { success: false };
};

// Enhanced validation with more specific error messages
export const validateNodeJson = (jsonData) => {
  if (!jsonData || typeof jsonData !== 'object') {
    return { valid: false, error: 'Not a valid JSON object' };
  }

  const requiredFields = [
    { name: 'label', type: 'string', required: true },
    { name: 'type', type: 'string', required: true },
    { name: 'description', type: 'string', required: true },
    { name: 'content', type: 'string', required: true }
  ];

  const allowedTypes = ['root', 'concept', 'example', 'detail'];

  for (const field of requiredFields) {
    if (field.required && !(field.name in jsonData)) {
      return {
        valid: false,
        error: `Missing required field: ${field.name}`,
        suggestion: `Add "${field.name}": "<some value>"`
      };
    }

    if (field.name in jsonData && typeof jsonData[field.name] !== field.type) {
      return {
        valid: false,
        error: `Field ${field.name} must be a ${field.type}, got ${typeof jsonData[field.name]}`,
        suggestion: field.type === 'string' ? `Wrap value in quotes` : `Convert to ${field.type}`
      };
    }
  }

  if (!allowedTypes.includes(jsonData.type)) {
    return {
      valid: false,
      error: `Invalid type: ${jsonData.type}`,
      suggestion: `Use one of: ${allowedTypes.join(', ')}`
    };
  }

  // Additional validation for content length and structure
  if (jsonData.label && jsonData.label.length > 100) {
    return {
      valid: false,
      error: 'Label is too long (max 100 characters)',
      suggestion: 'Shorten the label to be more concise'
    };
  }

  if (jsonData.description && jsonData.description.length < 10) {
    return {
      valid: false,
      error: 'Description is too short (minimum 10 characters)',
      suggestion: 'Provide a more detailed description'
    };
  }

  return { valid: true };
};

// Improved error handling with fallback strategies
export const createFeedbackAnalysisPrompt = (userInput, isPositive) => {
  const escapedInput = userInput.replace(/"/g, '\\"');

  return `Analyze this user feedback about a learning interface node:

Feedback: "${escapedInput}"
Sentiment: ${isPositive ? 'positive' : 'negative'}

Categorize the feedback into one of these categories and extract the key concern:
- content: about the information, accuracy, depth, or educational value
- visual: about colors, layout, fonts, appearance, or visual design
- layout: about positioning, spacing, organization, or structure
- interaction: about controls, navigation, responsiveness, or user experience

Respond with ONLY this JSON format, no other text:
{"category": "category_name", "concern": "brief_description", "suggestion": "improvement_suggestion"}`;
};

// Utility to count characters safely
export function countCharacter(str, char) {
  if (!str || typeof str !== 'string' || !char) return 0;
  return (str.match(new RegExp(char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

// Enhanced debugging with better formatting
export const debugJsonParsing = (responseString) => {
  console.group('🔍 JSON Parsing Debug');

  const stats = {
    length: responseString.length,
    lines: responseString.split('\n').length,
    braces: {
      opening: countCharacter(responseString, '{'),
      closing: countCharacter(responseString, '}')
    },
    quotes: countCharacter(responseString, '"'),
    hasCodeBlock: /```(?:json)?\s*\{/.test(responseString)
  };

  console.table(stats);

  console.log('📝 First 200 chars:', responseString.substring(0, 200));
  console.log('📝 Last 200 chars:', responseString.substring(Math.max(0, responseString.length - 200)));

  // Check for common issues
  const issues = [];
  if (stats.braces.opening !== stats.braces.closing) {
    issues.push('Mismatched braces');
  }
  if (stats.quotes % 2 !== 0) {
    issues.push('Unmatched quotes');
  }
  if (responseString.includes('```json') && !responseString.includes('```', responseString.indexOf('```json') + 7)) {
    issues.push('Unclosed code block');
  }

  if (issues.length > 0) {
    console.warn('⚠️ Potential issues:', issues);
  }

  console.groupEnd();
};

// Helper to clean up common LLM response artifacts
export const cleanJsonString = (jsonString) => {
  if (!jsonString || typeof jsonString !== 'string') return '';

  return jsonString
    // Remove markdown artifacts
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    // Remove common LLM prefixes
    .replace(/^(?:Here's|Here is|The JSON is|Response:)\s*/i, '')
    // Fix common JSON formatting issues
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"') // Convert single quotes to double
    .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
    .replace(/\n\s*\n/g, '\n') // Collapse multiple newlines
    .trim();
};

// Advanced JSON repair function for malformed JSON
export const repairJsonString = (jsonString) => {
  let repaired = cleanJsonString(jsonString);

  try {
    // First, try parsing as-is
    JSON.parse(repaired);
    return repaired;
  } catch (error) {
    console.warn('Initial JSON parse failed, attempting repair:', error.message);
  }

  // Common repair strategies
  const repairs = [
    // Add missing closing braces
    (str) => {
      const openBraces = countCharacter(str, '{');
      const closeBraces = countCharacter(str, '}');
      const missing = openBraces - closeBraces;
      return missing > 0 ? str + '}'.repeat(missing) : str;
    },

    // Add missing closing brackets
    (str) => {
      const openBrackets = countCharacter(str, '[');
      const closeBrackets = countCharacter(str, ']');
      const missing = openBrackets - closeBrackets;
      return missing > 0 ? str + ']'.repeat(missing) : str;
    },

    // Fix unmatched quotes
    (str) => {
      const quotes = countCharacter(str, '"');
      return quotes % 2 !== 0 ? str + '"' : str;
    },

    // Remove trailing comma before closing brace/bracket
    (str) => str.replace(/,(\s*[}\]])/g, '$1'),

    // Add missing commas between object properties
    (str) => str.replace(/"\s*\n\s*"/g, '",\n"'),

    // Fix single quotes around property names
    (str) => str.replace(/'(\w+)':/g, '"$1":')
  ];

  for (const repair of repairs) {
    try {
      const attempted = repair(repaired);
      JSON.parse(attempted);
      repaired = attempted;
    } catch {
      // This repair didn't work, try the next one
      continue;
    }
  }

  return repaired;
};

// Fallback node creator for when JSON parsing completely fails
export const createFallbackNode = (rawContent, nodeId = 0) => {
  // Try to extract meaningful content from the raw response
  const lines = rawContent.split('\n').filter(line => line.trim());
  const firstLine = lines[0] || 'Generated Content';

  // Simple heuristics to create a reasonable node
  const label = firstLine.length > 50 ?
    firstLine.substring(0, 47) + '...' :
    firstLine;

  const description = lines.length > 1 ?
    lines.slice(1, 3).join(' ') :
    'Content generated from LLM response';

  const content = rawContent.trim();

  return {
    label: label || `Node ${nodeId}`,
    type: nodeId === 0 ? 'root' : 'concept',
    description: description || 'Generated content',
    content: content || 'No content available'
  };
};

// Batch JSON extraction for processing multiple JSON objects in one response
export const extractMultipleJsonFromResponse = (responseString, maxNodes = 10) => {
  const results = [];
  let remaining = responseString;
  let attempts = 0;

  while (remaining && attempts < maxNodes) {
    const [jsonData, newRemaining] = extractJsonFromLlmResponse(remaining);

    if (jsonData) {
      results.push(jsonData);
      remaining = newRemaining;
    } else {
      // No more valid JSON found
      break;
    }

    attempts++;
  }

  return { nodes: results, remaining };
};

// Enhanced error reporting for debugging
export const createJsonParsingReport = (originalString, attempts = []) => {
  const report = {
    timestamp: new Date().toISOString(),
    originalLength: originalString.length,
    attempts: attempts.length,
    successful: false,
    finalResult: null,
    errors: [],
    suggestions: []
  };

  attempts.forEach((attempt, index) => {
    try {
      const parsed = JSON.parse(attempt.content);
      report.successful = true;
      report.finalResult = parsed;
    } catch (error) {
      report.errors.push({
        attempt: index + 1,
        strategy: attempt.strategy,
        error: error.message,
        content: attempt.content.substring(0, 100) + '...'
      });
    }
  });

  // Generate suggestions based on common errors
  if (!report.successful) {
    const commonErrors = report.errors.map(e => e.error);

    if (commonErrors.some(e => e.includes('Unexpected token'))) {
      report.suggestions.push('Check for unescaped characters or malformed JSON structure');
    }

    if (commonErrors.some(e => e.includes('Unexpected end'))) {
      report.suggestions.push('JSON appears to be truncated - check for incomplete response');
    }

    if (commonErrors.some(e => e.includes('property name'))) {
      report.suggestions.push('Check for unquoted property names or invalid property syntax');
    }
  }

  return report;
};

// Utility for testing different extraction strategies
export const testExtractionStrategies = (responseString) => {
  const strategies = [
    { name: 'CodeBlock', fn: extractFromCodeBlock },
    { name: 'BraceMatching', fn: extractFromBraceMatching },
    { name: 'StreamingFormat', fn: extractFromStreamingFormat }
  ];

  const results = [];

  strategies.forEach(strategy => {
    try {
      const result = strategy.fn(responseString);
      results.push({
        strategy: strategy.name,
        success: result.success,
        data: result.success ? result.data : null,
        error: result.success ? null : 'No valid JSON found'
      });
    } catch (error) {
      results.push({
        strategy: strategy.name,
        success: false,
        data: null,
        error: error.message
      });
    }
  });

  return results;
};