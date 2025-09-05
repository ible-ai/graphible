// LLM response processing utilities

// State management for streaming JSON parsing
class StreamingJsonParser {
  constructor() {
    this.reset();
  }

  reset() {
    this.buffer = '';
    this.parseState = {
      inString: false,
      escaped: false,
      depth: 0,
      stringQuoteChar: null,
      position: 0
    };
    this.extractedObjects = [];
  }

  addContent(newContent) {
    if (!newContent) return { newObjects: [], remaining: this.buffer };

    this.buffer += newContent;
    return this.extractCompleteObjects();
  }

  // Extract all complete JSON objects from the current buffer
  extractCompleteObjects() {
    const newObjects = [];
    let lastExtractedEnd = 0;

    // Try to extract multiple JSON objects from the buffer
    while (lastExtractedEnd < this.buffer.length) {
      const result = this.findNextCompleteJson(lastExtractedEnd);

      if (result.found) {
        try {
          const jsonString = this.buffer.substring(result.start, result.end);
          const cleaned = this.cleanJsonString(jsonString);
          const parsed = JSON.parse(cleaned);

          // Validate the parsed object
          const validation = this.validateNodeJson(parsed);
          if (validation.valid) {
            newObjects.push(parsed);
            lastExtractedEnd = result.end;
          } else {
            console.warn('Invalid JSON structure:', validation.error);
            // Try to repair and extract anyway
            const repaired = this.repairJsonObject(parsed);
            if (repaired) {
              newObjects.push(repaired);
              lastExtractedEnd = result.end;
            } else {
              // Can't extract this object, stop trying
              break;
            }
          }
        } catch (error) {
          console.warn('JSON parse failed, attempting repair:', error.message);

          // Try to repair the JSON string
          const jsonString = this.buffer.substring(result.start, result.end);
          const repaired = this.attemptJsonRepair(jsonString);

          if (repaired) {
            newObjects.push(repaired);
            lastExtractedEnd = result.end;
          } else {
            // Can't parse this object, stop trying
            break;
          }
        }
      } else {
        // No more complete objects found
        break;
      }
    }

    // Update buffer to remove extracted content
    const remaining = this.buffer.substring(lastExtractedEnd);
    this.buffer = remaining;

    return { newObjects, remaining };
  }

  // Find the next complete JSON object in the buffer starting from position
  findNextCompleteJson(startPos = 0) {
    let pos = startPos;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let stringQuoteChar = null;
    let objectStart = -1;

    // Find the start of the next JSON object
    while (pos < this.buffer.length && objectStart === -1) {
      const char = this.buffer[pos];

      if (char === '{' && !inString) {
        objectStart = pos;
        depth = 1;
        pos++;
        break;
      }
      pos++;
    }

    if (objectStart === -1) {
      return { found: false };
    }

    // Parse until we find the complete object
    while (pos < this.buffer.length && depth > 0) {
      const char = this.buffer[pos];

      // Handle escape sequences
      if (escaped) {
        escaped = false;
        pos++;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        pos++;
        continue;
      }

      // Handle string boundaries
      if ((char === '"' || char === "'") && !escaped) {
        if (!inString) {
          inString = true;
          stringQuoteChar = char;
        } else if (char === stringQuoteChar) {
          inString = false;
          stringQuoteChar = null;
        }
      }

      // Handle braces (only when not in string)
      if (!inString) {
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
        }
      }

      pos++;
    }

    // Check if we found a complete object
    if (depth === 0) {
      return { found: true, start: objectStart, end: pos };
    }

    return { found: false };
  }

  // Clean JSON string of common artifacts
  cleanJsonString(jsonString) {
    return jsonString
      .replace(/^[^{]*/, '') // Remove everything before first {
      .replace(/[^}]*$/, '}') // Ensure it ends with }
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
      .replace(/:\s*'([^']*)'/g, ': "$1"') // Convert single quotes to double
      .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
      .trim();
  }

  // Attempt to repair malformed JSON
  attemptJsonRepair(jsonString) {
    const repairs = [
      // Basic cleaning
      (str) => this.cleanJsonString(str),

      // Add missing closing braces
      (str) => {
        const openBraces = (str.match(/\{/g) || []).length;
        const closeBraces = (str.match(/\}/g) || []).length;
        const missing = openBraces - closeBraces;
        return missing > 0 ? str + '}'.repeat(missing) : str;
      },

      // Fix unmatched quotes
      (str) => {
        const quotes = (str.match(/"/g) || []).length;
        return quotes % 2 !== 0 ? str + '"' : str;
      },

      // Remove trailing comma
      (str) => str.replace(/,(\s*})$/, '$1'),
    ];

    let repairedString = jsonString;

    for (const repair of repairs) {
      try {
        repairedString = repair(repairedString);
        const parsed = JSON.parse(repairedString);
        return this.repairJsonObject(parsed);
      } catch {
        continue;
      }
    }

    return null;
  }

  // Repair a parsed JSON object to ensure it has required fields
  repairJsonObject(obj) {
    if (!obj || typeof obj !== 'object') return null;

    const repaired = {
      label: obj.label || obj.title || obj.name || 'Generated Content',
      type: obj.type || 'concept',
      description: obj.description || obj.summary || obj.content?.substring(0, 100) || 'Generated description',
      content: obj.content || obj.text || obj.description || 'Generated content'
    };

    // Ensure type is valid
    const validTypes = ['root', 'concept', 'example', 'detail'];
    if (!validTypes.includes(repaired.type)) {
      repaired.type = 'concept';
    }

    // Ensure minimum content length
    if (repaired.description.length < 10) {
      repaired.description = `Description for ${repaired.label}`;
    }

    return repaired;
  }

  // Validate JSON structure
  validateNodeJson(jsonData) {
    if (!jsonData || typeof jsonData !== 'object') {
      return { valid: false, error: 'Not a valid JSON object' };
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
      return { valid: false, error: `Invalid type: ${jsonData.type}` };
    }

    return { valid: true };
  }
}

// Global parser instance for streaming
const globalStreamingParser = new StreamingJsonParser();

// Enhanced main extraction function
export const extractJsonFromLlmResponse = (responseString) => {
  if (!responseString || typeof responseString !== 'string') {
    return [null, responseString || ''];
  }

  // Try static extraction first for complete responses
  const staticResult = tryStaticExtraction(responseString);
  if (staticResult.success) {
    return [staticResult.data, staticResult.remainder || ''];
  }

  // Fall back to streaming parser for partial content
  const streamingResult = globalStreamingParser.addContent(responseString);

  if (streamingResult.newObjects.length > 0) {
    // Return the first new object and remaining buffer
    return [streamingResult.newObjects[0], streamingResult.remaining];
  }

  return [null, responseString];
};

// Static extraction for complete responses
function tryStaticExtraction(responseString) {
  const strategies = [
    extractFromCodeBlock,
    extractFromCompleteJson,
    extractFromBraceMatching
  ];

  for (const strategy of strategies) {
    try {
      const result = strategy(responseString);
      if (result.success && result.data) {
        const validation = globalStreamingParser.validateNodeJson(result.data);
        if (validation.valid) {
          return result;
        }
      }
    } catch (error) {
      console.log('tryStaticExtraction failed:', error);
      continue;
    }
  }

  return { success: false };
}

// Extract from markdown code blocks
function extractFromCodeBlock(responseString) {
  const patterns = [
    /```json\s*\n([\s\S]*?)\n```/g,
    /```json([\s\S]*?)```/g,
    /```\s*\n(\{[\s\S]*?\})\s*\n```/g,
    /```(\{[\s\S]*?\})```/g
  ];

  for (const pattern of patterns) {
    const match = responseString.match(pattern);
    if (match && match[1]) {
      try {
        const jsonData = JSON.parse(match[1].trim());
        const remainder = responseString.replace(match[0], '').trim();
        return { success: true, data: jsonData, remainder };
      } catch {
        continue;
      }
    }
  }

  return { success: false };
}

// Extract complete JSON objects
function extractFromCompleteJson(responseString) {
  const trimmed = responseString.trim();

  // Try parsing the entire string as JSON
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const jsonData = JSON.parse(trimmed);
      return { success: true, data: jsonData, remainder: '' };
    } catch {
      // Fall through to partial parsing
    }
  }

  return { success: false };
}

// Enhanced brace matching
function extractFromBraceMatching(responseString) {
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaped = false;
  let stringQuoteChar = null;

  for (let i = 0; i < responseString.length; i++) {
    const char = responseString[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    if ((char === '"' || char === "'") && !escaped) {
      if (!inString) {
        inString = true;
        stringQuoteChar = char;
      } else if (char === stringQuoteChar) {
        inString = false;
        stringQuoteChar = null;
      }
    }

    if (!inString) {
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
          } catch {
            // Reset and continue searching
            depth = 0;
            startIndex = -1;
          }
        }
      }
    }
  }

  return { success: false };
}

// Reset the global parser (call this when starting a new generation)
export const resetStreamingParser = () => {
  globalStreamingParser.reset();
};

// Extract multiple JSON objects from a complete response
export const extractMultipleJsonFromResponse = (responseString, maxNodes = 10) => {
  globalStreamingParser.reset();
  const result = globalStreamingParser.addContent(responseString);

  return {
    nodes: result.newObjects.slice(0, maxNodes),
    remaining: result.remaining
  };
};

// Backward compatibility for previous validation and repair functions
export const validateNodeJson = (jsonData) => {
  return globalStreamingParser.validateNodeJson(jsonData);
};

export const createFallbackNode = (rawContent, nodeId = 0) => {
  const lines = rawContent.split('\n').filter(line => line.trim());
  const firstLine = lines[0] || 'Generated Content';

  const label = firstLine.length > 50 ?
    firstLine.substring(0, 47) + '...' :
    firstLine;

  const description = lines.length > 1 ?
    lines.slice(1, 3).join(' ') :
    'Content generated from LLM response';

  return {
    label: label || `Node ${nodeId}`,
    type: nodeId === 0 ? 'root' : 'concept',
    description: description || 'Generated content',
    content: rawContent.trim() || 'No content available'
  };
};

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
