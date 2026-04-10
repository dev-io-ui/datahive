import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { taskAPI, adminAPI } from '../services/api';
import Layout from '../components/shared/Layout';
import toast from 'react-hot-toast';
import { Plus, X, Download, Pause, Play, Trash2, Mic, Type, Image } from 'lucide-react';

const statusBadge = {
  active:    'bg-green-100 text-green-700',
  paused:    'bg-yellow-100 text-yellow-700',
  draft:     'bg-gray-100 text-gray-600',
  completed: 'bg-blue-100 text-blue-700',
  archived:  'bg-red-100 text-red-700',
};

const typeIcon = { audio: Mic, text: Type, image: Image };

function CreateTaskModal({ onClose, onCreated }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { type: 'text', difficulty: 'medium', validationsRequired: 1, validatorRewardPercent: 20 }
  });

  const createMutation = useMutation(
    (data) => taskAPI.create({ ...data, status: 'active' }),
    { onSuccess: ({ data }) => { toast.success('Task created!'); onCreated(data.data); } }
  );

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-900">Create New Task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="p-6 space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input className={inputClass} placeholder="Record yourself reading a sentence" {...register('title', { required: true })} />
          </div>

          <div>
            <label className={labelClass}>Type</label>
            <select className={inputClass} {...register('type', { required: true })}>
              <option value="text">Text</option>
              <option value="audio">Audio</option>
              <option value="image">Image</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea className={inputClass} rows={2} placeholder="Brief description for contributors" {...register('description', { required: true })} />
          </div>

          <div>
            <label className={labelClass}>Instructions</label>
            <textarea className={inputClass} rows={4} placeholder="Detailed step-by-step instructions for contributors..." {...register('instructions', { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Price per Task ($)</label>
              <input type="number" step="0.01" min="0.01" className={inputClass} placeholder="0.50" {...register('pricePerTask', { required: true, valueAsNumber: true })} />
            </div>
            <div>
              <label className={labelClass}>Total Slots</label>
              <input type="number" min="1" className={inputClass} placeholder="1000" {...register('totalSlots', { required: true, valueAsNumber: true })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Validations Required</label>
              <input type="number" min="1" max="5" className={inputClass} {...register('validationsRequired', { valueAsNumber: true })} />
            </div>
            <div>
              <label className={labelClass}>Validator Reward %</label>
              <input type="number" min="0" max="100" className={inputClass} {...register('validatorRewardPercent', { valueAsNumber: true })} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Difficulty</label>
            <select className={inputClass} {...register('difficulty')}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Est. Minutes</label>
              <input type="number" min="1" className={inputClass} placeholder="5" {...register('estimatedMinutes', { valueAsNumber: true })} />
            </div>
            <div>
              <label className={labelClass}>Tags (comma-separated)</label>
              <input className={inputClass} placeholder="nlp, english, audio" {...register('tags')} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isLoading} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition">
              {createMutation.isLoading ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminTasks() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery(
    ['admin-tasks', page, statusFilter],
    () => taskAPI.list({ page, limit: 15, status: statusFilter || undefined }).then(r => r.data),
    { keepPreviousData: true }
  );

  const updateMutation = useMutation(
    ({ id, body }) => taskAPI.update(id, body),
    { onSuccess: () => { toast.success('Task updated'); qc.invalidateQueries(['admin-tasks']); } }
  );

  const handleExport = async (taskId, title) => {
    try {
      const res = await adminAPI.exportDataset(taskId, 'json');
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dataset-${title.replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Export failed');
    }
  };

  const tasks = data?.data || [];
  const pagination = data?.pagination || {};

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
            <p className="text-gray-500 text-sm mt-1">Create and manage data collection tasks</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
          >
            <Plus size={16} />
            New Task
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['', 'active', 'paused', 'draft', 'completed', 'archived'].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Task</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Price</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Progress</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-48" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-16" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-12" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-24" /></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-100 rounded w-16" /></td>
                      <td className="px-5 py-4"><div className="h-4 bg-gray-100 rounded w-20 ml-auto" /></td>
                    </tr>
                  ))
                : tasks.map((task) => {
                    const TypeIcon = typeIcon[task.type] || Type;
                    const pct = task.totalSlots > 0 ? Math.round((task.completedCount / task.totalSlots) * 100) : 0;
                    return (
                      <tr key={task._id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-4">
                          <div className="font-medium text-gray-900">{task.title}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{task.tags?.join(', ')}</div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="flex items-center gap-1.5 text-gray-600">
                            <TypeIcon size={14} />
                            <span className="capitalize">{task.type}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-gray-900">${task.pricePerTask?.toFixed(2)}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500">{task.completedCount}/{task.totalSlots}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge[task.status] || 'bg-gray-100 text-gray-600'}`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Toggle active/paused */}
                            {task.status === 'active' ? (
                              <button
                                onClick={() => updateMutation.mutate({ id: task._id, body: { status: 'paused' } })}
                                className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition"
                                title="Pause"
                              >
                                <Pause size={15} />
                              </button>
                            ) : task.status === 'paused' ? (
                              <button
                                onClick={() => updateMutation.mutate({ id: task._id, body: { status: 'active' } })}
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                                title="Activate"
                              >
                                <Play size={15} />
                              </button>
                            ) : null}
                            {/* Export dataset */}
                            <button
                              onClick={() => handleExport(task._id, task.title)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Export dataset"
                            >
                              <Download size={15} />
                            </button>
                            {/* Archive */}
                            <button
                              onClick={() => updateMutation.mutate({ id: task._id, body: { status: 'archived' } })}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Archive"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>

          {!isLoading && tasks.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <p className="text-sm">No tasks found. Create your first task!</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} tasks)
            </p>
            <div className="flex gap-2">
              <button
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition"
              >
                Previous
              </button>
              <button
                disabled={!pagination.hasNextPage}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <CreateTaskModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); qc.invalidateQueries(['admin-tasks']); }}
        />
      )}
    </Layout>
  );
}
