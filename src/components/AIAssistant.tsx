import React, { useState } from 'react';

interface Suggestion {
  id: string;
  type: 'conflict' | 'optimization' | 'improvement' | 'analytics' | 'recommendation';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  impact?: string;
  estimatedTime?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
}

interface AnalyticsData {
  totalHours: number;
  utilizationRate: number;
  conflictCount: number;
  professorWorkload: { [key: string]: number };
  roomUtilization: { [key: string]: number };
  timeSlotDistribution: { [key: string]: number };
}

// Chat interface - قيد التطوير

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  assignments: any[];
  professors: any[];
  courses: any[];
  groups: any[];
  rooms: any[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  isOpen,
  onClose,
  assignments,
  professors,
  courses,
  groups,
  rooms
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isChatMode, setIsChatMode] = useState(false);

  // قائمة بالنماذج المتاحة للتجربة
  const availableModels = [
    'gemini-pro',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro',
    'text-bison-001'
  ];
  
  // استخدام fetch مباشر لتجاوز مشاكل CSP
  const callGeminiAPI = async (prompt: string, modelIndex = 0): Promise<string> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('مفتاح Gemini API غير موجود. يرجى إضافة VITE_GEMINI_API_KEY في ملف .env');
    }
    
    const model = availableModels[modelIndex] || 'gemini-pro';
    console.log(`Calling Gemini API with model: ${model}`);
    console.log('API Key exists:', !!apiKey);
    console.log('Prompt length:', prompt.length);
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Gemini API Response:', data);
    
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('لم يتم الحصول على رد صحيح من Gemini API');
      }
      
      return data.candidates[0].content.parts[0]?.text || 'لم يتم الحصول على رد من الذكاء الاصطناعي';
      
    } catch (error) {
      // إذا فشل النموذج الحالي، جرب النموذج التالي
      if (modelIndex < availableModels.length - 1) {
        console.log(`Model ${availableModels[modelIndex]} failed, trying next model...`);
        return await callGeminiAPI(prompt, modelIndex + 1);
      }
      
      // إذا فشلت جميع النماذج
      throw error;
    }
  };

  // حساب التحليلات المتقدمة
  const calculateAnalytics = (): AnalyticsData => {
    const totalHours = assignments.length * 1.5; // افتراض أن كل حصة 1.5 ساعة
    const totalSlots = 7 * 8; // 7 أيام × 8 فترات زمنية
    const utilizationRate = (assignments.length / totalSlots) * 100;
    
    // حساب عبء العمل للأساتذة
    const professorWorkload: { [key: string]: number } = {};
    assignments.forEach(assignment => {
      const prof = professors.find(p => p.id === assignment.professor_id);
      if (prof && prof.name !== 'أستاذ غير معين') {
        professorWorkload[prof.name] = (professorWorkload[prof.name] || 0) + 1.5;
      }
    });
    
    // حساب استغلال القاعات
    const roomUtilization: { [key: string]: number } = {};
    assignments.forEach(assignment => {
      const room = rooms.find(r => r.id === assignment.room_id);
      if (room) {
        roomUtilization[room.name] = (roomUtilization[room.name] || 0) + 1;
      }
    });
    
    // توزيع الفترات الزمنية
    const timeSlotDistribution: { [key: string]: number } = {};
    assignments.forEach(assignment => {
      const timeKey = `${assignment.start_time}-${assignment.end_time}`;
      timeSlotDistribution[timeKey] = (timeSlotDistribution[timeKey] || 0) + 1;
    });
    
    // حساب التضارب
    const conflictCount = detectConflicts();
    
    return {
      totalHours,
      utilizationRate,
      conflictCount,
      professorWorkload,
      roomUtilization,
      timeSlotDistribution
    };
  };
  
  // اكتشاف التضارب
  const detectConflicts = (): number => {
    let conflicts = 0;
    const timeSlots: { [key: string]: any[] } = {};
    
    assignments.forEach(assignment => {
      const key = `${assignment.day_of_week}-${assignment.start_time}`;
      if (!timeSlots[key]) timeSlots[key] = [];
      timeSlots[key].push(assignment);
    });
    
    Object.values(timeSlots).forEach(slotAssignments => {
      if (slotAssignments.length > 1) {
        // تحقق من تضارب الأساتذة
        const professorIds = new Set();
        const roomIds = new Set();
        
        slotAssignments.forEach(assignment => {
          if (professorIds.has(assignment.professor_id)) conflicts++;
          if (roomIds.has(assignment.room_id)) conflicts++;
          professorIds.add(assignment.professor_id);
          roomIds.add(assignment.room_id);
        });
      }
    });
    
    return conflicts;
  };

  const analyzeSchedule = async () => {
    setIsAnalyzing(true);
    setSuggestions([]);
    
    try {
      // حساب التحليلات المتقدمة
      const analyticsData = calculateAnalytics();
      setAnalytics(analyticsData);
      
      // تحضير البيانات للتحليل
      const analysisData = {
        totalAssignments: assignments.length,
        totalProfessors: professors.length,
        totalCourses: courses.length,
        totalGroups: groups.length,
        totalRooms: rooms.length,
        conflicts: analyticsData.conflictCount,
        utilization: {
          rooms: Math.round(analyticsData.utilizationRate),
          timeSlots: Math.round((assignments.length / (7 * 8)) * 100)
        },
        workloadDistribution: {
          max: Math.max(...Object.values(analyticsData.professorWorkload)),
          min: Math.min(...Object.values(analyticsData.professorWorkload)),
          average: Math.round(Object.values(analyticsData.professorWorkload).reduce((a, b) => a + b, 0) / Object.keys(analyticsData.professorWorkload).length)
        }
      };

      const prompt = `
        أنت خبير في تحسين الجداول الدراسية. حلل البيانات التالية واقترح تحسينات محددة:

        إحصائيات الجدول:
        - عدد التكليفات: ${analysisData.totalAssignments}
        - عدد الأساتذة: ${analysisData.totalProfessors}
        - عدد المقررات: ${analysisData.totalCourses}
        - عدد المجموعات: ${analysisData.totalGroups}
        - عدد القاعات: ${analysisData.totalRooms}

        التضارب المكتشف: ${analysisData.conflicts} تضارب
        معدل استغلال القاعات: ${analysisData.utilization.rooms}%
        معدل استغلال الأوقات: ${analysisData.utilization.timeSlots}%

        توزيع عبء العمل:
        - أعلى عبء: ${analysisData.workloadDistribution.max} ساعة
        - أقل عبء: ${analysisData.workloadDistribution.min} ساعة
        - المتوسط: ${analysisData.workloadDistribution.average} ساعة

        اقترح تحسينات محددة في التنسيق التالي:
        [نوع الاقتراح]: [العنوان] - [الوصف المفصل]

        أنواع الاقتراحات:
        - CONFLICT: حل التضارب
        - OPTIMIZATION: تحسين الاستغلال
        - IMPROVEMENT: تحسينات عامة

        اجعل الاقتراحات عملية وقابلة للتطبيق باللغة العربية.
      `;

      const response = await callGeminiAPI(prompt);
      
      // تحليل الرد وتحويله إلى اقتراحات منظمة
      const parsedSuggestions = parseAISuggestions(response);
      setSuggestions(parsedSuggestions);
      setAnalysisComplete(true);

    } catch (error) {
      console.error('خطأ في تحليل الجدول:', error);
      
      let errorMessage = 'حدث خطأ أثناء تحليل الجدول. يرجى المحاولة مرة أخرى.';
      
      if (error instanceof Error) {
        if (error.message.includes('API غير موجود')) {
          errorMessage = 'مفتاح Gemini API غير موجود. يرجى إضافته في ملف .env';
        } else if (error.message.includes('404')) {
          errorMessage = 'خطأ في الاتصال بخدمة Gemini. يرجى التحقق من مفتاح API.';
        } else if (error.message.includes('403')) {
          errorMessage = 'مفتاح API غير صحيح أو منتهي الصلاحية.';
        }
      }
      
      setSuggestions([{
        id: 'error',
        type: 'improvement',
        title: 'خطأ في التحليل',
        description: errorMessage,
        priority: 'high',
        actionable: false
      }]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // تم حذف الدالة المكررة - استخدام detectConflicts الموجودة في calculateAnalytics

  // وظائف الدردشة - قيد التطوير

  const parseAISuggestions = (response: string): Suggestion[] => {
    const suggestions: Suggestion[] = [];
    const lines = response.split('\n').filter(line => line.trim());

    lines.forEach((line, index) => {
      if (line.includes(':')) {
        const [typeAndTitle, description] = line.split(' - ');
        const [type, title] = typeAndTitle.split(': ');
        
        let suggestionType: 'conflict' | 'optimization' | 'improvement' = 'improvement';
        let priority: 'high' | 'medium' | 'low' = 'medium';

        if (type.includes('CONFLICT')) {
          suggestionType = 'conflict';
          priority = 'high';
        } else if (type.includes('OPTIMIZATION')) {
          suggestionType = 'optimization';
          priority = 'medium';
        }

        suggestions.push({
          id: `suggestion-${index}`,
          type: suggestionType,
          title: title || `اقتراح ${index + 1}`,
          description: description || line,
          priority,
          actionable: true
        });
      }
    });

    return suggestions.length > 0 ? suggestions : [{
      id: 'default',
      type: 'improvement',
      title: 'تحليل عام',
      description: response,
      priority: 'medium',
      actionable: false
    }];
  };

  // تصدير الاقتراحات إلى PDF
  const exportSuggestionsToPDF = async () => {
    if (!analytics || suggestions.length === 0) return;
    
    const htmlContent = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>تقرير اقتراحات الذكاء الاصطناعي</title>
          <style>
            body { font-family: Arial, sans-serif; direction: rtl; }
            .header { text-align: center; margin-bottom: 20px; }
            .analytics { background: #f5f5f5; padding: 15px; margin: 20px 0; }
            .suggestion { border: 1px solid #ddd; margin: 10px 0; padding: 15px; }
            .high { border-left: 5px solid #dc2626; }
            .medium { border-left: 5px solid #d97706; }
            .low { border-left: 5px solid #059669; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🤖 تقرير اقتراحات الذكاء الاصطناعي</h1>
            <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar')}</p>
          </div>
          
          <div class="analytics">
            <h2>📊 إحصائيات الجدول</h2>
            <p><strong>معدل الاستغلال:</strong> ${analytics.utilizationRate.toFixed(1)}%</p>
            <p><strong>عدد التضارب:</strong> ${analytics.conflictCount}</p>
            <p><strong>إجمالي الساعات:</strong> ${analytics.totalHours}</p>
          </div>
          
          <h2>💡 الاقتراحات</h2>
          ${suggestions.map(suggestion => `
            <div class="suggestion ${suggestion.priority}">
              <h3>${getSuggestionIcon(suggestion.type)} ${suggestion.title}</h3>
              <p>${suggestion.description}</p>
              <small>الأولوية: ${suggestion.priority === 'high' ? 'عالية' : suggestion.priority === 'medium' ? 'متوسطة' : 'منخفضة'}</small>
            </div>
          `).join('')}
        </body>
      </html>
    `;
    
    try {
      // استخدام واجهة Electron لإنشاء PDF
      const result = await (window as any).electronAPI?.generatePDF?.(htmlContent, {
        filename: `ai-suggestions-${new Date().toISOString().split('T')[0]}.pdf`,
        format: 'A4',
        landscape: false
      });
      
      if (result?.success) {
        alert('تم تصدير التقرير بنجاح!');
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('حدث خطأ في تصدير التقرير');
    }
  };
  
  // تصفية الاقتراحات حسب الفئة
  const filteredSuggestions = selectedCategory === 'all' 
    ? suggestions 
    : suggestions.filter(s => s.type === selectedCategory);

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'conflict': return '⚠️';
      case 'optimization': return '⚡';
      case 'improvement': return '💡';
      case 'analytics': return '📊';
      case 'recommendation': return '🎯';
      default: return '📋';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-green-500 bg-green-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🤖</div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">مساعد الذكاء الاصطناعي</h2>
              <p className="text-sm text-gray-600">تحليل وتحسين الجداول الدراسية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden">
          {!analysisComplete ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div className="text-6xl">🧠</div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">تحليل ذكي للجدول الدراسي</h3>
                <p className="text-gray-600 mb-6">
                  سيقوم الذكاء الاصطناعي بتحليل جدولك واقتراح تحسينات مخصصة بناءً على البيانات الموجودة
                </p>
                <button
                  onClick={analyzeSchedule}
                  disabled={isAnalyzing}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 py-3 rounded-lg font-medium flex items-center space-x-2"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>جاري التحليل...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>بدء التحليل</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Analytics Dashboard */}
              {analytics && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold mb-3 flex items-center">
                    <span className="text-2xl ml-2">📊</span>
                    إحصائيات الجدول
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600">{analytics.utilizationRate.toFixed(1)}%</div>
                      <div className="text-sm text-gray-600">معدل الاستغلال</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">{analytics.conflictCount}</div>
                      <div className="text-sm text-gray-600">التضارب</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600">{analytics.totalHours}</div>
                      <div className="text-sm text-gray-600">إجمالي الساعات</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-purple-600">{Object.keys(analytics.professorWorkload).length}</div>
                      <div className="text-sm text-gray-600">الأساتذة النشطون</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Mode Toggle */}
              <div className="flex items-center justify-center mb-4">
                <div className="bg-gray-100 rounded-lg p-1 flex">
                  <button
                    onClick={() => setIsChatMode(false)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      !isChatMode 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    💡 الاقتراحات
                  </button>
                  <button
                    onClick={() => setIsChatMode(true)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isChatMode 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    🤖 دردشة ذكية
                  </button>
                </div>
              </div>
              
              {!isChatMode ? (
                <>
                  {/* Suggestions Controls */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <h3 className="text-lg font-semibold">الاقتراحات الذكية</h3>
                  <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="border rounded-lg px-3 py-1 text-sm"
                  >
                    <option value="all">جميع الاقتراحات</option>
                    <option value="conflict">حل التضارب</option>
                    <option value="optimization">التحسين</option>
                    <option value="improvement">التطوير</option>
                    <option value="analytics">التحليلات</option>
                    <option value="recommendation">التوصيات</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={exportSuggestionsToPDF}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-1"
                  >
                    <span>📄</span>
                    <span>تصدير PDF</span>
                  </button>
                  <div className="text-sm text-gray-600">
                    {filteredSuggestions.length} من {suggestions.length}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className={`border-l-4 p-4 rounded-lg ${getPriorityColor(suggestion.priority)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-lg">{getSuggestionIcon(suggestion.type)}</span>
                          <h4 className="font-semibold text-gray-800">{suggestion.title}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            suggestion.priority === 'high' ? 'bg-red-100 text-red-800' :
                            suggestion.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {suggestion.priority === 'high' ? 'عالي' :
                             suggestion.priority === 'medium' ? 'متوسط' : 'منخفض'}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {suggestion.description}
                        </p>
                      </div>
                      {suggestion.actionable && (
                        <button className="ml-4 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">
                          تطبيق
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
                </>
              ) : (
                <>
                  {/* Chat Interface - placeholder for now */}
                  <div className="text-center py-8">
                    <p className="text-gray-500">واجهة الدردشة قيد التطوير...</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <span>⚡</span>
              <span>مدعوم بـ Google Gemini AI</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>📊 {assignments.length} تكليف</span>
              <span>👥 {professors.length} أستاذ</span>
              <span>🏢 {rooms.length} قاعة</span>
              <span>🤖 تحليل ذكي للجدول الدراسي</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
