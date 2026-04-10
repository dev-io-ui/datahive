import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { taskAPI, submissionAPI } from '../services/api';
import Layout from '../components/shared/Layout';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Zap, ClipboardList, CheckCircle, XCircle, DollarSign, Mic, Type, Image } from 'lucide-react';

const typeIcon = { audio: Mic, text: Type, image: Image };
const typeColor = {
  audio: 'bg-purple-100 text-purple-700',
  text: 'bg-blue-100 text-blue-700',
  image: 'bg-orange-100 text-orange-700',
};
const statusColor = {
  pending: 'bg-yellow-100 text-yellow-700',
  under_review: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

export default function ContributorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isGettingTask, setIsGettingTask] = useState(false);

  const { data: submissionsData } = useQuery(
    ['my-submissions'],
    () => submissionAPI.mySubmissions({ limit: 5 }).then(r => r.data.data),
    { staleTime: 30000 }
  );

  const getTaskMutation = useMutation(
    () => taskAPI.assign(),
    {
      onSuccess: ({ data }) => {
        const { task, assignment } = data.data;
        toast.success(`Got it! You have ${Math.round((new Date(assignment.lockExpiry) - Date.now()) / 60000)} minutes to complete this task.`);
        navigate(`/tasks/${task._id}`, { state: { assignment } });
      },
    }
  );

  const stats = user?.contributorStats || {};
  const wallet = user?.wallet || {};

  const statCards = [
    { label: 'Total Earnings', value: `$${(wallet.totalEarned || 0).toFixed(2)}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Available Balance', value: `$${(wallet.balance || 0).toFixed(2)}`, icon: DollarSign, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Total Submitted', value: stats.totalSubmissions || 0, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Acceptance Rate', value: `${stats.acceptanceRate || 0}%`, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name?.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 mt-1 text-sm">Ready to earn? Grab a task and start contributing.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Get Task CTA */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-8 text-white mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold">Ready to work?</h2>
              <p className="text-indigo-200 mt-1 text-sm">
                Get assigned a task automatically. Complete it within the time limit to earn.
              </p>
            </div>
            <button
              onClick={() => getTaskMutation.mutate()}
              disabled={getTaskMutation.isLoading}
              className="flex items-center gap-2 bg-white text-indigo-700 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-indigo-50 disabled:opacity-60 transition shadow-sm"
            >
              <Zap size={18} />
              {getTaskMutation.isLoading ? 'Finding task...' : 'Get a Task'}
            </button>
          </div>
        </div>

        {/* Recent submissions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Submissions</h2>
            <a href="/submissions" className="text-sm text-indigo-600 hover:underline">View all →</a>
          </div>

          {submissionsData?.length > 0 ? (
            <div className="space-y-3">
              {submissionsData.map((sub) => {
                const Icon = typeIcon[sub.task?.type] || ClipboardList;
                return (
                  <div key={sub._id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${typeColor[sub.task?.type] || 'bg-gray-100 text-gray-600'}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{sub.task?.title}</p>
                      <p className="text-xs text-gray-400">{new Date(sub.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">
                        ${sub.task?.pricePerTask?.toFixed(2)}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[sub.status]}`}>
                        {sub.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <ClipboardList size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No submissions yet. Get your first task above!</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
