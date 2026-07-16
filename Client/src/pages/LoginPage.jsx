import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';

const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";
const errorClass = "text-red-500 text-xs mt-1";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (data) => {
    const user = await login(data);
    const paths = { admin: '/admin', validator: '/validator', contributor: '/dashboard' };
    navigate(paths[user.role] || '/dashboard');
  };

  return (
    // <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4">
    //   <div className="w-full max-w-md">
    <div className="min-h-screen grid lg:grid-cols-2">
        <div className="hidden lg:flex relative overflow-hidden items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-[#2d1b69]">

        {/* Glow */}
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-indigo-500/30 blur-[180px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-violet-500/30 blur-[180px]" />

        {/* Grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />

        {/* Floating Words */}

        <span className="absolute top-24 left-20 rotate-[-10deg] text-indigo-300/70 text-lg font-medium animate-float">
          Dataset
        </span>

        <span className="absolute top-32 right-24 rotate-6 text-violet-300/70 text-xl font-semibold animate-float">
          AI
        </span>

        <span className="absolute top-56 left-10 rotate-[-12deg] text-cyan-300/70 text-base animate-float">
          OCR
        </span>

        <span className="absolute top-52 right-16 rotate-12 text-indigo-200/70 text-lg animate-float">
          Annotation
        </span>

        <span className="absolute bottom-36 left-12 rotate-6 text-violet-300/70 text-lg animate-float">
          Bounding Box
        </span>

        <span className="absolute bottom-32 right-10 rotate-[-8deg] text-cyan-300/70 text-lg animate-float">
          Segmentation
        </span>

        <span className="absolute bottom-14 left-14 rotate-[8deg] text-indigo-200/70 text-lg animate-float">
          Classification
        </span>

        <span className="absolute bottom-16 right-32 rotate-[-12deg] text-violet-200/70 text-lg animate-float">
          Validation
        </span>

        {/* Main */}

        <div className="relative z-20 text-center">

          <div className="inline-flex items-center rounded-full border border-indigo-400/20 bg-indigo-500/10 px-5 py-2 backdrop-blur-xl">
            <span className="text-indigo-200">
              AI Powered Dataset Platform
            </span>
          </div>

          <h1 className="mt-10 text-7xl font-black leading-none tracking-tight">

            <span className="block text-white drop-shadow-[0_0_25px_rgba(255,255,255,.2)]">
              Create
            </span>

            <span className="block bg-gradient-to-r from-indigo-300 via-white to-violet-300 bg-clip-text text-transparent">
              Intelligent
            </span>

            <span className="block text-white">
              Datasets
            </span>

          </h1>

          <p className="mt-8 text-lg text-slate-300">
            Powered by AI • Built by Humans
          </p>

        </div>

      </div>
      {/* right SIDE */}
      <div className="flex items-center justify-center bg-white px-8 py-12">

        <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">DH</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sign in to DataHive</h1>
          <p className="text-gray-500 mt-1 text-sm">The dataset creation platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                className={inputClass}
                placeholder="you@example.com"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && <p className={errorClass}>{errors.email.message}</p>}
            </div>

            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                className={inputClass}
                placeholder="••••••••"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && <p className={errorClass}>{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition text-sm"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 font-medium hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
    </div>
  );
}

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { role: 'contributor' }
  });

  const onSubmit = async (data) => {
    await registerUser(data);
    navigate('/dashboard');
  };

  return (
    // <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4 py-10">
    //   <div className="w-full max-w-md">
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* LEFT SIDE */}
      <div className="flex items-center justify-center bg-white px-8 py-12">

        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl font-bold">DH</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-500 mt-1 text-sm">Start contributing or validating data</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className={labelClass}>Full name</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Jane Smith"
                  {...register('name', { required: 'Name is required' })}
                />
                {errors.name && <p className={errorClass}>{errors.name.message}</p>}
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  className={inputClass}
                  placeholder="you@example.com"
                  {...register('email', { required: 'Email is required' })}
                />
                {errors.email && <p className={errorClass}>{errors.email.message}</p>}
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  className={inputClass}
                  placeholder="Min 8 characters"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Minimum 8 characters' },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                      message: 'Must include uppercase, lowercase, and a number'
                    }
                  })}
                />
                {errors.password && <p className={errorClass}>{errors.password.message}</p>}
              </div>

              <div>
                <label className={labelClass}>I want to</label>
                <div className="grid grid-cols-2 gap-3">
                  {['contributor', 'validator'].map((role) => (
                    <label
                      key={role}
                      className={`border rounded-lg p-3 cursor-pointer transition text-sm ${watch('role') === role
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                    >
                      <input type="radio" value={role} className="sr-only" {...register('role')} />
                      <div className="font-medium capitalize">{role}</div>
                      <div className="text-xs mt-0.5 text-gray-500">
                        {role === 'contributor' ? 'Complete tasks, earn money' : 'Review & approve submissions'}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition text-sm"
              >
                {isSubmitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      <div className="hidden lg:flex relative overflow-hidden items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-[#2d1b69]">

        {/* Glow */}
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-indigo-500/30 blur-[180px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-violet-500/30 blur-[180px]" />

        {/* Grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />

        {/* Floating Words */}

        <span className="absolute top-24 left-20 rotate-[-10deg] text-indigo-300/70 text-lg font-medium animate-float">
          Dataset
        </span>

        <span className="absolute top-32 right-24 rotate-6 text-violet-300/70 text-xl font-semibold animate-float">
          AI
        </span>

        <span className="absolute top-56 left-10 rotate-[-12deg] text-cyan-300/70 text-base animate-float">
          OCR
        </span>

        <span className="absolute top-52 right-16 rotate-12 text-indigo-200/70 text-lg animate-float">
          Annotation
        </span>

        <span className="absolute bottom-44 left-16 rotate-6 text-violet-300/70 text-lg animate-float">
          Bounding Box
        </span>

        <span className="absolute bottom-32 right-10 rotate-[-8deg] text-cyan-300/70 text-lg animate-float">
          Segmentation
        </span>

        <span className="absolute bottom-20 left-40 rotate-[8deg] text-indigo-200/70 text-lg animate-float">
          Classification
        </span>

        <span className="absolute bottom-16 right-32 rotate-[-12deg] text-violet-200/70 text-lg animate-float">
          Validation
        </span>

        {/* Main */}

        <div className="relative z-20 text-center">

          <div className="inline-flex items-center rounded-full border border-indigo-400/20 bg-indigo-500/10 px-5 py-2 backdrop-blur-xl">
            <span className="text-indigo-200">
              AI Powered Dataset Platform
            </span>
          </div>

          <h1 className="mt-10 text-7xl font-black leading-none tracking-tight">

            <span className="block text-white drop-shadow-[0_0_25px_rgba(255,255,255,.2)]">
              Create
            </span>

            <span className="block bg-gradient-to-r from-indigo-300 via-white to-violet-300 bg-clip-text text-transparent">
              Intelligent
            </span>

            <span className="block text-white">
              Datasets
            </span>

          </h1>

          <p className="mt-8 text-lg text-slate-300">
            Powered by AI • Built by Humans
          </p>

        </div>

      </div>
    </div>

  );
}

export default LoginPage;
