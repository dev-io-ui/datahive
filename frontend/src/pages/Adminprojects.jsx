import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/shared/Layout';
import toast from 'react-hot-toast';
import {
  Plus, X, Globe, Users, FileText, ChevronRight,
  Play, Pause, Archive, Layers, Tag, Building2, Calendar, Sparkles
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('accessToken')}` });

const projectAPI = {
  list: (params) => axios.get(`${API}/projects`, { headers: authHeader(), params }),
  create: (data) => axios.post(`${API}/projects`, data, { headers: authHeader() }),
  generate: (data) => axios.post(`${API}/projects/generate`, data, { headers: authHeader() }),
  update: (id, data) => axios.put(`${API}/projects/${id}`, data, { headers: authHeader() }),
  setStatus: (id, status) => axios.patch(`${API}/projects/${id}/status`, { status }, { headers: authHeader() }),
  languages: () => axios.get(`${API}/projects/languages`, { headers: authHeader() }),
};

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
];

const COUNTRY_OPTIONS = [
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'CA', label: 'Canada' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'AE', label: 'UAE' },
  { code: 'SG', label: 'Singapore' },
  { code: 'JP', label: 'Japan' },
];

const DOMAIN_OPTIONS = [
  'general', 'medical', 'legal', 'finance',
  'agriculture', 'education', 'ecommerce', 'other'
];

const statusConfig = {
  draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  active:    { label: 'Active',    color: 'bg-green-100 text-green-700' },
  paused:    { label: 'Paused',    color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  archived:  { label: 'Archived',  color: 'bg-red-100 text-red-600' },
};

// ── Create Project Modal ──────────────────────────────────────────────────────
function CreateProjectModal({ onClose, onCreate }) {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      color: '#6366f1',
      icon: '📁',
      'dataset.domain': 'general',
      'dataset.dataType': 'speech',
    }
  });

  const { data: langData } = useQuery('languages', () => projectAPI.languages().then(r => r.data.data));
  const selectedColor = watch('color');

  const onSubmit = async (data) => {
    // Flatten nested form fields
    const payload = {
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      tags: data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      client: {
        name: data.clientName,
        email: data.clientEmail,
        company: data.clientCompany,
        contractRef: data.contractRef,
      },
      dataset: {
        language: data.language,
        languageLabel: langData?.find(l => l.code === data.language)?.label || data.language,
        country: data.country,
        countryLabel: COUNTRY_OPTIONS.find(c => c.code === data.country)?.label || data.country,
        dialect: data.dialect,
        domain: data.domain,
        dataType: data.dataType,
        targetSize: data.targetSize,
      },
      deadline: data.deadline || undefined,
      status: 'draft',
    };
    await projectAPI.create(payload);
    toast.success('Project created!');
    onCreate();
  };

  const input = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const label = "block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Create Project</h2>
            <p className="text-xs text-gray-400 mt-0.5">Group related tasks by client, language, and country</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Basic info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Layers size={15} /> Project Details
            </h3>

            <div className="grid grid-cols-5 gap-3">
              {/* Icon picker */}
              <div>
                <label className={label}>Icon</label>
                <select className={input} {...register('icon')}>
                  {['📁','🎙️','📝','🖼️','🌐','🔬','⚖️','💊','🌾','📚','🛒','🤖'].map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-4">
                <label className={label}>Project Name *</label>
                <input className={input} placeholder="Hindi Voice Dataset — Google 2025"
                  {...register('name', { required: 'Project name is required' })} />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
            </div>

            <div>
              <label className={label}>Description</label>
              <textarea className={input} rows={2} placeholder="What is this dataset for?"
                {...register('description')} />
            </div>

            {/* Color picker */}
            <div>
              <label className={label}>Project Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setValue('color', c)}
                    className={`w-7 h-7 rounded-full transition-transform ${selectedColor === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <input type="hidden" {...register('color')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Tags (comma separated)</label>
                <input className={input} placeholder="asr, tts, nlp" {...register('tags')} />
              </div>
              <div>
                <label className={label}>Deadline</label>
                <input type="date" className={input} {...register('deadline')} />
              </div>
            </div>
          </div>

          {/* Client info */}
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pt-2">
              <Building2 size={15} /> Client Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Client Name *</label>
                <input className={input} placeholder="Google LLC"
                  {...register('clientName', { required: 'Client name is required' })} />
                {errors.clientName && <p className="text-red-500 text-xs mt-1">{errors.clientName.message}</p>}
              </div>
              <div>
                <label className={label}>Company</label>
                <input className={input} placeholder="Alphabet Inc." {...register('clientCompany')} />
              </div>
              <div>
                <label className={label}>Client Email</label>
                <input type="email" className={input} placeholder="pm@google.com" {...register('clientEmail')} />
              </div>
              <div>
                <label className={label}>Contract / PO Ref</label>
                <input className={input} placeholder="PO-2025-001" {...register('contractRef')} />
              </div>
            </div>
          </div>

          {/* Dataset metadata */}
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pt-2">
              <Globe size={15} /> Dataset Metadata
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Language *</label>
                <select className={input} {...register('language', { required: 'Language is required' })}>
                  <option value="">Select language...</option>
                  {(langData || []).map(l => (
                    <option key={l.code} value={l.code}>{l.label} ({l.code})</option>
                  ))}
                </select>
                {errors.language && <p className="text-red-500 text-xs mt-1">{errors.language.message}</p>}
              </div>
              <div>
                <label className={label}>Country *</label>
                <select className={input} {...register('country', { required: 'Country is required' })}>
                  <option value="">Select country...</option>
                  {COUNTRY_OPTIONS.map(c => (
                    <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
                  ))}
                </select>
                {errors.country && <p className="text-red-500 text-xs mt-1">{errors.country.message}</p>}
              </div>
              <div>
                <label className={label}>Dialect / Region</label>
                <input className={input} placeholder="Mumbai Hindi, Hyderabad Telugu..." {...register('dialect')} />
              </div>
              <div>
                <label className={label}>Domain</label>
                <select className={input} {...register('domain')}>
                  {DOMAIN_OPTIONS.map(d => (
                    <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>Data Type</label>
                <select className={input} {...register('dataType')}>
                  <option value="speech">Speech / Audio</option>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="multimodal">Multimodal</option>
                </select>
              </div>
              <div>
                <label className={label}>Target Size</label>
                <input className={input} placeholder="10,000 utterances / 5GB" {...register('targetSize')} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition">
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────
function GenerateProjectModal({ onClose, onCreate }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      idea: '',
    },
  });

  const onSubmit = async (data) => {
    const response = await projectAPI.generate({
      idea: data.idea,
      save: true,
    });
    const taskCount = response.data?.data?.tasks?.length || 0;
    toast.success(`AI project created with ${taskCount} tasks`);
    onCreate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600" /> Create Project with AI
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Generate a project and starter tasks from one idea</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
              Project Idea
            </label>
            <textarea
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={6}
              placeholder="Create an AI project to collect Indian English customer support conversations."
              {...register('idea', {
                required: 'Project idea is required',
                minLength: { value: 20, message: 'Idea must be at least 20 characters' },
                maxLength: { value: 2000, message: 'Idea cannot exceed 2000 characters' },
              })}
            />
            {errors.idea && <p className="text-red-500 text-xs mt-1">{errors.idea.message}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-60 transition">
              {isSubmitting ? 'Generating...' : 'Generate & Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProjectCard({ project, onStatusChange }) {
  const stats = project.liveStats || {};
  const pct = stats.totalSlots > 0 ? Math.round((stats.completedSlots / stats.totalSlots) * 100) : 0;
  const cfg = statusConfig[project.status] || statusConfig.draft;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition overflow-hidden">
      {/* Color strip */}
      <div className="h-1.5" style={{ backgroundColor: project.color }} />

      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">{project.icon}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{project.name}</h3>
              <p className="text-xs text-gray-400 truncate mt-0.5">{project.client?.company || project.client?.name}</p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        {/* Dataset metadata pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {project.dataset?.languageLabel && (
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              🌐 {project.dataset.languageLabel}
            </span>
          )}
          {project.dataset?.countryLabel && (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              📍 {project.dataset.countryLabel}
            </span>
          )}
          {project.dataset?.dialect && (
            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              {project.dataset.dialect}
            </span>
          )}
          {project.dataset?.domain && project.dataset.domain !== 'general' && (
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium capitalize">
              {project.dataset.domain}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {stats.totalSlots > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress</span>
              <span>{stats.completedSlots?.toLocaleString()} / {stats.totalSlots?.toLocaleString()} slots ({pct}%)</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: project.color }} />
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-gray-50 rounded-lg py-2">
            <div className="text-lg font-bold text-gray-900">{stats.totalTasks || 0}</div>
            <div className="text-xs text-gray-400">Tasks</div>
          </div>
          <div className="bg-gray-50 rounded-lg py-2">
            <div className="text-lg font-bold text-gray-900">{stats.activeTasks || 0}</div>
            <div className="text-xs text-gray-400">Active</div>
          </div>
          <div className="bg-gray-50 rounded-lg py-2">
            <div className="text-lg font-bold text-gray-900">₹{(stats.budgetAllocated || 0).toLocaleString()}</div>
            <div className="text-xs text-gray-400">Budget</div>
          </div>
        </div>

        {/* Tags */}
        {project.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {project.tags.slice(0, 4).map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Deadline */}
        {project.deadline && (
          <div className={`flex items-center gap-1.5 text-xs mb-4 ${project.isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
            <Calendar size={12} />
            {project.isOverdue ? 'Overdue · ' : 'Due '}{new Date(project.deadline).toLocaleDateString()}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <Link to={`/admin/projects/${project._id}`}
            className="flex-1 text-center text-sm text-indigo-600 font-medium hover:text-indigo-700 py-1.5 hover:bg-indigo-50 rounded-lg transition">
            View Details →
          </Link>
          {project.status === 'active' && (
            <button onClick={() => onStatusChange(project._id, 'paused')}
              className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition" title="Pause project">
              <Pause size={15} />
            </button>
          )}
          {project.status === 'paused' && (
            <button onClick={() => onStatusChange(project._id, 'active')}
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition" title="Activate">
              <Play size={15} />
            </button>
          )}
          {project.status === 'draft' && (
            <button onClick={() => onStatusChange(project._id, 'active')}
              className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition">
              Activate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminProjects() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery(
    ['admin-projects', statusFilter, search],
    () => projectAPI.list({ page: 1, limit: 50, status: statusFilter || undefined, search: search || undefined }).then(r => r.data),
    { keepPreviousData: true }
  );

  const statusMutation = useMutation(
    ({ id, status }) => projectAPI.setStatus(id, status),
    {
      onSuccess: () => {
        toast.success('Project status updated');
        qc.invalidateQueries(['admin-projects']);
      }
    }
  );

  const projects = data?.data || [];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-500 text-sm mt-1">Organize tasks by client, language, and dataset type</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 transition">
              <Sparkles size={16} /> AI Project
            </button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
              <Plus size={16} /> New Project
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects, clients..."
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
          />
          <div className="flex gap-2 flex-wrap">
            {['', 'draft', 'active', 'paused', 'completed'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse h-72">
                <div className="h-5 bg-gray-100 rounded w-3/4 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-6" />
                <div className="h-2 bg-gray-100 rounded mb-6" />
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3].map(j => <div key={j} className="h-12 bg-gray-100 rounded-lg" />)}
                </div>
              </div>
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {projects.map(p => (
              <ProjectCard
                key={p._id}
                project={p}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
              <Layers size={28} className="text-indigo-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No projects yet</h3>
            <p className="text-gray-500 text-sm mb-6 max-w-xs">
              Create your first project to group tasks by client, language, and dataset type.
            </p>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition">
              <Plus size={16} /> Create First Project
            </button>
            <button onClick={() => setShowGenerateModal(true)}
              className="mt-3 flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-purple-700 transition">
              <Sparkles size={16} /> Create with AI
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreate={() => { setShowModal(false); qc.invalidateQueries(['admin-projects']); }}
        />
      )}
      {showGenerateModal && (
        <GenerateProjectModal
          onClose={() => setShowGenerateModal(false)}
          onCreate={() => { setShowGenerateModal(false); qc.invalidateQueries(['admin-projects']); }}
        />
      )}
    </Layout>
  );
}
