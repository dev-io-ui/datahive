import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { submissionAPI } from '../services/api';
import Layout from '../components/shared/Layout';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  CheckCircle, XCircle, Star, Clock, Zap, Mic, Type, Image,
  ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react';

const typeIcon = { audio: Mic, text: Type, image: Image };

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`transition ${star <= value ? 'text-amber-400' : 'text-gray-200 hover:text-amber-200'}`}
        >
          <Star size={22} fill={star <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

export default function ValidatorDashboard() {
  const { user, refreshUser } = useAuth();
  const qc = useQueryClient();

  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [decision, setDecision] = useState(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewStarted, setReviewStarted] = useState(null);

 const { data: myValidations, isLoading: historyLoading } = useQuery({
  queryKey: ['my-validations'],
  queryFn: () =>
    submissionAPI
      .myValidations({ limit: 5 })
      .then((r) => r.data.data),

  staleTime: 30000,
});

const getSubmissionMutation = useMutation({
  mutationFn: () => submissionAPI.assignForReview(),

  onSuccess: ({ data }) => {
    setCurrentAssignment(data.data);
    setDecision(null);
    setRating(0);
    setFeedback('');
    setRejectionReason('');
    setReviewStarted(new Date());

    toast.success('Submission assigned! Take your time to review.');
  },
});

const submitValidationMutation = useMutation({
  mutationFn: (payload) => submissionAPI.validate(payload),

  onSuccess: ({ data }) => {
    toast.success(`Submission ${decision}ed! Reward credited to your wallet.`);

    setCurrentAssignment(null);
    setDecision(null);
    setRating(0);
    setFeedback('');

    qc.invalidateQueries({
      queryKey: ['my-validations'],
    });

    refreshUser();
  },
});

  const handleSubmitValidation = () => {
    if (!decision) return toast.error('Please select Accept or Reject');
    if (!rating) return toast.error('Please provide a rating');
    if (decision === 'reject' && !rejectionReason) return toast.error('Please select a rejection reason');

    submitValidationMutation.mutate({
      assignmentId: currentAssignment.assignment._id,
      decision,
      rating,
      feedback,
      rejectionReason: decision === 'reject' ? rejectionReason : undefined,
    });
  };

  const stats = user?.validatorStats || {};
  const wallet = user?.wallet || {};

  const submission = currentAssignment?.submission;
  const task = currentAssignment?.task;
  const TypeIcon = task ? typeIcon[task.type] : null;

  const timeLeft = currentAssignment?.assignment?.lockExpiry
    ? Math.max(0, Math.round((new Date(currentAssignment.assignment.lockExpiry) - Date.now()) / 60000))
    : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="text-gray-500 mt-1 text-sm">Review submissions carefully — your decisions affect contributor earnings.</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Reviews', value: stats.totalValidations || 0 },
            { label: 'Total Earned', value: `$${(wallet.totalEarned || 0).toFixed(2)}` },
            { label: 'Balance', value: `$${(wallet.balance || 0).toFixed(2)}` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Active review card */}
        {currentAssignment ? (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {TypeIcon && (
                  <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <TypeIcon size={16} className="text-indigo-600" />
                  </div>
                )}
                <div>
                  <h2 className="font-semibold text-gray-900 text-sm">{task?.title}</h2>
                  <p className="text-xs text-gray-400 capitalize">{task?.type} task</p>
                </div>
              </div>
              {timeLeft !== null && (
                <div className={`flex items-center gap-1.5 text-sm font-medium ${timeLeft < 5 ? 'text-red-600' : 'text-amber-600'}`}>
                  <Clock size={15} />
                  {timeLeft}m left
                </div>
              )}
            </div>

            {/* Submission content */}
            <div className="p-6 border-b border-gray-100">
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Task Instructions</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{task?.instructions}</p>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Submission</p>
                {task?.type === 'text' ? (
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap">
                    {submission?.content?.text || '(no text content)'}
                  </div>
                ) : task?.type === 'audio' ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <audio controls className="w-full" src={submission?.content?.fileUrl}>
                      Your browser does not support audio.
                    </audio>
                    {submission?.content?.duration && (
                      <p className="text-xs text-gray-400 mt-2">Duration: {submission.content.duration}s</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <img
                      src={submission?.content?.fileUrl}
                      alt="Submission"
                      className="max-h-64 mx-auto rounded-lg object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Decision panel */}
            <div className="p-6 space-y-5">
              {/* Accept / Reject buttons */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Your Decision</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDecision('accept')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition ${
                      decision === 'accept'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-green-300 hover:bg-green-50'
                    }`}
                  >
                    <CheckCircle size={18} />
                    Accept
                  </button>
                  <button
                    onClick={() => setDecision('reject')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition ${
                      decision === 'reject'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-600 hover:border-red-300 hover:bg-red-50'
                    }`}
                  >
                    <XCircle size={18} />
                    Reject
                  </button>
                </div>
              </div>

              {/* Rejection reason */}
              {decision === 'reject' && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Rejection Reason</p>
                  <select
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select reason...</option>
                    <option value="poor_quality">Poor quality</option>
                    <option value="incorrect_format">Incorrect format</option>
                    <option value="off_topic">Off topic</option>
                    <option value="duplicate">Duplicate</option>
                    <option value="technical_issue">Technical issue</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              {/* Rating */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Quality Rating</p>
                <StarRating value={rating} onChange={setRating} />
              </div>

              {/* Feedback */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Feedback <span className="text-gray-400 font-normal">(optional)</span></p>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Provide helpful feedback to the contributor..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmitValidation}
                disabled={submitValidationMutation.isLoading || !decision || !rating}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitValidationMutation.isLoading ? 'Submitting...' : 'Submit Review'}
              </button>

              <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                <AlertTriangle size={12} />
                Reward: ${currentAssignment.assignment?.rewardAmount?.toFixed(3)} upon completion
              </p>
            </div>
          </div>
        ) : (
          /* Get submission CTA */
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-8 text-white mb-8 text-center">
            <CheckCircle size={40} className="mx-auto mb-3 text-indigo-300" />
            <h2 className="text-xl font-bold">Ready to review?</h2>
            <p className="text-indigo-200 text-sm mt-1 mb-5">
              Get assigned a submission and help maintain dataset quality.
            </p>
            <button
              onClick={() => getSubmissionMutation.mutate()}
              disabled={getSubmissionMutation.isLoading}
              className="inline-flex items-center gap-2 bg-white text-indigo-700 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-indigo-50 disabled:opacity-60 transition"
            >
              <Zap size={18} />
              {getSubmissionMutation.isLoading ? 'Finding submission...' : 'Get Submission to Review'}
            </button>
          </div>
        )}

        {/* Recent validation history */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Reviews</h2>
          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : myValidations?.length > 0 ? (
            <div className="space-y-3">
              {myValidations.map((va) => (
                <div key={va._id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    va.decision === 'accept' ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    {va.decision === 'accept'
                      ? <CheckCircle size={16} className="text-green-600" />
                      : <XCircle size={16} className="text-red-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{va.task?.title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={11}
                          className={i < va.rating ? 'text-amber-400' : 'text-gray-200'}
                          fill={i < va.rating ? 'currentColor' : 'none'}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">+${va.rewardAmount?.toFixed(3)}</p>
                    <p className="text-xs text-gray-400">{new Date(va.completedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <CheckCircle size={28} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No reviews yet. Get your first submission above.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
