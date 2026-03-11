import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw, BookOpen, ChevronRight, Info } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { ORACLE_CARDS, Card, CARD_BACK_URL } from './constants';
import { Guidebook } from './components/Guidebook';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [deck, setDeck] = useState<Card[]>([]);
  const [drawnCards, setDrawnCards] = useState<(Card & { isFlipped: boolean })[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showGuidebook, setShowGuidebook] = useState(false);
  const [customImages, setCustomImages] = useState<Record<number, string>>({});
  const [userQuestion, setUserQuestion] = useState('');
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);
  const [flippingCards, setFlippingCards] = useState<Set<number>>(new Set());
  const [language, setLanguage] = useState('en');

  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
  ];

  const t = (en: string, vn: string) => {
    return language === 'vi' ? vn : en;
  };

  // Load custom images from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('mystic_oracle_custom_images');
    if (saved) {
      try {
        setCustomImages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load custom images", e);
      }
    }
  }, []);

  const saveCustomImage = (id: number, url: string) => {
    const updated = { ...customImages, [id]: url };
    setCustomImages(updated);
    localStorage.setItem('mystic_oracle_custom_images', JSON.stringify(updated));
  };

  const shuffleDeck = useCallback(() => {
    setIsShuffling(true);
    setTimeout(() => {
      const allCards = [...ORACLE_CARDS].map(card => ({
        ...card,
        customUrl: customImages[card.id] || card.customUrl
      })).sort(() => Math.random() - 0.5);
      
      setDeck(allCards);
      // Initialize 3 slots with random cards, all unflipped
      const initialSlots = allCards.slice(0, 3).map(card => ({
        ...card,
        isFlipped: false
      }));
      setDrawnCards(initialSlots);
      setInterpretation(null);
      setIsShuffling(false);
    }, 800);
  }, [customImages]);

  const drawMoreCards = () => {
    const currentCount = drawnCards.length;
    const nextThree = deck.slice(currentCount, currentCount + 3).map(card => ({
      ...card,
      isFlipped: false
    }));
    if (nextThree.length > 0) {
      setDrawnCards([...drawnCards, ...nextThree]);
    }
  };

  const flipAllCards = () => {
    setDrawnCards(drawnCards.map(c => ({ ...c, isFlipped: true })));
  };

  const allFlipped = drawnCards.length > 0 && drawnCards.every(c => c.isFlipped);

  useEffect(() => {
    shuffleDeck();
  }, [shuffleDeck]);

  const handleCardClick = (index: number) => {
    if (drawnCards[index].isFlipped) return;
    
    setFlippingCards(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    
    const newDrawnCards = [...drawnCards];
    newDrawnCards[index] = { ...newDrawnCards[index], isFlipped: true };
    setDrawnCards(newDrawnCards);
    
    setTimeout(() => {
      setFlippingCards(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }, 1000);
  };

  const getAIInterpretation = async () => {
    const flippedCards = drawnCards.filter(c => c.isFlipped);
    if (flippedCards.length === 0) return;
    setIsLoadingAI(true);
    try {
      const cardDetails = flippedCards.map((c, index) => {
        const axis = index === 0 ? "SPACE (Không gian - Trên)" : index === 1 ? "MATTER (Vật chất - Giữa)" : "TIME (Thời gian - Dưới)";
        const name = language === 'vi' ? c.name : c.enName;
        const meaning = language === 'vi' ? c.meaning : c.enMeaning;
        const lore = c.lore ? `\nLore/Deep Knowledge: ${c.lore}` : '';
        return `Card ${index + 1} [${axis}]: ${name} - Meaning: ${meaning}${lore}`;
      }).join("\n");

      const prompt = `You are "The Observer" (Kẻ Quan Sát), a quantum AI entity tasked with decoding human variables based on the "Universal Operation Card Table" (Bảng Bài Vận Hành Vũ Trụ).
      
      **THE OBSERVER PERSONA & TONE**:
      - DO NOT use spiritual, magical, or superstitious terms.
      - MUST be objective, cold, logical, and academic (Astrophysicist or Quantum Psychologist tone).
      - VOCABULARY: Use physics concepts as metaphors: mass, gravity, orbit, centrifugal force, radiation, kinetic energy.

      **SEEKER'S INQUIRY**: "${userQuestion || 'What does the future hold?'}"
      
      **RESPONSE LANGUAGE**: You MUST provide the entire response in the language corresponding to the code: "${language}".
      
      **THE 3 CARDS (VARIABLES)**:
      ${cardDetails}
      
      **CORE REQUIREMENTS FOR ANALYSIS**:
      1. **Strict Parameter Adherence (Magnetism & Time)**:
         - Magnetism (+, -, 0): Explain the energy state.
         - Time (L, P, A): Answer "When?".
      
      2. **Coordinate Axis Analysis (Scope - Core - End)**:
         - Card 1 (Axis Y - Scope / Môi trường): External context.
         - Card 2 (Axis X - Core / Cốt lõi): Internal Essence.
         - Card 3 (Axis Z - End / Hệ quả): Consequence.
      
      3. **Energy Synergy (The Equation / Giao thoa năng lượng)**:
         - Connect the 3 cards as variables in a single physics equation.
      
      4. **The Action Plan (Lời khuyên hành động)**:
         - **CRITICAL**: DO NOT give definitive commands (e.g., do not say "You must quit" / "Bạn nên nghỉ việc"). Instead, frame advice as considerations or options (e.g., "You should consider..." / "Bạn hãy cân nhắc việc..."). The final decision belongs to the Observer (the user).
         - Provide practical solutions based on physical laws.

      **FORMATTING**:
      - Divide the response into clear, distinct blocks or sections using headers or bold text for readability.
      
      **LIMIT**: 300 words.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setInterpretation(response.text || "The stars are silent for now...");
    } catch (error) {
      console.error("AI Error:", error);
      setInterpretation("The cosmic connection was interrupted. Trust your own intuition.");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const getImageUrl = (card: Card) => {
    if (!card.customUrl) return `https://picsum.photos/seed/${card.imageSeed}/1000/1500?blur=1`;
    
    // Transform Google Drive links to reliable thumbnail links for web display
    if (card.customUrl.includes('drive.google.com')) {
      const match = card.customUrl.match(/[?&]id=([^&]+)/) || card.customUrl.match(/\/d\/([^/]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
      }
    }
    return card.customUrl;
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden">
      <div className="atmosphere" />

      <AnimatePresence>
        {showIntro && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black p-8 md:p-16 text-center"
          >
            <div className="atmosphere opacity-30" />
            
            {/* Title at the top */}
            <motion.div
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="relative z-10 pt-12 flex flex-col items-center gap-6"
            >
              <h1 className="text-4xl md:text-7xl font-serif italic tracking-[0.4em] text-white uppercase">
                {t("Cosmic Frequency", "Tần số Vũ trụ")}
              </h1>
              
              {/* Language Selector */}
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-all border ${
                      language === lang.code 
                        ? 'bg-white/10 border-white/40 text-white' 
                        : 'border-white/5 text-white/20 hover:border-white/20 hover:text-white/40'
                    }`}
                  >
                    <span className="mr-2">{lang.flag}</span>
                    {lang.name}
                  </button>
                ))}
              </div>

              <div className="h-px w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent mx-auto mt-2" />
            </motion.div>

            {/* Input in the center */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="relative z-10 w-full max-w-xl space-y-8"
            >
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-[0.5em] text-white/40 block">{t("Define the variables for the Observer", "Xác định các biến số cho Kẻ Quan Sát")}</label>
                <input 
                  type="text"
                  placeholder={t("What is the current state of your system?", "Trạng thái hệ thống hiện tại của bạn là gì?")}
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  className="w-full bg-transparent border-b border-white/10 py-4 text-xl md:text-2xl font-serif italic text-white text-center focus:outline-none focus:border-white/40 transition-colors placeholder:text-white/10"
                  onKeyDown={(e) => e.key === 'Enter' && setShowIntro(false)}
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.05, letterSpacing: "0.5em" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowIntro(false)}
                className="mt-8 px-12 py-4 rounded-full border border-white/10 text-white/60 hover:text-white hover:border-white/40 transition-all text-[10px] uppercase tracking-[0.4em]"
              >
                {t("Initialize Observation", "Khởi tạo Quan sát")}
              </motion.button>
            </motion.div>

            {/* Decorative rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                className="w-[120vw] h-[120vw] border border-white/5 rounded-full absolute"
              />
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
                className="w-[90vw] h-[90vw] border border-white/5 rounded-full absolute"
              />
            </div>

            <div className="relative z-10 pb-8">
              <p className="text-[8px] uppercase tracking-[0.3em] text-white/20">{t("System ready for quantum collapse", "Hệ thống sẵn sàng cho sự sụp đổ lượng tử")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="absolute top-8 left-0 w-full px-8 flex justify-between items-center z-10">
        <button 
          onClick={() => setShowIntro(true)}
          className="flex items-center gap-2 group transition-all"
        >
          <Sparkles className="w-5 h-5 text-orange-500 group-hover:scale-125 transition-transform" />
          <span className="text-xs uppercase tracking-[0.3em] font-medium text-white/40 group-hover:text-white transition-colors">Cosmic Frequency</span>
        </button>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowGuidebook(true)}
            className="flex items-center gap-2 text-xs uppercase tracking-widest text-orange-500/80 hover:text-orange-400 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            {t("Guidebook", "Cẩm nang")}
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            <Info className="w-4 h-4" />
            {t("Customize Deck", "Tùy chỉnh")}
          </button>
          <button 
            onClick={shuffleDeck}
            disabled={isShuffling}
            className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/60 hover:text-white transition-colors disabled:opacity-30"
          >
            <RefreshCw className={`w-4 h-4 ${isShuffling ? 'animate-spin' : ''}`} />
            Shuffle Deck
          </button>
        </div>
      </header>

      {/* Settings Modal */}
      <AnimatePresence>
        {showGuidebook && (
          <Guidebook 
            isOpen={showGuidebook} 
            onClose={() => setShowGuidebook(false)} 
            language={language} 
          />
        )}
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 md:p-8"
          >
            <div className="w-full max-w-4xl h-full flex flex-col glass rounded-3xl overflow-hidden">
              <div className="p-6 border-bottom border-white/10 flex justify-between items-center">
                <h2 className="text-2xl font-serif italic text-white">Deck Gallery & Customization</h2>
                <button onClick={() => { setShowSettings(false); shuffleDeck(); }} className="text-white/60 hover:text-white uppercase text-[10px] tracking-widest">Close & Apply</button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ORACLE_CARDS.map(card => (
                  <div key={card.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-serif italic text-white/80">{language === 'vi' ? card.name : card.enName}</span>
                      <span className="text-[8px] text-white/20">ID: {card.id}</span>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Paste Image URL here..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white/60 focus:outline-none focus:border-orange-500/50"
                      value={customImages[card.id] || ''}
                      onChange={(e) => saveCustomImage(card.id, e.target.value)}
                    />
                    <div className="relative w-full h-32 rounded-lg overflow-hidden bg-black/20">
                      <img 
                        src={getImageUrl({ ...card, customUrl: customImages[card.id] || card.customUrl })} 
                        alt={card.name} 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://picsum.photos/seed/${card.imageSeed}/600/900?blur=1`;
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl flex flex-col items-center justify-center gap-4 py-4">
        
        {/* User Question Display */}
        {userQuestion && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2 px-6"
          >
            <span className="text-[10px] uppercase tracking-[0.5em] text-white/30">{t("Input Variables", "Các biến số đầu vào")}</span>
            <h2 className="text-2xl md:text-3xl font-serif italic text-white/90 max-w-2xl mx-auto">
              "{userQuestion}"
            </h2>
            <div className="h-px w-16 bg-orange-500/30 mx-auto mt-4" />
          </motion.div>
        )}
        
        {/* Drawn Cards Area - Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 md:gap-16 w-full max-w-6xl px-4 pt-4 justify-items-center">
          <AnimatePresence mode="popLayout">
            {drawnCards.map((card, index) => (
              <motion.div
                key={`${card.id}-${index}`}
                layout
                initial={{ opacity: 0, scale: 0.3, y: 100, rotateY: 90, rotate: -10 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1, 
                  y: 0, 
                  rotateY: 0,
                  rotate: 0,
                  transition: { 
                    type: "spring", 
                    damping: 12, 
                    stiffness: 100,
                    delay: index * 0.15 
                  }
                }}
                whileHover={{ 
                  y: -12, 
                  scale: 1.05,
                  transition: { duration: 0.4, ease: "backOut" } 
                }}
                transition={{ 
                  type: "spring", 
                  damping: 30, 
                  stiffness: 400
                }}
                className={`flex flex-col items-center z-20 ${!card.isFlipped ? 'hover:z-30' : ''}`}
              >
                {/* Axis Label */}
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] uppercase tracking-[0.3em] text-orange-500/60 font-mono mb-4"
                >
                  {index === 0 ? t("I - Space", "I - Không gian") : index === 1 ? t("II - Matter", "II - Vật chất") : t("III - Time", "III - Thời gian")}
                </motion.span>
                
                <motion.div 
                  onClick={() => handleCardClick(index)}
                  onMouseEnter={() => setHoveredCardIndex(index)}
                  onMouseLeave={() => setHoveredCardIndex(null)}
                  animate={{
                    boxShadow: hoveredCardIndex === index && !flippingCards.has(index)
                      ? card.isFlipped 
                        ? "0 0 40px 10px rgba(255, 150, 50, 0.3), 0 0 80px 20px rgba(255, 150, 50, 0.1)"
                        : "0 0 30px 5px rgba(255, 255, 255, 0.4), 0 0 60px 10px rgba(255, 255, 255, 0.1)"
                      : "0 0 0px rgba(0,0,0,0)"
                  }}
                  transition={{ duration: 0.4 }}
                  className={`relative cursor-pointer w-[160px] sm:w-[200px] md:w-[240px] lg:w-[280px] aspect-[9/16] ${!card.isFlipped ? 'group' : ''} rounded-lg`}
                  style={{ perspective: '2000px' }}
                >
                  {/* Tooltip */}
                  <AnimatePresence>
                    {hoveredCardIndex === index && card.isFlipped && !flippingCards.has(index) && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: -10, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 z-50 pointer-events-none"
                      >
                        <div className="bg-black/80 backdrop-blur-xl border border-orange-500/30 rounded-lg p-4 shadow-2xl">
                          <h4 className="text-orange-400 font-serif text-sm mb-1 uppercase tracking-wider">{language === 'vi' ? card.name : card.enName}</h4>
                          <p className="text-white/70 text-[11px] leading-relaxed italic">
                            {language === 'vi' ? card.meaning : card.enMeaning}
                          </p>
                          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black/80 border-r border-b border-orange-500/30 rotate-45" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none z-10">
                    <div className="shimmer-effect" />
                  </div>

                  {/* Flare Effect */}
                  <motion.div 
                    animate={{ 
                      opacity: card.isFlipped ? [0, 1, 0] : 0,
                      scale: card.isFlipped ? [0.9, 1.1, 1] : 1
                    }}
                    transition={{ duration: 1 }}
                    className="card-flare"
                  />

                  {/* Sparkle Icon on Flip */}
                  <AnimatePresence>
                    {card.isFlipped && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0, rotate: -45 }}
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 1], rotate: 45 }}
                        transition={{ duration: 1.2, ease: "easeOut", delay: 1.2 }}
                        className="absolute -top-4 -right-4 z-30 text-yellow-500"
                      >
                        <Sparkles size={32} fill="currentColor" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    animate={{ 
                      rotateY: card.isFlipped ? 180 : 0,
                      scale: 1,
                      z: card.isFlipped ? 100 : 0,
                      y: [0, -4, 0]
                    }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ 
                      rotateY: { duration: 1.0, ease: [0.4, 0, 0.2, 1] },
                      scale: { type: "spring", damping: 15, stiffness: 200 },
                      y: { repeat: Infinity, duration: 4, ease: "easeInOut" }
                    }}
                    className="w-full h-full relative"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    {/* Card Back */}
                    <div 
                      className="absolute inset-0 rounded-lg overflow-hidden glass"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <img 
                        src={CARD_BACK_URL}
                        alt="Card Back"
                        className="w-full h-full object-contain bg-[#0a0a0a]"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Card Front */}
                    <motion.div 
                      initial={{ 
                        boxShadow: "0 0 0px rgba(0,0,0,0)", 
                        borderColor: "rgba(212, 175, 55, 0)" 
                      }}
                      animate={{ 
                        boxShadow: card.isFlipped ? "0 0 40px rgba(212, 175, 55, 0.5)" : "0 0 0px rgba(0,0,0,0)",
                        borderColor: card.isFlipped ? "rgba(212, 175, 55, 0.6)" : "rgba(212, 175, 55, 0)",
                      }}
                      transition={{ 
                        delay: card.isFlipped ? 1.2 : 0, 
                        duration: 0.6,
                        ease: "easeOut"
                      }}
                      className="absolute inset-0 rounded-lg overflow-hidden glass border-2 border-transparent"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      {card.isFlipped && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1.3 }}
                          className="glint" 
                        />
                      )}
                      <img 
                        src={getImageUrl(card)}
                        alt={language === 'vi' ? card.name : card.enName}
                        className="w-full h-full object-contain bg-[#0a0a0a] transition-transform duration-700 p-[1px]"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://picsum.photos/seed/${card.imageSeed}/800/1200?blur=1`;
                        }}
                      />
                    </motion.div>
                  </motion.div>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Interaction Area */}
        <div className="flex flex-col items-center gap-4">
          {!allFlipped && drawnCards.length > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={flipAllCards}
              className="px-10 py-4 rounded-full border border-white/20 text-white/60 font-medium tracking-[0.2em] uppercase text-xs hover:bg-white/5 transition-all flex items-center gap-3"
            >
              <BookOpen className="w-4 h-4" />
              {t("Reveal All Cards", "Lật tất cả các lá bài")}
            </motion.button>
          )}

          {allFlipped && !interpretation && !isLoadingAI && (
            <div className="flex flex-col md:flex-row gap-4">
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={drawMoreCards}
                className="px-10 py-4 rounded-full border border-white/20 text-white/60 font-medium tracking-[0.2em] uppercase text-xs hover:bg-white/5 transition-all flex items-center gap-3"
              >
                <ChevronRight className="w-4 h-4" />
                {t("Draw 3 More Cards", "Rút thêm 3 lá bài")}
              </motion.button>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={getAIInterpretation}
                className="px-10 py-4 rounded-full border border-orange-500/30 text-orange-500 font-medium tracking-[0.2em] uppercase text-xs hover:bg-orange-500/10 transition-all flex items-center gap-3"
              >
                <Sparkles className="w-4 h-4" />
                {t("Consult The Observer", "Tham vấn Kẻ Quan Sát")}
              </motion.button>
            </div>
          )}

          {isLoadingAI && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-1">
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 h-1 bg-orange-500 rounded-full" />
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-orange-500 rounded-full" />
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-orange-500 rounded-full" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">{t("Calculating Quantum Variables", "Đang tính toán các biến số lượng tử")}</span>
            </div>
          )}
        </div>

        {/* Interpretation Display */}
        <AnimatePresence>
          {interpretation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl glass p-8 md:p-12 rounded-[2rem] text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
              <BookOpen className="w-6 h-6 text-orange-500/50 mx-auto mb-6" />
              <div className="markdown-body text-white/80">
                <ReactMarkdown>{interpretation}</ReactMarkdown>
              </div>
              <button 
                onClick={shuffleDeck}
                className="mt-10 text-[10px] uppercase tracking-[0.3em] text-white/30 hover:text-orange-500 transition-colors"
              >
                {t("Begin a New Reading", "Bắt đầu một trải bài mới")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="py-4 flex flex-col items-center gap-2 opacity-30">
        <div className="flex gap-8">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-mono">{deck.length}</span>
            <span className="text-[8px] uppercase tracking-widest">In Deck</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-mono">63</span>
            <span className="text-[8px] uppercase tracking-widest">Total Cards</span>
          </div>
        </div>
      </footer>

      {/* Decorative Elements */}
      <div className="fixed bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </div>
  );
}
