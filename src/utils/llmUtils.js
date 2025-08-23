// LLM response processing utilities

export const extractJsonFromLlmResponse = (responseString) => {
  const jsonRegex = /```json([\s\S]*?)```/;
  const match = responseString.match(jsonRegex);

  if (match && match[1]) {
    try {
      const jsonData = JSON.parse(match[1]);
      const remainderString = responseString.replace(match[0], '');
      return [jsonData, remainderString];
    } catch (error) {
      console.log("Failed to extract Json from LLM response", error);
      return [null, responseString];
    }
  }

  const firstBraceIndex = responseString.indexOf('{');
  const lastBraceIndex = responseString.lastIndexOf('}');

  if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
    try {
      const jsonString = responseString.substring(firstBraceIndex, lastBraceIndex + 1);
      const jsonData = JSON.parse(jsonString);
      const remainderString = responseString.substring(lastBraceIndex + 1);
      return [jsonData, remainderString];
    } catch (error) {
      console.log("Failed to extract Json from LLM response", error);
      return [null, responseString];
    }
  }

  return [null, responseString];
};

export function countCharacter(str, char) {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char) {
      count++;
    }
  }
  return count;
}

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