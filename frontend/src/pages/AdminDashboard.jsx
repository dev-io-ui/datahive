import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { adminAPI } from '../services/api';
import Layout from '../components/shared/Layout';
import {
  Users, ClipboardList, CheckCircle, DollarSign,
  TrendingUp, FileText, Activity, ArrowRight
} from 'lucide-react';

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery(
    ['admin-dashboard'],
    () => adminAPI.dashboard().then(r => r.data.data),
    { staleTime: 60000 }
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-4" />
              <div className="h-7 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  const { taskStats, submissionStats, userStats, revenueStats } = data || {};

  const totalTasks = taskStats?.total || 0;
  const activeTasks = taskStats?.byStatus?.active?.count || 0;
  const totalSubmissions = submissionStats?.total || 0;
  const acceptanceRate = submissionStats?.acceptanceRate || 0;
  const totalUsers = userStats?.total || 0;
  const activeUsers = userStats?.activeThisWeek || 0;
  const totalPaidOut = revenueStats?.totalPaidOut || 0;

  const dailyData = submissionStats?.dailyTrend || [];

  const quickLinks = [
    { label: 'Manage Tasks', desc: 'Create, edit, and monitor tasks', href: '/admin/tasks', icon: FileText, color: 'bg-indigo-500' },
    { label: 'Manage Users', desc: 'View contributors and validators', href: '/admin/users', icon: Users, color: 'bg-emerald-500' },
    { label: 'All Submissions', desc: 'Review and export datasets', href: '/admin/submissions', icon: ClipboardList, color: 'bg-amber-500' },
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Platform overview and analytics</p>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Tasks" value={totalTasks} sub={`${activeTasks} active`} icon={FileText} color="bg-indigo-500" />
          <StatCard label="Total Submissions" value={totalSubmissions} sub={`${acceptanceRate}% acceptance`} icon={ClipboardList} color="bg-blue-500" />
          <StatCard label="Total Users" value={totalUsers} sub={`${activeUsers} active this week`} icon={Users} color="bg-emerald-500" />
          <StatCard label="Total Paid Out" value={`$${totalPaidOut.toFixed(2)}`} sub="to contributors & validators" icon={DollarSign} color="bg-amber-500" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
          {/* Submission trend */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Submissions — Last 30 Days</h2>
            {dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="_id" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#subGrad)" name="Total" />
                  <Area type="monotone" dataKey="accepted" stroke="#10b981" strokeWidth={2} fill="none" name="Accepted" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            )}
          </div>

          {/* Submission status breakdown */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Submission Status</h2>
            <div className="space-y-3">
              {Object.entries(submissionStats?.byStatus || {}).map(([status, count]) => {
                const colors = {
                  pending: 'bg-yellow-400',
                  under_review: 'bg-blue-400',
                  accepted: 'bg-green-400',
                  rejected: 'bg-red-400',
                };
                const pct = totalSubmissions > 0 ? Math.round((count / totalSubmissions) * 100) : 0;
                return (
                  <div key={status}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span className="capitalize">{status.replace('_', ' ')}</span>
                      <span>{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[status] || 'bg-gray-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* User breakdown */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Users by Role</h3>
              {Object.entries(userStats?.byRole || {}).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between text-sm py-1">
                  <span className="capitalize text-gray-600">{role}s</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickLinks.map(({ label, desc, href, icon: Icon, color }) => (
            <Link
              key={href}
              to={href}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition group"
            >
              <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}>
                <Icon size={18} className="text-white" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">{label}</h3>
              <p className="text-xs text-gray-500 mt-1">{desc}</p>
              <div className="mt-3 text-indigo-600 text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                Go to {label} <ArrowRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
