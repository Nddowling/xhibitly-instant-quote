import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { base44 } from '@/api/base44Client';
import VoiceCommandButton from './VoiceCommandButton';
import VoiceCommandPanel from './VoiceCommandPanel';

const VoiceContext = createContext(null);
export const useVoice = () => useContext(VoiceContext);

export default function VoiceActivationProvider({ children }) {
  const navigate = useNavigate();
  const [isListening, setIsListening] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationActive, setConversationActive] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [lastSpokenId, setLastSpokenId] = useState(null);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const autoListenRef = useRef(false);
  const handleUserCommandRef = useRef(null);

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

  // ── INIT AGENT CONVERSATION ──
  useEffect(() => {
    async function initConversation() {
      try {
        const conv = await base44.agents.createConversation({
          agent_name: "product_assistant",
          metadata: { name: "Voice Assistant" }
        });
        console.log("Agent conversation created:", conv);
        setConversation(conv);
        
        // Add greeting initially if conversation is new
        setMessages([{ role: 'assistant', content: "Hi! I'm your virtual Exhibitors' Handbook assistant. What kind of trade show products or booth designs are you looking for today?" }]);
      } catch (e) {
        console.error("Agent init error", e);
        setMessages([{ role: 'assistant', content: `Error initializing agent: ${e.message}` }]);
      }
    }
    initConversation();
  }, []);

  // ── SUBSCRIBE TO AGENT ──
  useEffect(() => {
    if (!conversation) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      }
      
      const lastMsg = data.messages?.[data.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant') {
        const hasActiveTools = lastMsg.tool_calls?.some(tc => ['pending', 'running', 'in_progress'].includes(tc.status));
        if (!hasActiveTools && lastMsg.content) {
          setIsProcessing(false);
        }
      }
    });
    return () => unsubscribe();
  }, [conversation]);

  // ── SPEAK WHEN ASSISTANT FINISHES ──
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg.role === 'assistant' && lastMsg.content) {
      const hasActiveTools = lastMsg.tool_calls?.some(tc => ['pending', 'running', 'in_progress'].includes(tc.status));
      
      // If there are no active tools, assume the LLM is either done or streaming.
      // We debounce the speech to wait for the stream to complete.
      if (!hasActiveTools) {
        const timeout = setTimeout(() => {
          // Speak only if we haven't spoken this exact content yet for this message
          // (We use a combination of id and length to ensure we don't speak mid-stream)
          const contentHash = lastMsg.id + '-' + lastMsg.content.length;
          
          if (lastSpokenId !== contentHash) {
             speak(lastMsg.content);
             setLastSpokenId(contentHash);
             
             // Resume auto listen after speaking
             if (conversationActive) {
                autoListenRef.current = true;
                const checkSpeech = setInterval(() => {
                  if (!synthRef.current.speaking) {
                    clearInterval(checkSpeech);
                    if (recognitionRef.current && !isListening) {
                      try {
                        recognitionRef.current.start();
                        setIsListening(true);
                      } catch(e) {}
                    }
                  }
                }, 500);
             }
          }
        }, 1500); // 1.5s debounce ensures streaming has finished before speaking
        return () => clearTimeout(timeout);
      }
    }
  }, [messages, lastSpokenId, conversationActive, isListening, speak]);

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
        if (handleUserCommandRef.current) {
          handleUserCommandRef.current(final.trim());
        }
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

  // ── PROCESS COMMAND via Agent ──
  const handleUserCommand = useCallback(async (transcript) => {
    if (!conversation) {
        setMessages(prev => [...prev, { role: "assistant", content: "Error: Voice agent not ready." }]);
        speak("Error: Voice agent not ready.");
        return;
    }
    
    // Optimistic UI update
    setMessages(prev => [...prev, { role: "user", content: transcript }]);
    
    setIsProcessing(true);
    // Pause auto-listen while processing so TTS isn't picked up
    autoListenRef.current = false;

    try {
      await base44.agents.addMessage(conversation, {
        role: "user",
        content: transcript
      });
    } catch (err) {
      console.error('[Voice] Command processing error:', err);
      const errMsg = `Error: ${err.message || "Failed to process command."}`;
      setMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
      setIsProcessing(false);
      speak(errMsg);
    }
  }, [conversation, speak]);

  useEffect(() => {
    handleUserCommandRef.current = handleUserCommand;
  }, [handleUserCommand]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      autoListenRef.current = false;
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
    conversationActive,
    toggleListening,
    endConversation,
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
        conversationActive={conversationActive}
        onEndConversation={endConversation}
      />
    </VoiceContext.Provider>
  );
}