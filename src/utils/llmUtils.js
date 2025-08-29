// LLM response processing utilities


// Robust JSON extraction that handles multiple formats and edge cases
export const extractJsonFromLlmResponse = (responseString) => {
  if (!responseString || typeof responseString !== 'string') {
    return [null, responseString || ''];
  }

  // Strategy 1: Try to extract from markdown code blocks first
  const result1 = extractFromCodeBlock(responseString);
  if (result1.success) {
    return [result1.data, result1.remainder];
  }

  // Strategy 2: Try to find complete JSON objects by brace matching
  const result2 = extractByBraceMatching(responseString);
  if (result2.success) {
    return [result2.data, result2.remainder];
  }

  // Strategy 3: Try line-by-line parsing for streaming responses
  const result3 = extractFromStreamingFormat(responseString);
  if (result3.success) {
    return [result3.data, result3.remainder];
  }

  // No valid JSON found
  return [null, responseString];
};


//Extract JSON from markdown code blocks (```json ... ```)
const extractFromCodeBlock = (responseString) => {
  // Support both ```json and ``` formats
  const patterns = [
    /```json\s*\n([\s\S]*?)\n```/g,
    /```\s*\n(\{[\s\S]*?\})\s*\n```/g,
    /```json([\s\S]*?)```/g,
    /```(\{[\s\S]*?\})```/g
  ];

  for (const pattern of patterns) {
    const match = responseString.match(pattern);
    if (match && match[1]) {
      try {
        const jsonData = JSON.parse(match[1].trim());
        const remainder = responseString.replace(match[0], '').trim();
        return { success: true, data: jsonData, remainder };
      } catch (error) {
        // Continue to next pattern
        console.warn('Failed to parse JSON from code block:', error.message);
      }
    }
  }

  return { success: false };
};


// Extract JSON by matching braces and finding complete objects
const extractByBraceMatching = (responseString) => {
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let startIndex = -1;

  for (let i = 0; i < responseString.length; i++) {
    const char = responseString[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      if (braceCount === 0) {
        startIndex = i;
      }
      braceCount++;
    } else if (char === '}') {
      braceCount--;

      if (braceCount === 0 && startIndex !== -1) {
        // Found a complete JSON object
        const jsonString = responseString.substring(startIndex, i + 1);
        try {
          const jsonData = JSON.parse(jsonString);
          const remainder = responseString.substring(i + 1);
          return { success: true, data: jsonData, remainder };
        } catch (error) {
          console.warn('Failed to parse JSON by brace matching:', error.message);
          // Reset and continue looking
          braceCount = 0;
          startIndex = -1;
        }
      }
    }
  }

  return { success: false };
};


// Handle streaming format where JSON might be split across chunks
const extractFromStreamingFormat = (responseString) => {
  const lines = responseString.split('\n');
  let jsonBuffer = '';
  let foundJson = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and common prefixes
    if (!line || line.startsWith('data:') || line === 'event:') {
      continue;
    }

    // Try to parse current buffer + line
    const candidate = (jsonBuffer + line).trim();

    if (candidate.startsWith('{')) {
      try {
        const parsed = JSON.parse(candidate);
        const remainingLines = lines.slice(i + 1);
        const remainder = remainingLines.join('\n');
        return { success: true, data: parsed, remainder };
      } catch {
        // Not complete yet, keep building
        jsonBuffer = candidate;
        foundJson = true;
      }
    } else if (foundJson) {
      // We're in the middle of building a JSON object
      jsonBuffer += line;
    }
  }

  return { success: false };
};


export function countCharacter(str, char) {
  if (!str || typeof str !== 'string' || !char) return 0;

  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char) count++;
  }
  return count;
}


// Validate JSON structure for expected node format
export const validateNodeJson = (jsonData) => {
  if (!jsonData || typeof jsonData !== 'object') {
    return { valid: false, error: 'Invalid JSON object' };
  }

  const requiredFields = ['label', 'type', 'description', 'content'];
  const allowedTypes = ['root', 'concept', 'example', 'detail'];

  for (const field of requiredFields) {
    if (!(field in jsonData)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
    if (typeof jsonData[field] !== 'string') {
      return { valid: false, error: `Field ${field} must be a string` };
    }
  }

  if (!allowedTypes.includes(jsonData.type)) {
    return { valid: false, error: `Invalid type: ${jsonData.type}. Must be one of: ${allowedTypes.join(', ')}` };
  }

  return { valid: true };
};

export const cleanJsonString = (jsonString) => {
  if (!jsonString || typeof jsonString !== 'string') return '';

  return jsonString
    // Remove common formatting issues
    .replace(/^\s*```json\s*/i, '')
    .replace(/\s*```\s*$/, '')
    // Fix common JSON issues
    .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"') // Convert single quotes to double
    // Remove trailing commas
    .replace(/,(\s*[}\]])/g, '$1')
    .trim();
};


export const createFeedbackAnalysisPrompt = (userInput, isPositive) => {
  return `Analyze this user feedback about a learning interface node:
    Feedback: "${userInput}"
    Sentiment: ${isPositive ? 'positive' : 'negative'}

    Categorize the feedback into one of these categories and extract the key concern:
    - content: about the information, accuracy, depth, or educational value
    - visual: about colors, layout, fonts, appearance, or visual design
    - layout: about positioning, spacing, organization, or structure
    - interaction: about controls, navigation, responsiveness, or user experience

    Respond with JSON: {"category": "category_name", "concern": "brief_description", "suggestion": "improvement_suggestion"}`;
};

// Debug helper to analyze problematic JSON strings
export const debugJsonParsing = (responseString) => {
  console.group('JSON Parsing Debug');
  console.log('Input length:', responseString.length);
  console.log('First 100 chars:', responseString.substring(0, 100));
  console.log('Last 100 chars:', responseString.substring(Math.max(0, responseString.length - 100)));
  console.log('Brace counts:', {
    opening: countCharacter(responseString, '{'),
    closing: countCharacter(responseString, '}')
  });

  const codeBlockMatch = responseString.match(/```json([\s\S]*?)```/);
  if (codeBlockMatch) {
    console.log('Found code block:', codeBlockMatch[1].substring(0, 50) + '...');
  }

  console.groupEnd();
};