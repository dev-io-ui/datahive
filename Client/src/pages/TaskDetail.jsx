// ── TaskDetail.jsx ─────────────────────────────────────────────────────────
import React, { useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { taskAPI, submissionAPI } from '../services/api';
import Layout from '../components/shared/Layout';
import toast from 'react-hot-toast';
import { Upload, Mic, StopCircle, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export function TaskDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const assignment = state?.assignment;

  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

const { data: taskData } = useQuery({
  queryKey: ['task', id],
  queryFn: () => taskAPI.get(id).then((r) => r.data.data),
});

const task = taskData;

const submitMutation = useMutation({
  mutationFn: async () => {
    const formData = new FormData();

    formData.append('taskId', id);
    formData.append('assignmentId', assignment?._id || '');
    formData.append('taskType', task?.type);

    if (task?.type === 'text') {
      formData.append('textContent', textContent);
    } else if (task?.type === 'audio' && audioBlob) {
      formData.append('file', audioBlob, 'recording.webm');
    } else if (selectedFile) {
      formData.append('file', selectedFile);
    }

    return submissionAPI.submit(formData);
  },

  onSuccess: () => {
    toast.success('Submitted! Your work is now under review.');
    navigate('/submissions');
  },
});


  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = e => chunksRef.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setAudioBlob(blob);
      stream.getTracks().forEach(t => t.stop());
    };
    mr.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const timeLeft = assignment?.lockExpiry
    ? Math.max(0, Math.round((new Date(assignment.lockExpiry) - Date.now()) / 60000))
    : null;

  if (!task) return (
    <Layout>
      <div className="max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-100 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-full" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    </Layout>
  );

  const canSubmit = (
    (task.type === 'text' && textContent.trim().length > 0) ||
    (task.type === 'audio' && audioBlob) ||
    (task.type === 'image' && selectedFile)
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
            {timeLeft !== null && (
              <div className={`flex items-center gap-1.5 text-sm font-medium ${timeLeft < 5 ? 'text-red-600' : 'text-amber-600'}`}>
                <Clock size={15} />
                {timeLeft} min left
              </div>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1 capitalize">{task.type} task · {task.difficulty} · ${task.pricePerTask?.toFixed(2)}</p>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-xl p-5 mb-6 border border-blue-100">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800 mb-1">Instructions</p>
              <p className="text-sm text-blue-700 whitespace-pre-line">{task.instructions}</p>
            </div>
          </div>
        </div>

        {/* Sample */}
        {task.sampleData?.text && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Example</p>
            <p className="text-sm text-gray-700">{task.sampleData.text}</p>
          </div>
        )}

        {/* Input area */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">Your Submission</p>

          {task.type === 'text' && (
            <textarea
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              placeholder="Enter your response here..."
              rows={8}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          )}

          {task.type === 'audio' && (
            <div className="text-center py-6">
              {!audioBlob ? (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`flex items-center gap-2 mx-auto px-6 py-3 rounded-xl font-semibold text-sm transition ${
                    isRecording
                      ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {isRecording ? <><StopCircle size={18} /> Stop Recording</> : <><Mic size={18} /> Start Recording</>}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle size={18} />
                    <span className="text-sm font-medium">Recording captured!</span>
                  </div>
                  <audio controls src={URL.createObjectURL(audioBlob)} className="mx-auto" />
                  <button onClick={() => setAudioBlob(null)} className="text-sm text-gray-500 hover:text-red-600 transition">
                    Re-record
                  </button>
                </div>
              )}
            </div>
          )}

          {task.type === 'image' && (
            <div>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-8 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition">
                <Upload size={24} className="text-gray-400 mb-2" />
                <p className="text-sm text-gray-600 font-medium">Click to upload image</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP up to 50MB</p>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setSelectedFile(e.target.files[0])}
                />
              </label>
              {selectedFile && (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle size={16} />
                  {selectedFile.name}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={() => submitMutation.mutate()}
          disabled={!canSubmit || submitMutation.isLoading || !assignment}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {submitMutation.isLoading ? 'Submitting...' : 'Submit Task'}
        </button>

        {!assignment && (
          <p className="text-center text-xs text-red-500 mt-2">
            No active assignment found. Please get a task from the dashboard first.
          </p>
        )}
      </div>
    </Layout>
  );
}

// ── SubmissionHistory.jsx ─────────────────────────────────────────────────────
export function SubmissionHistory() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['my-submissions', page, statusFilter],
    queryFn: () => submissionAPI.mySubmissions({ page, limit: 20, status: statusFilter || undefined }).then(r => r.data),
    placeholderData: (previousData) => previousData,
  });

  const submissions = data?.data || [];
  const pagination = data?.pagination || {};

  const statusBadge = {
    pending: 'bg-yellow-100 text-yellow-700',
    under_review: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">My Submissions</h1>
          <p className="text-gray-500 text-sm mt-1">Track the status of all your submitted work</p>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {['', 'pending', 'under_review', 'accepted', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s ? s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'All'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {isLoading
            ? [...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              ))
            : submissions.map(sub => (
                <div key={sub._id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{sub.task?.title}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Submitted {new Date(sub.createdAt).toLocaleDateString()} · {sub.task?.type}
                    </p>
                    {sub.avgRating > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={`text-xs ${i < sub.avgRating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                        ))}
                        <span className="text-xs text-gray-400 ml-1">avg rating</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">${sub.task?.pricePerTask?.toFixed(2)}</p>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium mt-1 inline-block ${statusBadge[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                      {sub.status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
          }
        </div>

        {!isLoading && submissions.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">No submissions found.</p>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button disabled={!pagination.hasPrevPage} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40">Previous</button>
              <button disabled={!pagination.hasNextPage} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── WalletPage.jsx ────────────────────────────────────────────────────────────
export function WalletPage() {
  const [page, setPage] = useState(1);

  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => walletAPI.summary().then(r => r.data.data),
  });

  const { data: txData, isLoading } = useQuery({
    queryKey: ['transactions', page],
    queryFn: () => walletAPI.transactions({ page, limit: 20 }).then(r => r.data),
    placeholderData: (previousData) => previousData,
  });

  const wallet = walletData?.wallet || {};
  const transactions = txData?.data || [];
  const pagination = txData?.pagination || {};

  const txColor = {
    submission_reward: 'text-green-600',
    validation_reward: 'text-green-600',
    bonus: 'text-blue-600',
    withdrawal: 'text-red-600',
    penalty: 'text-red-600',
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Wallet</h1>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Available', value: `$${(wallet.balance || 0).toFixed(2)}`, main: true },
            { label: 'Total Earned', value: `$${(wallet.totalEarned || 0).toFixed(2)}` },
            { label: 'Withdrawn', value: `$${(wallet.totalWithdrawn || 0).toFixed(2)}` },
          ].map(({ label, value, main }) => (
            <div key={label} className={`rounded-xl border p-4 ${main ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-200'}`}>
              <p className={`text-xs mb-1 ${main ? 'text-indigo-200' : 'text-gray-500'}`}>{label}</p>
              <p className={`text-xl font-bold ${main ? 'text-white' : 'text-gray-900'}`}>{value}</p>
            </div>
          ))}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-50">
            {isLoading
              ? [...Array(5)].map((_, i) => (
                  <div key={i} className="p-4 animate-pulse flex justify-between">
                    <div className="h-4 bg-gray-100 rounded w-1/3" />
                    <div className="h-4 bg-gray-100 rounded w-16" />
                  </div>
                ))
              : transactions.map(tx => (
                  <div key={tx._id} className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(tx.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`font-semibold text-sm ${txColor[tx.type] || 'text-gray-600'}`}>
                      {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(3)}
                    </span>
                  </div>
                ))
            }
          </div>
          {!isLoading && transactions.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No transactions yet.</div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// ── AdminSubmissions.jsx ─────────────────────────────────────────────────────
export function AdminSubmissions() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-submissions', page, statusFilter],
    queryFn: () => submissionAPI.getAll({ page, limit: 20, status: statusFilter || undefined }).then(r => r.data),
    placeholderData: (previousData) => previousData,
  });

  const submissions = data?.data || [];
  const pagination = data?.pagination || {};

  const statusBadge = {
    pending: 'bg-yellow-100 text-yellow-700',
    under_review: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
          <p className="text-gray-500 text-sm mt-1">All dataset submissions across all tasks</p>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {['', 'pending', 'under_review', 'accepted', 'rejected'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {s ? s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'All'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Task</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Contributor</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Validations</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Rating</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[1,2,3,4,5,6].map(j => (
                        <td key={j} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded" /></td>
                      ))}
                    </tr>
                  ))
                : submissions.map(sub => (
                    <tr key={sub._id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-medium text-gray-900 max-w-xs truncate">{sub.task?.title}</td>
                      <td className="px-4 py-4 text-gray-600">{sub.contributor?.name}</td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                          {sub.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-gray-600">{sub.validationCount || 0}</td>
                      <td className="px-4 py-4 text-gray-600">{sub.avgRating > 0 ? `★ ${sub.avgRating}` : '—'}</td>
                      <td className="px-4 py-4 text-gray-400 text-xs">{new Date(sub.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
          {!isLoading && submissions.length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">No submissions found</div>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button disabled={!pagination.hasPrevPage} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40">Previous</button>
              <button disabled={!pagination.hasNextPage} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── NotFound.jsx ─────────────────────────────────────────────────────────────
export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
        <p className="text-gray-600 mb-6">Page not found</p>
        <a href="/" className="text-indigo-600 font-medium hover:underline">Go back home</a>
      </div>
    </div>
  );
}

// Export wallet API used in WalletPage
import { walletAPI } from '../services/api';

export default TaskDetail;
