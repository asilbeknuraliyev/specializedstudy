import React, { useState, useMemo } from 'react';
import { useLearnOS } from '../context/LearnOSContext';
import { OFFICIAL_19_CLASS_CODES } from '../constants/curriculum';
import { LearningMaterial, LearningMaterialType, OfficialClassCode } from '../types';
import {
  FolderOpen,
  FileText,
  Image as ImageIcon,
  Video,
  Plus,
  Search,
  Download,
  Eye,
  Archive,
  BookOpen,
  Upload,
  CheckCircle2,
} from 'lucide-react';

const MATERIAL_TYPE_LABELS: Record<LearningMaterialType, string> = {
  pdf: 'PDF hujjat',
  docx: 'DOCX qo‘llanma',
  pptx: 'PPTX taqdimot',
  xlsx: 'XLSX jadval',
  jpeg: 'JPEG rasm',
  png: 'PNG chizma',
  webp: 'WebP tasvir',
  video_link: 'Tasdiqlangan video dars',
};

export const AdminMaterialsLibraryPanel: React.FC = () => {
  const {
    currentUser,
    isPlatformOwner,
    learningMaterials,
    lessons,
    createLearningMaterial,
    updateLearningMaterial,
  } = useLearnOS();

  const isAdmin = isPlatformOwner || currentUser?.role === 'admin' || currentUser?.role === 'platform_owner';

  // Filters: Fan, Sinf, Chorak, Material turi
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [quarterFilter, setQuarterFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [previewMaterial, setPreviewMaterial] = useState<LearningMaterial | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Upload form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [materialType, setMaterialType] = useState<LearningMaterialType>('pdf');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [subject, setSubject] = useState('Matematika');
  const [classCode, setClassCode] = useState<OfficialClassCode>('9a1');
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(1);
  const [folder, setFolder] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [learningObjective, setLearningObjective] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredMaterials = useMemo(() => {
    return learningMaterials.filter((m) => {
      if (!isAdmin && m.status !== 'published') return false;
      if (subjectFilter !== 'ALL' && m.subject !== subjectFilter) return false;
      if (
        classFilter !== 'ALL' &&
        m.classCode !== classFilter &&
        !m.targetClassCodes?.includes(classFilter as OfficialClassCode)
      ) {
        return false;
      }
      if (quarterFilter !== 'ALL' && String(m.quarter) !== quarterFilter) return false;
      if (typeFilter !== 'ALL' && m.materialType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.folder.toLowerCase().includes(q) ||
          (m.lessonTitle || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [learningMaterials, isAdmin, subjectFilter, classFilter, quarterFilter, typeFilter, searchQuery]);

  const matchingLessons = useMemo(() => {
    return lessons.filter(
      (l) =>
        l.classCode?.toLowerCase() === classCode.toLowerCase() &&
        l.quarter === quarter
    );
  }, [lessons, classCode, quarter]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') setMaterialType('pdf');
    else if (ext === 'docx' || ext === 'doc') setMaterialType('docx');
    else if (ext === 'pptx' || ext === 'ppt') setMaterialType('pptx');
    else if (ext === 'xlsx' || ext === 'xls') setMaterialType('xlsx');
    else if (ext === 'jpg' || ext === 'jpeg') setMaterialType('jpeg');
    else if (ext === 'png') setMaterialType('png');
    else if (ext === 'webp') setMaterialType('webp');

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFileUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fileUrl.trim()) return;
    setIsSubmitting(true);
    try {
      const linkedLesson = matchingLessons.find((l) => l.id === lessonId);
      const parsedGrade = Number(classCode.replace(/\D/g, '')) || 9;
      await createLearningMaterial({
        title: title.trim(),
        description: description.trim(),
        materialType,
        fileUrl: fileUrl.trim(),
        fileName: fileName.trim() || undefined,
        folder: folder.trim() || `${subject} / ${quarter}-chorak`,
        grade: parsedGrade,
        classCode,
        targetClassCodes: [classCode],
        subject,
        quarter,
        lessonId: lessonId || undefined,
        lessonTitle: linkedLesson?.topicTitle || undefined,
        learningObjective: learningObjective.trim() || linkedLesson?.learningObjective || undefined,
        allowDownload,
      });
      setTitle('');
      setDescription('');
      setFileUrl('');
      setFileName('');
      setShowUploadModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                O‘quv Materiallari Kutubxonasi
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                PDF, DOCX, PPTX, XLSX, chizmalar va dars mavzulariga biriktirilgan rasmiy manbalar
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Material yuklash
            </button>
          )}
        </div>

        {/* Filter Bar: Fan, Sinf, Chorak, Material turi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Mavzu yoki fayl qidirish..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="Fan bo'yicha filtr"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Fan: Barchasi</option>
            <option value="Matematika">Matematika</option>
            <option value="Ingliz tili">Ingliz tili</option>
            <option value="Fizika">Fizika</option>
            <option value="Biologiya">Biologiya</option>
            <option value="Kimyo">Kimyo</option>
          </select>

          {isAdmin && (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              aria-label="Sinf bo'yicha filtr"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <option value="ALL">Sinf: Barchasi (19 sinf)</option>
              {OFFICIAL_19_CLASS_CODES.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          )}

          <select
            value={quarterFilter}
            onChange={(e) => setQuarterFilter(e.target.value)}
            aria-label="Chorak bo'yicha filtr"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Chorak: Barchasi</option>
            <option value="1">1-chorak</option>
            <option value="2">2-chorak</option>
            <option value="3">3-chorak</option>
            <option value="4">4-chorak</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Material turi bo'yicha filtr"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Material turi: Barchasi</option>
            {Object.entries(MATERIAL_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Materials Grid */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
          <FolderOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Tanlangan mezonlar bo‘yicha o‘quv materiallari topilmadi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dars taqdimotlari, PDF qo‘llanmalar va laboratoriya materiallari yuklangach shu yerda aks etadi.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map((mat) => {
            const isImage = ['jpeg', 'png', 'webp'].includes(mat.materialType);
            const isVideo = mat.materialType === 'video_link';

            return (
              <div
                key={mat.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold uppercase">
                      {isImage ? (
                        <ImageIcon className="w-3.5 h-3.5" />
                      ) : isVideo ? (
                        <Video className="w-3.5 h-3.5" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      {mat.materialType.toUpperCase()}
                    </span>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{mat.classCode?.toUpperCase()}</span>
                      <span>•</span>
                      <span>{mat.quarter}-chorak</span>
                    </div>
                  </div>

                  <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {mat.folder}
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {mat.title}
                  </h3>

                  {mat.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {mat.description}
                    </p>
                  )}

                  {mat.lessonTitle && (
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="line-clamp-1">Dars: {mat.lessonTitle}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewMaterial(mat)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ko‘rish
                  </button>

                  <div className="flex items-center gap-1.5">
                    {mat.allowDownload && (
                      <a
                        href={mat.fileUrl}
                        download={mat.fileName || `${mat.title}.${mat.materialType}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Yuklab olish
                      </a>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          updateLearningMaterial(mat.id, {
                            status: mat.status === 'archived' ? 'published' : 'archived',
                          })
                        }
                        title="Arxivlash"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400">
                  {previewMaterial.subject} • {previewMaterial.classCode?.toUpperCase()} • {previewMaterial.quarter}-chorak
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {previewMaterial.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMaterial(null)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Yopish
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {previewMaterial.description || 'O‘quv materiali tavsifi.'}
            </p>

            {['jpeg', 'png', 'webp'].includes(previewMaterial.materialType) ? (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-96 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <img
                  src={previewMaterial.fileUrl}
                  alt={previewMaterial.title}
                  className="max-h-96 object-contain"
                />
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-2">
                <FileText className="w-8 h-8 text-indigo-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {previewMaterial.fileName || previewMaterial.title}
                </div>
                <div className="text-xs text-slate-500">
                  Tur: {MATERIAL_TYPE_LABELS[previewMaterial.materialType]}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              {previewMaterial.allowDownload && (
                <a
                  href={previewMaterial.fileUrl}
                  download={previewMaterial.fileName || previewMaterial.title}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Ochish / Yuklab olish
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Material Modal */}
      {showUploadModal && isAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Yangi o‘quv materialini yuklash
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Yopish
              </button>
            </div>

            <form onSubmit={handleCreateMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Material nomi
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masalan: Kvadrat tenglamalar formulalar jadvali (PDF)"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Sinf
                  </label>
                  <select
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value as OfficialClassCode)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    {OFFICIAL_19_CLASS_CODES.map((c) => (
                      <option key={c} value={c}>
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Fan
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    <option value="Matematika">Matematika</option>
                    <option value="Ingliz tili">Ingliz tili</option>
                    <option value="Fizika">Fizika</option>
                    <option value="Biologiya">Biologiya</option>
                    <option value="Kimyo">Kimyo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Chorak
                  </label>
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    <option value={1}>1-chorak</option>
                    <option value={2}>2-chorak</option>
                    <option value={3}>3-chorak</option>
                    <option value={4}>4-chorak</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Material turi
                  </label>
                  <select
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value as LearningMaterialType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  >
                    {Object.entries(MATERIAL_TYPE_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Jild (Folder)
                  </label>
                  <input
                    type="text"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    placeholder={`${subject} / ${quarter}-chorak`}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Fayl yuklash yoki xavfsiz URL kiritish
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="https://... yoki kompyuterdan fayl tanlang"
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    Fayl
                    <input type="file" onChange={handleFileInputChange} className="hidden" />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Darsga biriktirish (ixtiyoriy)
                </label>
                <select
                  value={lessonId}
                  onChange={(e) => setLessonId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">— Mavzuni tanlang —</option>
                  {matchingLessons.slice(0, 60).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.lessonNumber}-dars: {l.topicTitle}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Qisqacha tavsif va o‘quv maqsadi
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Material o'quvchiga qaysi mavzuni o'zlashtirishda yordam beradi..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Kutubxonaga joylash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
