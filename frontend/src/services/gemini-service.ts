// Google Gemini Vision API Service for Image Verification

export interface ImageVerificationResult {
  isValid: boolean;
  confidence: number;
  labels: string[];
  reason: string;
  details?: {
    safetyScores?: Record<string, string>;
    objects?: string[];
    text?: string;
  };
}

export interface GeminiConfig {
  apiKey: string;
  model?: string;
}

// Default configuration - API key should be in .env
const DEFAULT_CONFIG: GeminiConfig = {
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  model: 'gemini-1.5-flash',
};

// Mock verification for development (when API key not available)
export async function mockVerifyImage(imageBase64: string): Promise<ImageVerificationResult> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Extract some basic info from the image (in real scenario, this would be done by Gemini)
  const mockLabels = [
    'Flood', 'Fire', 'Earthquake', 'Accident', 'Medical Emergency',
    'Building Collapse', 'Road Blockage', 'Power Outage', 'Water Shortage',
    'Crowd', 'Vehicle', 'Building', 'Nature', 'People', 'Damage'
  ];

  // Randomly select 3-6 labels
  const numLabels = Math.floor(Math.random() * 4) + 3;
  const selectedLabels: string[] = [];
  for (let i = 0; i < numLabels; i++) {
    const label = mockLabels[Math.floor(Math.random() * mockLabels.length)];
    if (!selectedLabels.includes(label)) {
      selectedLabels.push(label);
    }
  }

  // Determine if image is valid based on emergency-related labels
  const emergencyLabels = ['Flood', 'Fire', 'Earthquake', 'Accident', 'Medical Emergency', 
    'Building Collapse', 'Road Blockage', 'Power Outage', 'Water Shortage', 'Damage'];
  
  const hasEmergencyContent = selectedLabels.some(label => emergencyLabels.includes(label));
  const confidence = Math.floor(Math.random() * 30) + 70; // 70-99%

  if (hasEmergencyContent) {
    return {
      isValid: true,
      confidence,
      labels: selectedLabels,
      reason: 'Image contains relevant emergency/disaster content that matches the request context.',
      details: {
        objects: selectedLabels.filter(l => !['Flood', 'Fire', 'Earthquake'].includes(l)),
        safetyScores: {
          adult: 'VERY_UNLIKELY',
          violence: hasEmergencyContent ? 'POSSIBLE' : 'UNLIKELY',
          racy: 'VERY_UNLIKELY',
        }
      }
    };
  } else {
    return {
      isValid: false,
      confidence: 100 - confidence,
      labels: selectedLabels,
      reason: 'Image does not appear to show emergency or disaster-related content. Please upload a relevant image showing the actual situation.',
      details: {
        objects: selectedLabels,
        safetyScores: {
          adult: 'VERY_UNLIKELY',
          violence: 'UNLIKELY',
          racy: 'VERY_UNLIKELY',
        }
      }
    };
  }
}

// Real Gemini API verification
export async function verifyImageWithGemini(
  imageBase64: string,
  description: string,
  config: GeminiConfig = DEFAULT_CONFIG
): Promise<ImageVerificationResult> {
  // If no API key, use mock
  if (!config.apiKey) {
    console.warn('No Gemini API key found, using mock verification');
    return mockVerifyImage(imageBase64);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: `Analyze this image for a disaster/emergency request verification. 
                The user described: "${description}"
                
                Please analyze:
                1. Does the image show emergency/disaster content?
                2. Does it match the description?
                3. List key objects and scenes visible
                4. Provide confidence score (0-100)
                5. Is this image valid for an emergency request?
                
                Return JSON format:
                {
                  "isValid": boolean,
                  "confidence": number,
                  "labels": [string],
                  "reason": string,
                  "matchesDescription": boolean
                }`
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
                }
              }
            ]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Parse the response text as JSON
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        isValid: result.isValid,
        confidence: result.confidence,
        labels: result.labels || [],
        reason: result.reason,
        details: {
          objects: result.labels,
        }
      };
    }

    // Fallback if JSON parsing fails
    return {
      isValid: text.toLowerCase().includes('valid'),
      confidence: 75,
      labels: ['Emergency', 'Disaster'],
      reason: 'Image analyzed but structured response unavailable',
    };

  } catch (error) {
    console.error('Gemini verification error:', error);
    // Fallback to mock on error
    return mockVerifyImage(imageBase64);
  }
}

// Main export function - uses Gemini if available, otherwise mock
export async function verifyImage(
  imageBase64: string,
  description: string = ''
): Promise<ImageVerificationResult> {
  return verifyImageWithGemini(imageBase64, description);
}

// Batch verification for multiple images
export async function verifyMultipleImages(
  images: { id: string; base64: string; description: string }[]
): Promise<Map<string, ImageVerificationResult>> {
  const results = new Map<string, ImageVerificationResult>();
  
  // Process sequentially to avoid rate limits
  for (const image of images) {
    try {
      const result = await verifyImage(image.base64, image.description);
      results.set(image.id, result);
    } catch (error) {
      results.set(image.id, {
        isValid: false,
        confidence: 0,
        labels: [],
        reason: 'Verification failed due to technical error',
      });
    }
  }
  
  return results;
}
