import React, { useEffect, useState } from 'react';
import { Loader2, Save, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProfileData {
    full_name_arabic: string;
    full_name_latin: string;
    academic_rank: string;
    professional_email: string;
    personal_email: string;
    primary_phone: string;
    secondary_phone: string;
    phd_specialization: string;
    field_of_research: string;
    department: string;
}

const DEPARTMENTS = [
    'قسم العلوم الاقتصادية',
    'قسم العلوم المالية والمحاسبة',
    'قسم علوم التسيير',
    'قسم العلوم التجارية',
    'قسم الجذع المشترك',
];

const RANKS = [
    'أستاذ التعليم العالي',
    'أستاذ محاضر أ',
    'أستاذ محاضر ب',
    'أستاذ مساعد أ',
    'أستاذ مساعد ب',
];

export default function PortalProfile() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState<ProfileData>({
        full_name_arabic: '',
        full_name_latin: '',
        academic_rank: '',
        professional_email: '',
        personal_email: '',
        primary_phone: '',
        secondary_phone: '',
        phd_specialization: '',
        field_of_research: '',
        department: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/profile');
            if (res.status === 401) {
                navigate('/portal/login');
                return;
            }
            const data = await res.json();

            // Initialize form with data, handling nulls
            setFormData({
                full_name_arabic: data.full_name_arabic || '',
                full_name_latin: data.full_name_latin || '',
                academic_rank: data.academic_rank || '',
                professional_email: data.professional_email || '',
                personal_email: data.personal_email || '',
                primary_phone: data.primary_phone || '',
                secondary_phone: data.secondary_phone || '',
                phd_specialization: data.phd_specialization || '',
                field_of_research: data.field_of_research || '',
                department: data.department || '',
            });
        } catch (error) {
            console.error('Failed to load profile', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (!res.ok) throw new Error('Failed to save profile');

            setMessage({ type: 'success', text: 'تم حفظ الملف الشخصي بنجاح' });
            // Redirect to preferences if this was first time?
        } catch (error) {
            setMessage({ type: 'error', text: 'حدث خطأ أثناء الحفظ' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-indigo-600" /></div>;
    }

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="bg-indigo-600 px-4 py-5 border-b border-gray-200 sm:px-6 flex items-center">
                <User className="text-white w-6 h-6 ml-2" />
                <h3 className="text-lg leading-6 font-medium text-white">
                    الملف الشخصي للأستاذ
                </h3>
            </div>

            <div className="px-4 py-5 sm:p-6">
                {message && (
                    <div className={`mb-6 p-4 rounded-md ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">

                        {/* Arabic Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">الاسم واللقب (بالعربية)</label>
                            <input
                                type="text"
                                name="full_name_arabic"
                                required
                                value={formData.full_name_arabic}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>

                        {/* Latin Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nom et Prénom (Français)</label>
                            <input
                                type="text"
                                name="full_name_latin"
                                required
                                dir="ltr"
                                value={formData.full_name_latin}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-left"
                            />
                        </div>

                        {/* Rank */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">الرتبة العلمية</label>
                            <select
                                name="academic_rank"
                                required
                                value={formData.academic_rank}
                                onChange={handleChange}
                                className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                <option value="">اختر الرتبة</option>
                                {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>

                        {/* Department */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">القسم</label>
                            <select
                                name="department"
                                required
                                value={formData.department}
                                onChange={handleChange}
                                className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            >
                                <option value="">اختر القسم</option>
                                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        {/* Professional Email (Read Only if loaded?) No, Takleef allows edit? Usually blocked */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">البريد المهني (@univ-eloued.dz)</label>
                            <input
                                type="email"
                                name="professional_email"
                                readOnly
                                className="mt-1 block w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm text-left"
                                dir="ltr"
                                value={formData.professional_email}
                            />
                        </div>

                        {/* Personal Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">البريد الشخصي</label>
                            <input
                                type="email"
                                name="personal_email"
                                dir="ltr"
                                value={formData.personal_email}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-left"
                            />
                        </div>

                        {/* Phones */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">رقم الهاتف الأساسي</label>
                            <input
                                type="tel"
                                name="primary_phone"
                                required
                                dir="ltr"
                                value={formData.primary_phone}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-left"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">رقم الهاتف الثانوي</label>
                            <input
                                type="tel"
                                name="secondary_phone"
                                dir="ltr"
                                value={formData.secondary_phone}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-left"
                            />
                        </div>

                        {/* Specialization */}
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">تخصص الدكتوراه</label>
                            <input
                                type="text"
                                name="phd_specialization"
                                required
                                value={formData.phd_specialization}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>

                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">مجال البحث (Field of Research)</label>
                            <input
                                type="text"
                                name="field_of_research"
                                value={formData.field_of_research}
                                onChange={handleChange}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>

                    </div>

                    <div className="pt-5">
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-indigo-600 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                                        جاري الحفظ...
                                    </>
                                ) : (
                                    <>
                                        <Save className="-ml-1 mr-2 h-5 w-5" />
                                        حفظ المعلومات
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
