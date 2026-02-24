import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { base44 } from '@/api/base44Client';
import VoiceCommandButton from './VoiceCommandButton';
import VoiceCommandPanel from './VoiceCommandPanel';

const VoiceContext = createContext(null);
export const useVoice = () => useContext(VoiceContext);

// ── PAGE NAME MAP for navigation ──
const PAGE_ALIASES = {
  'dashboard': 'SalesDashboard',
  'sales dashboard': 'SalesDashboard',
  'home': 'Home',
  'landing': 'Landing',
  'results': 'Results',
  'quote': 'QuoteRequest',
  'quote request': 'QuoteRequest',
  'new quote': 'QuoteRequest',
  'configurator': 'DesignConfigurator',
  'design configurator': 'DesignConfigurator',
  'design': 'DesignConfigurator',
  'order history': 'OrderHistory',
  'orders': 'OrderHistory',
  'history': 'OrderHistory',
  'contacts': 'Contacts',
  'pipeline': 'Pipeline',
  'settings': 'Settings',
  'catalog': 'Product3DManager',
  'product catalog': 'Product3DManager',
  'products': 'Product3DManager',
  'confirmation': 'Confirmation',
  'student': 'StudentHome',
  'student home': 'StudentHome',
  'brand verification': 'BrandVerification',
};

export default function VoiceActivationProvider({ children }) {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // ── SPEECH RECOGNITION SETUP ──
  const getSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (interim) setInterimTranscript(interim);
      if (final) {
        setInterimTranscript('');
        handleUserCommand(final.trim());
      }
    };

    recognition.onerror = (event) => {
      console.warn('[Voice] Recognition error:', event.error);
      if (event.error === 'not-allowed') {
        addMessage('assistant', 'Microphone access was denied. Please enable it in your browser settings.');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    return recognition;
  }, []);

  // ── START/STOP LISTENING ──
  const toggleListening = useCallback(() => {
    const recognition = getSpeechRecognition();
    if (!recognition) {
      addMessage('assistant', 'Voice recognition is not supported in your browser. Try Chrome or Edge.');
      setIsPanelOpen(true);
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      setInterimTranscript('');
      recognition.start();
      setIsListening(true);
      setIsPanelOpen(true);
    }
  }, [isListening, getSpeechRecognition]);

  // ── ADD MESSAGE ──
  const addMessage = useCallback((role, content) => {
    setMessages(prev => [...prev, { role, content, timestamp: Date.now() }]);
  }, []);

  // ── SPEAK (TTS) ──
  const speak = useCallback((text) => {
    if (synthRef.current.speaking) synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1;
    synthRef.current.speak(utterance);
  }, []);

  // ── PROCESS COMMAND via LLM ──
  const handleUserCommand = useCallback(async (transcript) => {
    addMessage('user', transcript);
    setIsProcessing(true);

    try {
      // Get current context for the LLM
      const selectedDesign = sessionStorage.getItem('selectedDesign');
      const quoteRequest = sessionStorage.getItem('quoteRequest');
      const boothDesigns = sessionStorage.getItem('boothDesigns');

      const designContext = selectedDesign ? JSON.parse(selectedDesign) : null;
      const quoteContext = quoteRequest ? JSON.parse(quoteRequest) : null;
      const designsContext = boothDesigns ? JSON.parse(boothDesigns) : null;

      const contextSummary = [];
      if (quoteContext) contextSummary.push(`Active quote: ${quoteContext.boothSize} booth for ${quoteContext.dealerCompany || quoteContext.websiteUrl}`);
      if (designContext) contextSummary.push(`Selected design: "${designContext.design_name}" (${designContext.tier}), price: $${designContext.total_price?.toLocaleString()}, products: ${designContext.product_skus?.length || 0}`);
      if (designsContext?.length) contextSummary.push(`${designsContext.length} booth designs available on Results page`);

      const currentUrl = window.location.pathname;
      const conversationHistory = messages.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a voice assistant for a trade show booth design app called "The Exhibitors' Handbook". Parse the user's voice command and respond with a JSON action.

CURRENT PAGE: ${currentUrl}
CONTEXT: ${contextSummary.join(' | ') || 'No active session'}
RECENT CONVERSATION:
${conversationHistory}

USER SAID: "${transcript}"

AVAILABLE PAGES: ${Object.entries(PAGE_ALIASES).map(([alias, page]) => `"${alias}" → ${page}`).join(', ')}

RESPOND WITH JSON:
{
  "action": "navigate" | "create_quote" | "query" | "modify_design" | "send_quote" | "confirm_action" | "chat",
  "page": "PageName (only for navigate)",
  "website_url": "url (only for create_quote)", 
  "booth_size": "10x10 or 10x20 or 20x20 (for create_quote)",
  "query_answer": "answer text (for query about price, products, etc)",
  "response": "What to say back to the user (required for all actions)",
  "needs_confirmation": true/false (for destructive actions like send_quote)
}

RULES:
- For navigation: match the user's intent to the closest page. Be generous with fuzzy matching.
- For create_quote: extract website URL and booth size. If missing info, ask in response.
- For query: answer questions about the current design/quote using the context provided.
- For modify_design: acknowledge the request (full design modification coming in next phase).
- For send_quote: set needs_confirmation=true and ask for confirmation.
- For general chat: respond helpfully about booth design, trade shows, etc.
- ALWAYS include a concise, friendly "response" field.
- If the command is ambiguous, ask a clarifying question.`,
        response_json_schema: {
          type: "object",
          properties: {
            action: { type: "string" },
            page: { type: "string" },
            website_url: { type: "string" },
            booth_size: { type: "string" },
            query_answer: { type: "string" },
            response: { type: "string" },
            needs_confirmation: { type: "boolean" }
          }
        }
      });

      // Execute the action
      executeAction(result);

    } catch (err) {
      console.error('[Voice] Command processing error:', err);
      const errMsg = "Sorry, I had trouble processing that. Please try again.";
      addMessage('assistant', errMsg);
      speak(errMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [messages, addMessage, speak]);

  // ── EXECUTE ACTION ──
  const executeAction = useCallback((parsed) => {
    const response = parsed.response || "Done.";
    addMessage('assistant', response);
    speak(response);

    switch (parsed.action) {
      case 'navigate': {
        if (parsed.page) {
          // Try direct page name or alias lookup
          let targetPage = parsed.page;
          const lowerPage = parsed.page.toLowerCase();
          if (PAGE_ALIASES[lowerPage]) {
            targetPage = PAGE_ALIASES[lowerPage];
          }
          setTimeout(() => {
            navigate(createPageUrl(targetPage));
          }, 500);
        }
        break;
      }

      case 'create_quote': {
        if (parsed.website_url && parsed.booth_size) {
          const quoteData = {
            websiteUrl: parsed.website_url.startsWith('http') ? parsed.website_url : `https://${parsed.website_url}`,
            boothSize: parsed.booth_size,
            showDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            showName: '',
            dealerEmail: '',
            dealerCompany: '',
            dealerName: '',
            dealerPhone: '',
          };
          sessionStorage.setItem('quoteRequest', JSON.stringify(quoteData));
          setTimeout(() => {
            navigate(createPageUrl('CustomerProfile'));
          }, 800);
        }
        break;
      }

      case 'send_quote': {
        if (parsed.needs_confirmation) {
          // Wait for user confirmation in next message
          // The LLM will handle the confirmation flow
        }
        break;
      }

      case 'confirm_action': {
        // Handle confirmed destructive action
        const selectedDesign = sessionStorage.getItem('selectedDesign');
        if (selectedDesign) {
          // Trigger reserve flow — will be handled by DesignConfigurator
          const event = new CustomEvent('voice-reserve-design');
          window.dispatchEvent(event);
        }
        break;
      }

      case 'query':
      case 'modify_design':
      case 'chat':
      default:
        // Response already added above
        break;
    }
  }, [navigate, addMessage, speak]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current.speaking) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const value = {
    isListening,
    messages,
    toggleListening,
    speak,
    addMessage,
  };

  return (
    <VoiceContext.Provider value={value}>
      {children}
      <VoiceCommandButton
        isListening={isListening}
        onToggle={toggleListening}
        hasTranscript={messages.length > 0}
        onOpenPanel={() => setIsPanelOpen(true)}
      />
      <VoiceCommandPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        messages={messages}
        isListening={isListening}
        isProcessing={isProcessing}
        interimTranscript={interimTranscript}
        onToggleListening={toggleListening}
      />
    </VoiceContext.Provider>
  );
}