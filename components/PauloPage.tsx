
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, RefreshCw, Mic, StopCircle } from 'lucide-react';
import { sendMessageToPaulo } from '../services/pauloService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

interface Message {
  id: string;
  sender: 'user' | 'paulo';
  text: string;
  chart?: {
    type: 'bar' | 'pie';
    title: string;
    data: { name: string; value: number }[];
  } | null;
  timestamp: Date;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

const PauloPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'paulo',
      text: "Hello, Administrator. I am P.A.U.L.O. (Placement, Alumni, University Linkages Office) Assistant. I have access to the latest system metrics. How can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>(''); // Holds latest voice text for immediate sending

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const textToSend = overrideText || input;
    
    if (!textToSend.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Call AI
    const history = messages.map(m => ({ sender: m.sender, text: m.text }));
    const response = await sendMessageToPaulo(userMsg.text, history);

    const botMsg: Message = {
      id: (Date.now() + 1).toString(),
      sender: 'paulo',
      text: response.text,
      chart: response.chart,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);
  };

  const handleQuickPrompt = (prompt: string) => {
      setInput(prompt);
      // Optional: Auto submit
      // handleSend(); 
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert("Voice input is not supported in this browser. Please use Google Chrome or Edge.");
        return;
    }

    if (recognitionRef.current) {
        recognitionRef.current.stop(); // Ensure clean start
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true; // See results as we speak
    recognition.continuous = false; // Stop automatically when silence is detected

    recognition.onstart = () => {
        setIsListening(true);
        transcriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                // Interim
                finalTranscript += event.results[i][0].transcript;
            }
        }
        
        // Update both state (for UI) and ref (for logic)
        setInput(finalTranscript);
        transcriptRef.current = finalTranscript;
    };

    recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
            alert("Microphone access blocked. Please allow microphone permission in your browser settings.");
        }
    };

    recognition.onend = () => {
        setIsListening(false);
        // AUTO SEND LOGIC: If we have text, send it immediately
        if (transcriptRef.current.trim().length > 0) {
            handleSend(undefined, transcriptRef.current);
            transcriptRef.current = ''; // Reset
        }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
      if (recognitionRef.current) {
          recognitionRef.current.stop();
          // onend will fire and trigger the send
      }
  };

  // --- TEXT FORMATTER ---
  const formatText = (text: string) => {
    if (!text) return null;
    
    return text.split('\n').map((line, i) => {
      let content = line;
      let wrapperClass = "min-h-[1.2em]"; // Keeps empty lines visible

      // Handle Headings
      if (content.startsWith('### ')) {
          content = content.substring(4);
          wrapperClass = "font-bold text-md mt-3 mb-1";
      } else if (content.startsWith('## ')) {
          content = content.substring(3);
          wrapperClass = "font-bold text-lg mt-4 mb-2";
      } else if (content.startsWith('# ')) {
          content = content.substring(2);
          wrapperClass = "font-black text-xl mt-4 mb-2";
      }

      // Handle Bullets
      const trimmed = content.trim();
      const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');
      if (isBullet) {
          content = trimmed.substring(2);
      }

      // Handle Bold Parsing (**text**)
      const parts = content.split(/(\*\*.*?\*\*)/g).map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={index} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
      });

      if (isBullet) {
        return (
          <div key={i} className="flex items-start gap-2 ml-2 mb-1">
             <span className="mt-2 w-1.5 h-1.5 bg-current rounded-full shrink-0 opacity-60"></span>
             <span className="leading-relaxed">{parts}</span>
          </div>
        );
      }

      return <div key={i} className={`${wrapperClass} leading-relaxed`}>{parts}</div>;
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden">
        
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px]"></div>
            <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/5 blur-[100px]"></div>
        </div>

        {/* Header */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 p-4 flex items-center justify-between z-20 sticky top-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Bot className="text-white w-6 h-6" />
                </div>
                <div>
                    <h1 className="font-black text-slate-800 text-lg tracking-tight flex items-center gap-2">
                        P.A.U.L.O. <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase">AI Online</span>
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">Placement Alumni University Linkages Office Assistant</p>
                </div>
            </div>
            <button 
                onClick={() => setMessages([{ id: 'reset', sender: 'paulo', text: "Memory cleared. How can I help?", timestamp: new Date() }])}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                title="Reset Conversation"
            >
                <RefreshCw size={18} />
            </button>
        </div>

        {/* Chat Area */}
        <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-6 z-10 custom-scrollbar">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex w-full ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[90%] md:max-w-[80%] gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.sender === 'paulo' ? 'bg-white border border-indigo-100 text-indigo-600' : 'bg-slate-800 text-white'}`}>
                            {msg.sender === 'paulo' ? <Bot size={16} /> : <User size={16} />}
                        </div>

                        {/* Bubble */}
                        <div className={`flex flex-col gap-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm ${
                                msg.sender === 'user' 
                                ? 'bg-slate-800 text-white rounded-tr-none' 
                                : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                            }`}>
                                {/* Use formatText helper instead of rendering raw string */}
                                {formatText(msg.text)}
                            </div>

                            {/* Chart Rendering */}
                            {msg.chart && (
                                <div className="w-full max-w-lg bg-white p-4 rounded-2xl border border-slate-200 shadow-lg mt-2 animate-in fade-in slide-in-from-bottom-4">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 text-center">{msg.chart.title}</h4>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            {msg.chart.type === 'bar' ? (
                                                <BarChart data={msg.chart.data} layout="vertical" margin={{left: 30}}>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.3}/>
                                                    <XAxis type="number" hide />
                                                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none'}} />
                                                    <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                                                </BarChart>
                                            ) : (
                                                <PieChart>
                                                    <Pie
                                                        data={msg.chart.data}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {msg.chart.data.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip />
                                                    <Legend />
                                                </PieChart>
                                            )}
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                            
                            <span className="text-[10px] text-slate-400 font-medium px-1">
                                {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
            
            {isTyping && (
                <div className="flex justify-start w-full">
                    <div className="flex max-w-[75%] gap-3">
                        <div className="w-8 h-8 rounded-full bg-white border border-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <Bot size={16} />
                        </div>
                        <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-1">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                </div>
            )}
            <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200 z-20">
            {/* Quick Prompts */}
            {messages.length < 3 && (
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-2">
                    {[
                        "Show me the employment status chart", 
                        "How many unemployed alumni do we have?", 
                        "What are the top industries?", 
                        "Visualize alignment rate"
                    ].map((prompt, i) => (
                        <button 
                            key={i} 
                            onClick={() => handleQuickPrompt(prompt)}
                            className="whitespace-nowrap px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-lg text-xs font-bold transition-all"
                        >
                            {prompt}
                        </button>
                    ))}
                </div>
            )}

            <form onSubmit={(e) => handleSend(e)} className="relative flex items-center gap-2">
                <div className="relative flex-grow">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Hold Mic to speak..."
                        className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
                        disabled={isTyping}
                    />
                    
                    {/* Voice Input Button - Hybrid Push-to-Talk & Tap-to-Talk */}
                    <button 
                        type="button"
                        onMouseDown={startListening}
                        onMouseUp={stopListening}
                        onTouchStart={(e) => { e.preventDefault(); startListening(); }}
                        onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all cursor-pointer ${
                            isListening 
                            ? 'text-red-500 bg-red-50 animate-pulse ring-2 ring-red-200 scale-110' 
                            : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                        }`}
                        title="Hold to Speak"
                    >
                        {isListening ? <StopCircle size={20} /> : <Mic size={20} />}
                    </button>
                </div>
                <button 
                    type="submit" 
                    disabled={!input.trim() || isTyping}
                    className="p-3.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                >
                    <Send size={20} />
                </button>
            </form>
            <p className="text-[10px] text-center text-slate-400 mt-2">
                Hold <Mic size={10} className="inline"/> to speak. Release to send automatically.
            </p>
        </div>
    </div>
  );
};

export default PauloPage;
