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

// ── CATALOG SEARCH HELPER ──
async function searchCatalog(query) {
  const allProducts = await base44.entities.ProductVariant.filter({ is_active: true });
  const q = query.toLowerCase();
  const matches = allProducts.filter(p => {
    const name = (p.display_name || p.name || '').toLowerCase();
    const sku = (p.manufacturer_sku || '').toLowerCase();
    const cat = (p.category_name || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    return name.includes(q) || sku.includes(q) || cat.includes(q) || desc.includes(q);
  });
  return matches.slice(0, 5).map(p => ({
    name: p.display_name || p.name,
    sku: p.manufacturer_sku,
    category: p.category_name,
    price: p.base_price,
    sizes: p.booth_sizes,
    tier: p.price_tier,
    description: (p.description || '').slice(0, 120)
  }));
}

export default function VoiceActivationProvider({ children }) {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const autoListenRef = useRef(false);

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
      // Auto-resume listening if conversation is active (for fluid back-and-forth)
      if (autoListenRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
            setIsListening(true);
          } catch (e) {
            // Already started or blocked
          }
        }, 300);
      }
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
      autoListenRef.current = false;
    } else {
      setInterimTranscript('');
      recognition.start();
      setIsListening(true);
      setIsPanelOpen(true);
      setConversationActive(true);
      autoListenRef.current = true;
    }
  }, [isListening, getSpeechRecognition]);

  // ── END CONVERSATION ──
  const endConversation = useCallback(() => {
    const recognition = recognitionRef.current;
    autoListenRef.current = false;
    setConversationActive(false);
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
    }
    if (synthRef.current.speaking) synthRef.current.cancel();
    setIsPanelOpen(false);
    setMessages([]);
    setInterimTranscript('');
  }, [isListening]);

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
    // Pause auto-listen while processing so TTS isn't picked up
    autoListenRef.current = false;

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
      const conversationHistory = messages.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n');

      // Catalog search — if user mentions product name or "find", "search", "look up", "catalog"
      let catalogContext = '';
      const lowerTranscript = transcript.toLowerCase();
      const wantsCatalog = /find|search|look up|lookup|catalog|product|show me|what.*have|banner|backwall|counter|kiosk|monitor|lighting|flooring|carpet|table|tent|billboard|formulate|hopup|vector|hybrid pro/.test(lowerTranscript);
      if (wantsCatalog) {
        // Extract likely search terms
        const searchTerms = transcript.replace(/^(find|search|look up|lookup|show me|what do you have for|can you find)\s*/i, '').trim();
        const results = await searchCatalog(searchTerms || transcript);
        if (results.length > 0) {
          catalogContext = `\n\nCATALOG SEARCH RESULTS for "${searchTerms || transcript}":\n${JSON.stringify(results, null, 2)}`;
        } else {
          catalogContext = `\n\nCATALOG SEARCH: No products found matching "${searchTerms || transcript}". Suggest the user try different keywords.`;
        }
      }

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a helpful voice assistant for a trade show booth design app called "The Exhibitors' Handbook". You help users navigate, create quotes, search the Orbus product catalog, and answer questions. Be conversational and natural.

CURRENT PAGE: ${currentUrl}
CONTEXT: ${contextSummary.join(' | ') || 'No active session'}
RECENT CONVERSATION:
${conversationHistory}
${catalogContext}

USER SAID: "${transcript}"

AVAILABLE PAGES: ${Object.entries(PAGE_ALIASES).map(([alias, page]) => `"${alias}" → ${page}`).join(', ')}

RESPOND WITH JSON:
{
  "action": "navigate" | "create_quote" | "search_catalog" | "query" | "modify_design" | "send_quote" | "confirm_action" | "clarify" | "chat",
  "page": "PageName (only for navigate)",
  "website_url": "url (only for create_quote)", 
  "booth_size": "10x10 or 10x20 or 20x20 (for create_quote)",
  "response": "What to say back to the user (required for all actions)",
  "needs_confirmation": true/false (for destructive actions)
}

RULES:
- For navigation: match the user's intent to the closest page. Be generous with fuzzy matching. After navigating, let the user know where you took them.
- For create_quote: extract website URL and booth size. If missing info, ask for it via "clarify" action — don't guess. Ask one question at a time.
- For search_catalog: when the user asks about products, present the catalog search results naturally. Mention names, prices, and what booth sizes they fit.
- For query: answer questions about the current design/quote using the context provided.
- For modify_design: acknowledge the request and ask clarifying questions about what to change.
- For clarify: when you need more info from the user. Ask ONE clear question.
- For chat: respond helpfully about booth design, trade shows, or the Orbus catalog.
- ALWAYS include a concise, friendly "response" field. Keep it under 3 sentences for voice readability.
- If the command is ambiguous, use "clarify" action and ask a specific question.
- NEVER make up product names or SKUs. Only reference products from the catalog search results.`,
        response_json_schema: {
          type: "object",
          properties: {
            action: { type: "string" },
            page: { type: "string" },
            website_url: { type: "string" },
            booth_size: { type: "string" },
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
      // Resume auto-listen after processing + TTS finishes
      if (conversationActive) {
        const waitForSpeech = () => {
          if (!synthRef.current.speaking) {
            autoListenRef.current = true;
            // Trigger a new listen cycle
            const recognition = recognitionRef.current;
            if (recognition) {
              setTimeout(() => {
                try {
                  recognition.start();
                  setIsListening(true);
                } catch (e) { /* already running */ }
              }, 400);
            }
          } else {
            setTimeout(waitForSpeech, 200);
          }
        };
        setTimeout(waitForSpeech, 500);
      }
    }
  }, [messages, addMessage, speak, conversationActive]);

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