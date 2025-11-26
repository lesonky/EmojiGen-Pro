import React, { useEffect, useState } from 'react';
import { checkApiKey, requestApiKey } from '../services/geminiService';
import { KeyRound, ExternalLink } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

const ApiKeyGuard: React.FC<Props> = ({ children }) => {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      try {
        const valid = await checkApiKey();
        setHasKey(valid);
      } catch (e) {
        console.error("Failed to check API key", e);
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, []);

  const handleConnect = async () => {
    try {
      await requestApiKey();
      // Assume success after dialog return, reset state to force re-render or check
      setLoading(true);
      const valid = await checkApiKey();
      setHasKey(valid);
      // Even if false (race condition), we assume user interaction happened.
      // In a real app, we might poll, but prompt instruction says: "assume the key selection was successful"
      setHasKey(true); 
    } catch (e) {
      console.error(e);
      // If error contains "Requested entity was not found", reset.
      if (e instanceof Error && e.message.includes("Requested entity was not found")) {
        setHasKey(false);
        alert("Session expired or invalid. Please select project again.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="bg-indigo-100 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
            <KeyRound className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h1>
          <p className="text-gray-600 mb-8">
            To use the high-quality <b>Gemini 3 Pro</b> model for image generation, you need to connect your Google Cloud project with billing enabled.
          </p>
          
          <button
            onClick={handleConnect}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg mb-4"
          >
            Connect Google Cloud Project
          </button>
          
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-indigo-500 hover:text-indigo-700 flex items-center justify-center gap-1"
          >
            Learn about billing <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ApiKeyGuard;