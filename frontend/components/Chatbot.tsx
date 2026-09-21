"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Bot, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../app/utils";

interface Message {
  sender: "user" | "ai";
  text: string;
}

interface ChatbotProps {
  token: string | null;
  apiHost: string;
}

export default function Chatbot({ token, apiHost }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasFirstResponse, setHasFirstResponse] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    "What should I fix first?",
    "Explain my risk score",
    "Am I SOC 2 ready?",
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = { sender: "user", text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const res = await fetch(`${apiHost}/api/v1/assistant/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: textToSend }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMessage: Message = { sender: "ai", text: data.answer };
        setMessages((prev) => [...prev, aiMessage]);
        setHasFirstResponse(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        const aiMessage: Message = {
          sender: "ai",
          text: errorData.detail || "Sorry, I encountered an issue processing your query. Please make sure you are logged in.",
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    } catch (err) {
      console.error(err);
      const aiMessage: Message = {
        sender: "ai",
        text: "Could not establish a connection to CyberGuardian's AI assistant. Please check your network and try again.",
      };
      setMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 bg-secondary hover:bg-secondary-hover text-white rounded-full p-4 shadow-glow-purple flex items-center justify-center border border-secondary/20 cursor-pointer"
      >
        <MessageSquare className="h-6 w-6" />
      </motion.button>

      {/* Slide-up Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="fixed bottom-24 right-6 z-50 w-full max-w-[420px] h-[580px] bg-background-card border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-background-hover">
              <div className="flex items-center gap-2.5">
                <div className="bg-secondary/10 p-2 rounded-md border border-secondary/20">
                  <Bot className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-text-primary flex items-center gap-1.5">
                    CyberGuardian Assistant
                    <Sparkles className="h-3.5 w-3.5 text-secondary fill-secondary" />
                  </h3>
                  <span className="text-[10px] text-secondary font-medium tracking-wider uppercase bg-secondary/15 px-1.5 py-0.5 rounded">
                    AI Grounded
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-md hover:bg-background/40 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col justify-center items-center text-center space-y-4">
                  <div className="bg-secondary/10 p-4 rounded-full border border-secondary/20 animate-pulse">
                    <Bot className="h-8 w-8 text-secondary" />
                  </div>
                  <div className="max-w-[280px]">
                    <h4 className="font-semibold text-text-primary text-sm">Grounded Q&A Security AI</h4>
                    <p className="text-xs text-text-secondary mt-1">
                      Ask me anything about your scanned domains, ports, SSL configurations, or MITRE/OWASP vulnerability remediations.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex flex-col max-w-[85%] space-y-1",
                    msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  {msg.sender === "user" ? (
                    <div className="bg-primary text-white rounded-lg px-4 py-2.5 text-sm shadow-md">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="bg-background border border-border rounded-lg px-4 py-3 text-sm text-text-primary shadow-sm space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-semibold tracking-wider text-secondary uppercase bg-secondary/10 px-1.5 py-0.5 rounded border border-secondary/20">
                          AI Response
                        </span>
                      </div>
                      <div className="prose prose-invert prose-xs leading-relaxed font-sans text-text-primary break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                      {hasFirstResponse && index === messages.findIndex(m => m.sender === "ai") && (
                        <p className="text-[10px] text-text-muted italic border-t border-border/40 pt-1.5 mt-2 w-full">
                          Grounded in your scan data — not general advice.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="mr-auto items-start max-w-[85%] bg-background border border-border rounded-lg px-4 py-3 shadow-sm flex items-center space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer / Input */}
            <div className="p-4 border-t border-border space-y-3 bg-background-card">
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSendMessage(prompt)}
                      className="text-[11px] bg-background border border-border hover:border-secondary/40 text-text-secondary hover:text-text-primary transition-all px-2.5 py-1 rounded-md cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  placeholder="Ask a question..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={isLoading}
                  className="flex-1 bg-background border border-border rounded-md px-3.5 py-2 text-xs text-text-primary outline-none focus:border-secondary/50 placeholder:text-text-muted disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="bg-secondary hover:bg-secondary-hover disabled:bg-background-hover disabled:border-border border border-transparent text-white p-2 rounded-md flex items-center justify-center transition-colors shadow-glow-purple disabled:shadow-none disabled:opacity-50 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
