import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { User as UserIcon, Mail, Phone, Save, Trash2, Edit2, X } from 'lucide-react';
import Layout from '../components/shared/Layout'; // adjust path to match your project
import { useAuth } from '../context/AuthContext'; // adjust path to match your project
import { profileAPI } from '../services/api';

const roleBadgeColor = {
  admin: 'bg-purple-100 text-purple-700',
  validator: 'bg-blue-100 text-blue-700',
  contributor: 'bg-green-100 text-green-700',
};

export default function Profile() {
  const { logout, setUser } = useAuth(); // setUser optional — see note below
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchProfile();
    
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await profileAPI.get();
      const data = res.data.data; // sendSuccess shape: { success, data, message }
      setProfile(data);
      setForm({ name: data.name || '', email: data.email || '', phone: data.phone || '' });
    } catch (err) {
      // global interceptor already toasts the error
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await profileAPI.update(form);
      const updated = res.data.data;
      setProfile(updated);
      if (typeof setUser === 'function') setUser(updated); // keep AuthContext in sync, if supported
      setEditing(false);
      toast.success('Profile updated successfully');
    } catch (err) {
      // global interceptor already toasts the error
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ name: profile.name || '', email: profile.email || '', phone: profile.phone || '' });
    setEditing(false);
  };

  const handleDelete = async () => {
    try {
      await profileAPI.deleteAccount();
      toast.success('Account deleted');
      await logout();
      navigate('/login');
    } catch (err) {
      // global interceptor already toasts the error
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
          Loading profile...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">My Profile</h1>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xl">
                {profile?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-900">{profile?.name}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadgeColor[profile?.role]}`}>
                  {profile?.role}
                </span>
              </div>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Edit2 size={16} /> Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <div className="relative">
                <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  disabled={!editing}
                  required
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  disabled={!editing}
                  required
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  disabled={!editing}
                  placeholder="Not set"
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {editing && (
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <Save size={16} /> {saving ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <X size={16} /> Cancel
                </button>
              </div>
            )}
          </form>
        </div>

        <div className="mt-6 bg-white rounded-xl border border-red-100 p-6">
          <h2 className="text-sm font-semibold text-red-600 mb-1">Danger zone</h2>
          <p className="text-sm text-gray-500 mb-4">
            Deleting your account is permanent and cannot be undone.
          </p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} /> Delete account
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">Are you sure?</span>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}