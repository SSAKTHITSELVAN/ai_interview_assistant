import React, { useState, useEffect, useRef } from 'react';
import './Interview.css';

const API_URL = 'http://localhost:8000/api';

function Interview({ token, interviewId, questions: initialQuestions, setCurrentView }) {
  const [questions, setQuestions] = useState(initialQuestions || []);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(!initialQuestions);
  const [statusMessage, setStatusMessage] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [waitingForResponse, setWaitingForResponse] = useState(false);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const isInitializedRef = useRef(false);
  const silenceTimerRef = useRef(null);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    console.log('🚀 Starting conversational interview');
    
    initializeSpeechRecognition();
    
    if (initialQuestions && questions.length > 0) {
      setLoading(false);
      setTimeout(() => startInterview(), 2000);
    }

    return () => {
      cleanupSpeech();
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  const cleanupSpeech = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Recognition cleanup');
      }
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
  };

  const startInterview = () => {
    const greeting = "Hello! I'm your AI interviewer today. I'll be asking you questions and we'll have a natural conversation. Feel free to elaborate on your answers. Let me start with the first question.";
    
    speakAndWait(greeting, () => {
      setTimeout(() => {
        askQuestion(0);
      }, 2000);
    });
  };

  const askQuestion = (questionIndex) => {
    console.log(`📝 Asking question ${questionIndex + 1}`);
    const questionText = questions[questionIndex];
    
    setConversationHistory(prev => [...prev, {
      type: 'question',
      text: questionText,
      index: questionIndex
    }]);
    
    speakAndWait(questionText, () => {
      setTimeout(() => {
        startContinuousListening();
      }, 1500);
    });
  };

  const initializeSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Speech recognition requires Chrome or Edge browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscriptBuffer = '';

    recognition.onstart = () => {
      console.log('🎤 Listening...');
      setIsListening(true);
      setStatusMessage('🎤 Listening... Speak naturally!');
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        console.log('💬 User said:', finalTranscript);
        finalTranscriptBuffer += finalTranscript;
        
        // Reset silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        
        // Wait for 2 seconds of silence before processing
        silenceTimerRef.current = setTimeout(() => {
          if (finalTranscriptBuffer.trim()) {
            processUserResponse(finalTranscriptBuffer.trim());
            finalTranscriptBuffer = '';
          }
        }, 2000);
      }

      setTranscript(interimTranscript || finalTranscriptBuffer);
    };

    recognition.onerror = (event) => {
      console.error('❌ Recognition error:', event.error);
      if (event.error === 'network') {
        alert('Network error. Please check your connection.');
      }
    };

    recognition.onend = () => {
      console.log('🛑 Recognition ended');
      setIsListening(false);
      
      // Don't auto-restart - let the flow control when to listen
    };

    recognitionRef.current = recognition;
    console.log('✅ Speech recognition ready');
  };

  const startContinuousListening = () => {
    console.log('👂 Starting continuous listening');
    setStatusMessage('🎤 I\'m listening... speak when ready');
    
    // Always stop first to ensure clean state
    if (recognitionRef.current) {
      try {
        if (isListening) {
          console.log('🛑 Stopping existing recognition first...');
          recognitionRef.current.stop();
        }
        
        // Wait a bit then start
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (error) {
            console.error('Error starting recognition:', error);
          }
        }, 300);
      } catch (error) {
        console.error('Error in listening setup:', error);
      }
    }
  };

  const stopListening = () => {
    console.log('🛑 Stopping listening...');
    
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (error) {
        console.log('Stop error (safe to ignore):', error.message);
      }
    }
  };

  const processUserResponse = async (userText) => {
    console.log('🔄 Processing user response:', userText);
    
    stopListening();
    setWaitingForResponse(true);
    setStatusMessage('🤔 AI is thinking...');
    setTranscript('');

    // Check for commands
    const lowerText = userText.toLowerCase();
    
    if (lowerText.includes('next question') || lowerText.includes('move on')) {
      handleNextQuestion(userText);
      return;
    }
    
    if (lowerText.includes('repeat') || lowerText.includes('say that again')) {
      const lastQuestion = questions[currentQuestion];
      speakAndWait(lastQuestion, () => {
        setWaitingForResponse(false);
        setTimeout(() => startContinuousListening(), 1000);
      });
      return;
    }
    
    if (lowerText.includes('complete') || lowerText.includes('finish') || lowerText.includes('done')) {
      await saveCurrentAnswer(userText);
      completeInterview();
      return;
    }

    // Save the response
    await saveCurrentAnswer(userText);

    // Generate AI response using Gemini
    await generateAIResponse(userText);
  };

  const saveCurrentAnswer = async (answerText) => {
    try {
      console.log('💾 Saving answer...');
      
      await fetch(`${API_URL}/interview/${interviewId}/response`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: questions[currentQuestion],
          answer: answerText
        })
      });

      setConversationHistory(prev => [...prev, {
        type: 'answer',
        text: answerText,
        questionIndex: currentQuestion
      }]);

      console.log('✅ Answer saved');
    } catch (err) {
      console.error('❌ Error saving answer:', err);
    }
  };

  const generateAIResponse = async (userAnswer) => {
    try {
      console.log('🤖 Generating AI response...');
      
      // Use your backend Gemini service
      const response = await fetch(`${API_URL}/interview/generate-ai-response`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: questions[currentQuestion],
          answer: userAnswer,
          question_number: currentQuestion + 1,
          total_questions: questions.length
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const aiResponse = data.response;

      console.log('💬 AI says:', aiResponse);

      setConversationHistory(prev => [...prev, {
        type: 'ai_response',
        text: aiResponse,
        questionIndex: currentQuestion
      }]);

      // Speak the AI response
      speakAndWait(aiResponse, () => {
        setWaitingForResponse(false);
        
        // Check if AI suggested moving on
        if (aiResponse.toLowerCase().includes('next question') || 
            aiResponse.toLowerCase().includes("let's move")) {
          setTimeout(() => {
            handleNextQuestion(userAnswer);
          }, 1500);
        } else {
          // Continue listening for more from user
          setTimeout(() => startContinuousListening(), 1500);
        }
      });

    } catch (err) {
      console.error('❌ Error generating AI response:', err);
      
      // Fallback response
      const fallback = "Thank you for that answer. Would you like to elaborate, or shall we move to the next question?";
      speakAndWait(fallback, () => {
        setWaitingForResponse(false);
        setTimeout(() => startContinuousListening(), 1500);
      });
    }
  };

  const handleNextQuestion = async (currentAnswer) => {
    console.log('➡️ Moving to next question');
    
    if (currentQuestion < questions.length - 1) {
      const nextQ = currentQuestion + 1;
      setCurrentQuestion(nextQ);
      
      const transition = "Alright, moving on to the next question.";
      speakAndWait(transition, () => {
        setTimeout(() => askQuestion(nextQ), 1000);
      });
    } else {
      const closing = "That was the last question. Let me complete your interview and generate your feedback.";
      speakAndWait(closing, () => {
        setTimeout(() => completeInterview(), 2000);
      });
    }
  };

  const completeInterview = async () => {
    console.log('🏁 Completing interview');
    setLoading(true);
    stopListening();
    setStatusMessage('🤖 Analyzing your interview...');
    
    try {
      const response = await fetch(`${API_URL}/interview/${interviewId}/complete`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      speakAndWait('Interview complete! Check your history to see your detailed results. Thank you!', () => {
        setTimeout(() => setCurrentView('history'), 2000);
      });
      
    } catch (err) {
      console.error('Error completing interview:', err);
      alert('Error completing interview. Please try again.');
      setLoading(false);
    }
  };

  const speakAndWait = (text, onComplete) => {
    console.log('🔊 Speaking:', text.substring(0, 50) + '...');
    
    // Cancel any ongoing speech first
    synthRef.current.cancel();
    
    // Small delay to ensure cancellation completes
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        if (onComplete) onComplete();
      };

      utterance.onerror = (e) => {
        console.error('Speech error:', e.error);
        setIsSpeaking(false);
        // Still call onComplete even on error to prevent getting stuck
        if (onComplete) onComplete();
      };

      synthRef.current.speak(utterance);
    }, 100);
  };

  if (loading) {
    return (
      <div className="interview-container">
        <div className="interview-card">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>{statusMessage || 'Loading interview...'}</p>
          </div>
        </div>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="interview-container">
      <div className="interview-card voice-only">
        <div className="progress-section">
          <div className="progress-info">
            <span className="progress-label">
              Question {currentQuestion + 1} of {questions.length}
            </span>
            <span className="progress-percentage">{Math.round(progress)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <div className="voice-interview-display">
          <div className={`ai-avatar-large ${isSpeaking ? 'speaking' : ''} ${isListening ? 'listening' : ''}`}>
            <div className="avatar-circle">
              🤖
            </div>
            {isSpeaking && (
              <div className="sound-waves">
                <div className="wave"></div>
                <div className="wave"></div>
                <div className="wave"></div>
                <div className="wave"></div>
              </div>
            )}
          </div>

          <div className="question-display-large">
            <h2>{questions[currentQuestion]}</h2>
          </div>

          <div className="status-message">
            <p>{statusMessage}</p>
          </div>

          <div className="live-transcript">
            <div className="transcript-header">
              💬 Live Conversation
            </div>
            <div className="transcript-content">
              {transcript || <span className="placeholder">Your speech appears here...</span>}
            </div>
          </div>

          {isListening && !isSpeaking && (
            <div className="voice-indicator">
              <div className="pulse-circle"></div>
              <div className="pulse-circle delay-1"></div>
              <div className="pulse-circle delay-2"></div>
            </div>
          )}
        </div>

        <div className="voice-commands-help">
          <h4>💡 Tips for Natural Conversation</h4>
          <div className="command-list">
            <div className="command-item">
              <span className="cmd">Speak naturally</span> - The AI will respond to you
            </div>
            <div className="command-item">
              <span className="cmd">Pause when done</span> - 2 seconds of silence triggers AI
            </div>
            <div className="command-item">
              <span className="cmd">Say "next question"</span> - To move on manually
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Interview;