import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import Layout from '../components/shared/Layout';
import { projectAPI } from '../services/api';

function CreateTaskModal({ projectId, onClose, onDone }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { type: 'text', pricePerTask: 1, totalSlots: 1, validationsRequired: 1 },
  });

  const createMutation = useMutation(
    (payload) => projectAPI.createTask(projectId, { ...payload, status: 'active' }),
    {
      onSuccess: () => {
        toast.success('Task created');
        onDone();
      },
    }
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Task</h3>
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-3">
          <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Title" {...register('title', { required: true })} />
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Description" {...register('description', { required: true })} />
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Instructions" {...register('instructions', { required: true })} />
          <div className="grid grid-cols-3 gap-3">
            <select className="border rounded-lg px-3 py-2 text-sm" {...register('type', { required: true })}>
              <option value="text">Text</option>
              <option value="audio">Audio</option>
              <option value="image">Image</option>
            </select>
            <input type="number" min="0.01" step="0.01" className="border rounded-lg px-3 py-2 text-sm" placeholder="Price" {...register('pricePerTask', { valueAsNumber: true })} />
            <input type="number" min="1" className="border rounded-lg px-3 py-2 text-sm" placeholder="Slots" {...register('totalSlots', { valueAsNumber: true })} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
            <button type="submit" disabled={isSubmitting || createMutation.isLoading} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm">
              {createMutation.isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GenerateTasksModal({ projectId, onClose, onDone }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { taskType: 'text', language: 'Hindi', country: 'India', count: 10, totalSlots: 1, pricePerTask: 1 },
  });

  const generateMutation = useMutation(
    (payload) => projectAPI.generateTasks(projectId, payload),
    {
      onSuccess: ({ data }) => {
        const provider = data?.data?.providerUsed;
        toast.success(
          data?.data?.queued
            ? 'Generation queued'
            : `Tasks generated via ${provider || 'ai'}`
        );
        onDone(data?.data);
      },
    }
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-xl p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Tasks with AI</h3>
        <form onSubmit={handleSubmit((d) => generateMutation.mutate({ ...d, count: Number(d.count) }))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select className="border rounded-lg px-3 py-2 text-sm" {...register('taskType', { required: true })}>
              <option value="text">Text</option>
              <option value="audio">Audio</option>
              <option value="image">Image</option>
            </select>
            <input type="number" min="1" max="100" className="border rounded-lg px-3 py-2 text-sm" {...register('count', { required: true, valueAsNumber: true, min: 1, max: 100 })} />
          </div>
          <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Dataset description" {...register('description', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Language" {...register('language', { required: true })} />
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Country" {...register('country', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min="0.01" step="0.01" className="border rounded-lg px-3 py-2 text-sm" placeholder="Price Per Task" {...register('pricePerTask', { valueAsNumber: true })} />
            <input type="number" min="1" className="border rounded-lg px-3 py-2 text-sm" placeholder="Slots per Task" {...register('totalSlots', { valueAsNumber: true })} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-2 text-sm">Cancel</button>
            <button type="submit" disabled={isSubmitting || generateMutation.isLoading} className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm">
              {generateMutation.isLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminProjectDetails() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [queuedJobId, setQueuedJobId] = useState('');
  const [completionToastShown, setCompletionToastShown] = useState(false);

  const { data, isLoading } = useQuery(['project-detail', id], () => projectAPI.get(id).then((r) => r.data.data));
  const project = data?.project;
  const tasks = data?.tasks || [];
  const { data: generationStatus } = useQuery(
    ['project-generation-status', id, queuedJobId],
    () => projectAPI.generationStatus(id, queuedJobId).then((r) => r.data.data),
    {
      enabled: Boolean(queuedJobId),
      refetchInterval: (jobData) => {
        const status = jobData?.status;
        if (!status || status === 'completed' || status === 'failed') return false;
        return 3000;
      },
      onSuccess: (jobData) => {
        if (jobData?.status === 'completed' && !completionToastShown) {
          setCompletionToastShown(true);
          toast.success('Queued generation completed');
          qc.invalidateQueries(['project-detail', id]);
          qc.invalidateQueries(['admin-projects']);
        }
        if (jobData?.status === 'failed') {
          toast.error(jobData.failedReason || 'Queued generation failed');
        }
      },
    }
  );

  const progress = useMemo(() => {
    const total = data?.totalTaskCount || 0;
    const completed = data?.completedTaskCount || 0;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }, [data]);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/projects" className="text-sm text-indigo-600">← Back to projects</Link>
        </div>
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading project...</div>
        ) : (
          <>
            <div className="bg-white border rounded-xl p-5 mb-5">
              <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
              <p className="text-sm text-gray-600 mt-1">{project?.description || 'No description'}</p>
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Project progress</span>
                  <span>{progress.completed}/{progress.total} tasks ({progress.pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${progress.pct}%` }} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowCreate(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">Create Task</button>
                <button onClick={() => setShowGenerate(true)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm">Generate Tasks with AI</button>
              </div>
              {queuedJobId && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700">
                  <span className="font-semibold">AI Job {queuedJobId}</span>
                  <span className="capitalize">• {generationStatus?.status || 'queued'}</span>
                  {generationStatus?.providerUsed && (
                    <span className="capitalize">• {generationStatus.providerUsed}</span>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left px-4 py-3">Title</th>
                    <th className="text-left px-4 py-3">Type</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Slots</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task._id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{task.title}</div>
                        <div className="text-xs text-gray-500">{task.description}</div>
                      </td>
                      <td className="px-4 py-3 capitalize">{task.type}</td>
                      <td className="px-4 py-3 capitalize">{task.status}</td>
                      <td className="px-4 py-3">{task.completedCount}/{task.totalSlots}</td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No tasks in this project yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showCreate && (
        <CreateTaskModal
          projectId={id}
          onClose={() => setShowCreate(false)}
          onDone={() => {
            setShowCreate(false);
            qc.invalidateQueries(['project-detail', id]);
            qc.invalidateQueries(['admin-projects']);
          }}
        />
      )}
      {showGenerate && (
        <GenerateTasksModal
          projectId={id}
          onClose={() => setShowGenerate(false)}
          onDone={(result) => {
            setShowGenerate(false);
            if (result?.queued && result?.jobId) {
              setCompletionToastShown(false);
              setQueuedJobId(String(result.jobId));
            }
            qc.invalidateQueries(['project-detail', id]);
            qc.invalidateQueries(['admin-projects']);
          }}
        />
      )}
    </Layout>
  );
}
