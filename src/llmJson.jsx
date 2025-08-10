const extractJsonFromLlmResponse = (responseString) => {
    const jsonRegex = /```json([\s\S]*?)```/;
    const match = responseString.match(jsonRegex);

    if (match && match[1]) {
      try {
        const jsonData = JSON.parse(match[1]);
        const remainderString = responseString.replace(match[0], '');
        return [jsonData, remainderString];
      } catch (e) {
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
      } catch (e) {
        return [null, responseString];
      }
    }

    return [null, responseString];
  };

  export default extractJsonFromLlmResponse;