'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Mic, CheckCircle } from 'lucide-react';
import Portal from './Portal';

interface ProjectAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  organizationName?: string;
  roleName?: string;
}

export default function ProjectAssistantModal({
  isOpen,
  onClose,
  userName,
  organizationName = 'your organization',
  roleName = 'Member',
}: ProjectAssistantModalProps) {
  const [currentStep, setCurrentStep] = useState(-1); // Start at -1 for intro screen
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedSpeech = useRef(false);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Intro screen (step -1)
  const introStep = {
    title: `Hi ${userName}, Welcome to Ticketing App! 🎉`,
    message: `Let's start a Ticket Metrix overview for you, for your smoother experience.`,
    icon: <Mic className="h-20 w-20 text-blue-600 animate-pulse" />,
    isIntro: true
  };

  // Define steps array at the top so it's available everywhere
  const steps = [
    {
      title: `Hi ${userName}, Welcome to Your Workspace! 🎉`,
      message: `You have been successfully onboarded by ${organizationName}. I'm your personal assistant here to guide you through our comprehensive project management and ticketing platform. Let me show you what makes this system powerful and how you can make the most of it.`,
      speechText: `Welcome ${userName}! Congratulations on joining ${organizationName}. I'm excited to show you around our powerful project management platform. This system is designed to make your work life easier, helping you manage tickets, collaborate with your team, and track everything in one place. Let me walk you through the key features that will help you succeed.`,
      icon: <Mic className="h-16 w-16 text-blue-600 animate-pulse" />,
      features: [
        '✨ Built for modern teams to collaborate seamlessly',
        '🚀 Streamline your workflow with intelligent automation',
        '💼 Enterprise-grade project management tools',
        '📊 Real-time insights and comprehensive analytics'
      ]
    },
    {
      title: 'Comprehensive Ticketing System 🎫',
      message: 'Our ticketing system is the heart of task management. Create, assign, and track work items with unprecedented clarity and control:',
      speechText: 'First up is our ticketing system, which is really the heart of everything. Think of tickets as your work items. You can create detailed tickets with descriptions and attachments, assign them to the right people, and track their progress from start to finish. Your team can comment on tickets in real-time, keeping everyone in the loop. Plus, you get smart notifications so you never miss important updates. It\'s all about keeping work organized and transparent.',
      icon: <CheckCircle className="h-16 w-16 text-green-600" />,
      features: [
        '📝 Rich ticket creation with descriptions, attachments, and priority levels',
        '👤 Intelligent assignment system to route work to the right people',
        '🔄 Dynamic status tracking from creation to completion',
        '💬 Real-time commenting and @mentions for instant collaboration',
        '🔔 Smart notifications keep you updated without overwhelming you',
        '🏷️ Custom labels and categories for perfect organization',
        '📎 File attachments and image uploads for complete context'
      ]
    },
    {
      title: 'Advanced Project Management 📊',
      message: 'Manage multiple projects simultaneously with our sophisticated project management features designed for scalability:',
      speechText: 'Now let\'s talk about project management. You can handle multiple projects at once, each with its own team and workflow. We have role-based access control, which means everyone sees exactly what they need to see based on their role. Your dashboard gives you a bird\'s eye view of project health, and our advanced search helps you find anything instantly. Need to share a project across departments? No problem! We also have templates to quickly set up recurring projects. Everything you need to stay organized and efficient.',
      icon: <Mic className="h-16 w-16 text-purple-600 animate-pulse" />,
      features: [
        '🗂️ Unlimited projects with independent teams and workflows',
        '🎯 Role-based access control ensuring security and proper delegation',
        '📈 Comprehensive dashboards showing project health at a glance',
        '🔍 Advanced filtering and search to find exactly what you need',
        '🤝 Cross-department project sharing and collaboration',
        '⚡ Project templates for quick setup of recurring work patterns',
        '📅 Timeline views and milestone tracking'
      ]
    },
    {
      title: 'Sales Pipeline Management 💼',
      message: 'Track your sales process from lead to close with our integrated CRM features:',
      speechText: 'For those working in sales, we have a complete sales pipeline built right in. You can track your deals from the first contact all the way to closing. Create professional quotes, manage client relationships, visualize your pipeline stages, and even forecast revenue. The system sends automated follow-up reminders so you never miss an opportunity. It\'s like having a personal sales assistant keeping you on track.',
      icon: <CheckCircle className="h-16 w-16 text-indigo-600" />,
      features: [
        '💰 Complete quote and proposal management system',
        '👥 Client relationship tracking with contact history',
        '📊 Sales pipeline visualization and stage management',
        '📈 Revenue forecasting and deal probability tracking',
        '🔔 Automated follow-up reminders and notifications',
        '📄 Professional quote generation with custom branding',
        '💳 Payment tracking and invoice management'
      ]
    },
    {
      title: 'Attendance & Time Tracking ⏰',
      message: 'Monitor team presence and productivity with our smart attendance system:',
      speechText: 'Time tracking is super simple here. Just one click to check in when you start work, and one click to check out when you\'re done. The system automatically logs your hours for accurate payroll. You can mark attendance whether you\'re in the office or working remotely. Managers get detailed reports and analytics. And don\'t worry, all your historical data is saved so you can always look back at your work patterns.',
      icon: <Mic className="h-16 w-16 text-orange-600 animate-pulse" />,
      features: [
        '✅ One-click check-in/check-out from anywhere',
        '⏱️ Automatic time logging for accurate payroll',
        '📅 Calendar integration with leave management',
        '📊 Attendance reports and analytics for managers',
        '🏢 Remote and office attendance tracking',
        '📱 Mobile-friendly for on-the-go access',
        '🔍 Historical attendance data and trends'
      ]
    },
    {
      title: 'Real-time Collaboration & Analytics 📈',
      message: 'Work together seamlessly and make data-driven decisions with powerful insights:',
      speechText: 'Collaboration is where this platform really shines. Everything updates in real-time across all devices, so your team is always in sync. You get customizable dashboards showing exactly the metrics you care about. Track team performance, identify bottlenecks, and make data-driven decisions. The notification center keeps you informed without overwhelming you with alerts. And our nested comment threads keep discussions organized and easy to follow. It\'s all about working smarter together.',
      icon: <CheckCircle className="h-16 w-16 text-pink-600" />,
      features: [
        '⚡ Real-time updates across all devices and team members',
        '📊 Customizable dashboards showing metrics that matter to you',
        '🎯 Performance tracking for teams and individuals',
        '📈 Trend analysis to identify bottlenecks and opportunities',
        '🔔 Smart notification center with priority filtering',
        '💬 Nested comment threads for organized discussions',
        '🔄 Activity feeds showing what\'s happening across projects'
      ]
    },
    {
      title: `You're All Set, ${userName}! 🚀`,
      message: `Your dashboard is fully loaded and ready to use. ${organizationName} has given you access as a ${roleName}. Here's what you should do right now to get started:`,
      speechText: `Alright ${userName}, you\'re all set! Your dashboard is ready to go, and ${organizationName} has set you up as a ${roleName}. Here\'s what I recommend doing first: check out your assigned tickets and projects, explore the notification center for any pending items, set up your profile the way you like it, and maybe create your first ticket to get a feel for the system. Don\'t forget to check in your attendance if you haven\'t already. Remember, we\'re here to make your work easier, so dive in and explore. You\'ve got this!`,
      icon: <Mic className="h-16 w-16 text-blue-600 animate-pulse" />,
      features: [
        '✅ Explore your dashboard to see assigned tickets and projects',
        '✅ Check the notification center for any pending actions',
        '✅ Set up your profile and preferences in settings',
        '✅ Review your project roles and responsibilities',
        '✅ Create your first ticket or update an existing one',
        '✅ Check in your attendance if you haven\'t already',
        '✅ Connect with your team members through comments',
        '🎯 Pro tip: Use keyboard shortcuts for faster navigation!'
      ]
    }
  ];

  // Text-to-Speech function that auto-advances on completion
  const speakText = (text: string, onComplete?: () => void) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1; // Slightly faster for more natural flow
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onstart = () => {
        console.log('🔊 Speech started');
        setIsSpeaking(true);
      };
      
      utterance.onend = () => {
        console.log('✅ Speech ended - moving to next step');
        setIsSpeaking(false);
        if (onComplete) {
          setTimeout(onComplete, 800); // Small pause before next screen
        }
      };
      
      utterance.onerror = () => {
        console.error('❌ Speech error');
        setIsSpeaking(false);
        if (onComplete) {
          setTimeout(onComplete, 1000);
        }
      };
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Stop speech when modal closes
  useEffect(() => {
    if (!isOpen && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Auto-advance through steps - REMOVED, now handled by speech onend
  // Speech completion automatically moves to next step

  // START SPEAKING when user clicks "Let's Start"
  const handleLetsStart = () => {
    console.log('🚀 Let\'s Start clicked - moving to step 0 and starting speech!');
    setCurrentStep(0);
    hasStartedSpeech.current = false;
    
    // Start speech immediately with auto-advance
    setTimeout(() => {
      const textToSpeak = steps[0].speechText || `${steps[0].title}. ${steps[0].message}`;
      console.log('🔊 Speaking:', textToSpeak);
      
      speakText(textToSpeak, () => {
        // Move to next step after speech ends
        setCurrentStep(1);
      });
      
      hasStartedSpeech.current = true;
    }, 100);
  };

  // Reset to intro screen when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('🎤 MODAL OPENED - Showing intro screen');
      setCurrentStep(-1);
      hasStartedSpeech.current = false;
    }
    
    return () => {
      setCurrentStep(-1);
      hasStartedSpeech.current = false;
    };
  }, [isOpen]);

  // Speak on step change (but NOT on step 0 which is handled by Let's Start)
  useEffect(() => {
    if (!isOpen || currentStep <= 0) return; // Skip intro (-1) and first step (0)
    
    const currentStepData = steps[currentStep];
    if (!currentStepData) return;
    
    const textToSpeak = currentStepData.speechText || `${currentStepData.title}. ${currentStepData.message}`;
    console.log(`🔊 Step ${currentStep} speaking:`, textToSpeak);
    
    // Speak with auto-advance to next step
    speakText(textToSpeak, () => {
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      }
    });
  }, [currentStep, isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    // Prevent closing on intro screen
    if (currentStep === -1) return;
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    setCurrentStep(-1);
    setIsSpeaking(false);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Prevent closing on intro screen or overlay click
    if (e.target === e.currentTarget && currentStep !== -1) {
      handleClose();
    }
  };

  const handleNext = () => {
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  // Determine which step data to show
  const currentStepData = currentStep === -1 ? introStep : steps[currentStep];
  const isIntroScreen = currentStep === -1;

  return (
    <Portal>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={handleOverlayClick}
      >
        {/* Backdrop with blur */}
        <div 
          className="absolute inset-0 backdrop-blur-sm transition-opacity" 
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        />
        
        {/* Modal */}
        <div className="relative w-full max-w-2xl max-h-[90vh] mx-4">
          {/* Animated gradient border effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl animate-pulse opacity-75 blur-sm" />
          
          <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden" ref={modalContentRef}>
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mic className={`h-6 w-6 text-white ${isSpeaking ? 'animate-pulse' : ''}`} />
                <h2 className="text-xl font-bold text-white">Project Assistant</h2>
                {isSpeaking && (
                  <span className="text-xs text-white/80 animate-pulse">Speaking...</span>
                )}
              </div>
              {!isIntroScreen && (
                <button
                  onClick={handleClose}
                  className="p-1 text-white hover:bg-white/20 transition-colors rounded-full"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-8">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                {currentStepData.icon}
              </div>

              {/* Title */}
              <h3 className="text-2xl font-bold text-gray-900 text-center mb-4">
                {currentStepData.title}
              </h3>

              {/* Message */}
              <p className="text-lg text-gray-700 text-center mb-6">
                {currentStepData.message}
              </p>

              {/* Features list */}
              {'features' in currentStepData && currentStepData.features && currentStepData.features.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 mb-6 border border-blue-100">
                  <ul className="space-y-3">
                    {currentStepData.features.map((item, index) => (
                      <li 
                        key={index} 
                        className="flex items-start gap-3 text-gray-800 animate-fadeIn font-medium"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <span className="text-blue-600 mt-1 text-xl">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Progress dots - only show if not intro screen */}
              {!isIntroScreen && (
                <div className="flex justify-center gap-2 mb-6">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        index === currentStep 
                          ? 'w-8 bg-blue-600' 
                          : 'w-2 bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-center gap-3">
                {isIntroScreen ? (
                  <button
                    onClick={handleLetsStart}
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-lg font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                  >
                    Let's Start
                  </button>
                ) : currentStep < steps.length - 1 ? (
                  <>
                    <button
                      onClick={handleClose}
                      className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Skip
                    </button>
                    <button
                      onClick={handleNext}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                    >
                      Next
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleClose}
                    className="px-8 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                  >
                    Get Started
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </Portal>
  );
}