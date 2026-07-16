// ── AdminUsers.jsx ────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../services/api';
import Layout from '../components/shared/Layout';
import toast from 'react-hot-toast';
import { Search, Shield, UserCheck, UserX } from 'lucide-react';

export default function AdminUsers() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

 const { data, isLoading } = useQuery({
  queryKey: ['admin-users', page, search, roleFilter],
  queryFn: () =>
    adminAPI
      .users({
        page,
        limit: 20,
        search: search || undefined,
        role: roleFilter || undefined,
      })
      .then((r) => r.data),

  placeholderData: (previousData) => previousData,
});

const statusMutation = useMutation({
  mutationFn: ({ id, status }) => adminAPI.updateStatus(id, status),

  onSuccess: () => {
    toast.success('User status updated');

    qc.invalidateQueries({
      queryKey: ['admin-users'],
    });
  },
});

const roleMutation = useMutation({
  mutationFn: ({ id, role }) => adminAPI.updateRole(id, role),

  onSuccess: () => {
    toast.success('User role updated');

    qc.invalidateQueries({
      queryKey: ['admin-users'],
    });
  },
});
  const users = data?.data || [];
  const pagination = data?.pagination || {};

  const roleBadge = {
    admin: 'bg-purple-100 text-purple-700',
    validator: 'bg-blue-100 text-blue-700',
    contributor: 'bg-green-100 text-green-700',
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-1">Manage contributors and validators</p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            {['', 'contributor', 'validator', 'admin'].map(r => (
              <button
                key={r}
                onClick={() => { setRoleFilter(r); setPage(1); }}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  roleFilter === r ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r ? r.charAt(0).toUpperCase() + r.slice(1) : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Earned</th>
                <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Submissions</th>
                <th className="text-right px-5 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wide">Actions</th>
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
                : users.map(user => (
                    <tr key={user._id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-semibold flex-shrink-0">
                            {user.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{user.name}</div>
                            <div className="text-xs text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleBadge[user.role]}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium text-gray-900">
                        ${(user.wallet?.totalEarned || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        {user.contributorStats?.totalSubmissions || 0}
                        {user.contributorStats?.totalSubmissions > 0 && (
                          <span className="text-gray-400"> ({user.contributorStats?.acceptanceRate || 0}%)</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle suspend */}
                          {user.status === 'active' ? (
                            <button
                              onClick={() => statusMutation.mutate({ id: user._id, status: 'suspended' })}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Suspend user"
                            >
                              <UserX size={15} />
                            </button>
                          ) : (
                            <button
                              onClick={() => statusMutation.mutate({ id: user._id, status: 'active' })}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                              title="Activate user"
                            >
                              <UserCheck size={15} />
                            </button>
                          )}
                          {/* Role change */}
                          {user.role !== 'admin' && (
                            <select
                              value={user.role}
                              onChange={e => roleMutation.mutate({ id: user._id, role: e.target.value })}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="contributor">Contributor</option>
                              <option value="validator">Validator</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>

          {!isLoading && users.length === 0 && (
            <div className="py-16 text-center text-gray-400 text-sm">No users found</div>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">
              {pagination.total} users · Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button disabled={!pagination.hasPrevPage} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Previous</button>
              <button disabled={!pagination.hasNextPage} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
