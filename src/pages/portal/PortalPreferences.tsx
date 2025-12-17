import React, { useEffect, useState } from 'react';
import { Loader2, Save, LayoutGrid, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Module {
    id: number;
    module_name_arabic: string;
    semester: number;
    department: string;
}

interface Preference {
    module_id: number;
    teaching_type: 'LECTURE' | 'TUTORIAL' | 'BOTH';
    priority_level: number;
}

export default function PortalPreferences() {
    const navigate = useNavigate();
    const [modules, setModules] = useState<Module[]>([]);
    const [userPreferences, setUserPreferences] = useState<Preference[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSemester, setActiveSemester] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/preferences');
            if (res.status === 401) {
                navigate('/portal/login');
                return;
            }
            const data = await res.json();

            setModules(data.modules || []);
            setUserPreferences(data.preferences || []);

            // Default to first semester found or S1
            if (data.modules && data.modules.length > 0) {
                setActiveSemester(data.modules[0].semester);
            }
        } catch (error) {
            console.error('Failed to load preferences', error);
        } finally {
            setLoading(false);
        }
    };

    const getPreference = (moduleId: number) => {
        return userPreferences.find(p => p.module_id === moduleId);
    };

    const updatePreference = (moduleId: number, field: keyof Preference, value: any) => {
        setUserPreferences(prev => {
            const existing = prev.find(p => p.module_id === moduleId);
            if (existing) {
                // If unsetting logic needed, can do it here. For now update.
                if (field === 'priority_level' && value === '') {
                    // Remove preference if clearing priority? Or just ignore.
                    return prev.filter(p => p.module_id !== moduleId);
                }
                return prev.map(p => p.module_id === moduleId ? { ...p, [field]: value } : p);
            } else {
                // Add new
                return [...prev, {
                    module_id: moduleId,
                    teaching_type: 'BOTH', // Default
                    priority_level: 3, // Default
                    [field]: value
                } as Preference];
            }
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preferences: userPreferences }),
            });
            if (res.ok) {
                alert('تم حفظ الرغبات بنجاح');
            } else {
                alert('فشل حفظ الرغبات');
            }
        } catch (e) {
            console.error(e);
            alert('حدث خطأ');
        } finally {
            setSaving(false);
        }
    };

    const semesters = Array.from(new Set(modules.map(m => m.semester))).sort();

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;
    }

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden min-h-[600px] flex flex-col">
            <div className="bg-indigo-600 px-4 py-5 border-b border-gray-200 sm:px-6 flex justify-between items-center">
                <div className="flex items-center">
                    <LayoutGrid className="text-white w-6 h-6 ml-2" />
                    <h3 className="text-lg leading-6 font-medium text-white">
                        بطاقة الرغبات
                    </h3>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin ml-2 h-4 w-4" /> : <Check className="ml-2 h-4 w-4" />}
                    حفظ التغييرات
                </button>
            </div>

            {/* Semester Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 space-x-reverse px-6 overflow-x-auto" aria-label="Tabs">
                    {semesters.map((sem) => (
                        <button
                            key={sem}
                            onClick={() => setActiveSemester(sem)}
                            className={`${activeSemester === sem
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            الفصل {sem}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="p-6 flex-1 overflow-auto">
                {activeSemester && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {modules.filter(m => m.semester === activeSemester).map(module => {
                            const pref = getPreference(module.id);
                            const isSelected = !!pref;

                            return (
                                <div key={module.id} className={`border rounded-lg p-4 transition-all ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="text-lg font-semibold text-gray-900">{module.module_name_arabic}</h4>
                                            <p className="text-sm text-gray-500">{module.department}</p>
                                        </div>
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        updatePreference(module.id, 'priority_level', 3);
                                                    } else {
                                                        setUserPreferences(prev => prev.filter(p => p.module_id !== module.id));
                                                    }
                                                }}
                                                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                            />
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-indigo-100">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">نوع التدريس</label>
                                                <select
                                                    value={pref?.teaching_type || 'BOTH'}
                                                    onChange={(e) => updatePreference(module.id, 'teaching_type', e.target.value)}
                                                    className="block w-full pl-3 pr-10 py-1 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                                >
                                                    <option value="BOTH">محاضرة + تطبيق</option>
                                                    <option value="LECTURE">محاضرة فقط</option>
                                                    <option value="TUTORIAL">تطبيق فقط</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">الأولوية</label>
                                                <select
                                                    value={pref?.priority_level || 3}
                                                    onChange={(e) => updatePreference(module.id, 'priority_level', parseInt(e.target.value))}
                                                    className="block w-full pl-3 pr-10 py-1 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                                >
                                                    <option value={1}>1 - أولوية قصوى</option>
                                                    <option value={2}>2 - أولوية عالية</option>
                                                    <option value={3}>3 - متوسطة</option>
                                                    <option value={4}>4 - منخفضة</option>
                                                    <option value={5}>5 - ضعيفة</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
