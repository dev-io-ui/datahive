import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import Layout from '../components/shared/Layout';
import toast from 'react-hot-toast';
import { Wallet, ArrowDownToLine, Clock, CheckCircle2, XCircle, Smartphone, Building2, AlertCircle, X } from 'lucide-react';

// const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';
const API =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

const authH = () => ({ Authorization: 'Bearer ' + localStorage.getItem('accessToken') });

const walletAPI = {
  summary: () => axios.get(API + '/wallet', { headers: authH() }),
  transactions: (p) => axios.get(API + '/wallet/transactions', { headers: authH(), params: p }),
};
const withdrawAPI = {
  request: (d) => axios.post(API + '/withdrawals', d, { headers: authH() }),
  cancel: (id) => axios.delete(API + '/withdrawals/' + id, { headers: authH() }),
  myList: (p) => axios.get(API + '/withdrawals/my', { headers: authH(), params: p }),
};

const txColor = {
  submission_reward: 'text-green-600 bg-green-50',
  validation_reward: 'text-green-600 bg-green-50',
  bonus: 'text-blue-600 bg-blue-50',
  withdrawal: 'text-red-600 bg-red-50',
  withdrawal_reversal: 'text-amber-600 bg-amber-50',
  penalty: 'text-red-600 bg-red-50',
};
const txLabel = {
  submission_reward: 'Submission Reward',
  validation_reward: 'Validation Reward',
  bonus: 'Bonus', withdrawal: 'Withdrawal',
  withdrawal_reversal: 'Refunded', penalty: 'Penalty', adjustment: 'Adjustment',
};
const statusBadge = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function WithdrawModal({ balance, onClose, onSuccess }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({ defaultValues: { payoutMethod: 'upi' } });
  const method = watch('payoutMethod');
  const inp = "w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const lbl = "block text-sm font-medium text-gray-700 mb-1.5";

  const onSubmit = async (data) => {
    const payload = {
      amount: parseFloat(data.amount),
      payoutMethod: data.payoutMethod,
      ...(data.payoutMethod === 'upi'
        ? { upiId: data.upiId }
        : { bankAccount: { accountNumber: data.accountNumber, ifsc: data.ifsc.toUpperCase(), accountHolderName: data.accountHolderName, bankName: data.bankName } })
    };
    await withdrawAPI.request(payload);
    toast.success('Withdrawal request submitted!');
    onSuccess();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Withdraw Earnings</h2>
            <p className="text-xs text-gray-400 mt-0.5">Available: Rs.{balance?.toFixed(2)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          <div>
            <label className={lbl}>Amount (Rs.)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">Rs.</span>
              <input type="number" step="0.01" min="10" max={balance} className={inp + " pl-10"} placeholder="100.00"
                {...register('amount', { required: 'Required', min: { value: 10, message: 'Minimum Rs.10' }, max: { value: balance, message: 'Exceeds balance' }, valueAsNumber: true })} />
            </div>
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
          </div>

          <div>
            <label className={lbl}>Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: 'upi', icon: Smartphone, label: 'UPI', sub: 'Instant' }, { value: 'bank_transfer', icon: Building2, label: 'Bank Transfer', sub: 'NEFT / IMPS' }].map(({ value, icon: Icon, label, sub }) => (
                <label key={value} className={'border-2 rounded-xl p-3 cursor-pointer transition ' + (method === value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300')}>
                  <input type="radio" value={value} className="sr-only" {...register('payoutMethod')} />
                  <Icon size={18} className={method === value ? 'text-indigo-600 mb-1' : 'text-gray-400 mb-1'} />
                  <div className={'text-sm font-medium ' + (method === value ? 'text-indigo-700' : 'text-gray-700')}>{label}</div>
                  <div className="text-xs text-gray-400">{sub}</div>
                </label>
              ))}
            </div>
          </div>

          {method === 'upi' && (
            <div>
              <label className={lbl}>UPI ID</label>
              <input className={inp} placeholder="yourname@upi or 9876543210@paytm" {...register('upiId', { required: 'UPI ID required' })} />
              {errors.upiId && <p className="text-red-500 text-xs mt-1">{errors.upiId.message}</p>}
              <p className="text-xs text-gray-400 mt-1.5">Works with GPay, PhonePe, Paytm, BHIM, any UPI app</p>
            </div>
          )}

          {method === 'bank_transfer' && (
            <div className="space-y-3">
              <div>
                <label className={lbl}>Account Holder Name</label>
                <input className={inp} placeholder="As per bank records" {...register('accountHolderName', { required: true })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Account Number</label>
                  <input className={inp} placeholder="12-digit number" {...register('accountNumber', { required: true })} />
                </div>
                <div>
                  <label className={lbl}>IFSC Code</label>
                  <input className={inp} placeholder="SBIN0001234" {...register('ifsc', { required: true, pattern: { value: /^[A-Z]{4}0[A-Z0-9]{6}$/i, message: 'Invalid IFSC' } })} />
                  {errors.ifsc && <p className="text-red-500 text-xs mt-1">{errors.ifsc.message}</p>}
                </div>
              </div>
              <div>
                <label className={lbl}>Bank Name</label>
                <input className={inp} placeholder="State Bank of India" {...register('bankName')} />
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">Amount is deducted immediately. Processed within 1-2 business days after admin approval.</p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const qc = useQueryClient();
  const [txPage, setTxPage] = useState(1);
  const [activeTab, setActiveTab] = useState('transactions');
  const [showWithdraw, setShowWithdraw] = useState(false);

const { data: walletData, refetch } = useQuery({
  queryKey: ['wallet'],
  queryFn: () => walletAPI.summary().then((r) => r.data.data),
});

const { data: txData, isLoading: txLoading } = useQuery({
  queryKey: ['transactions', txPage],
  queryFn: () =>
    walletAPI
      .transactions({
        page: txPage,
        limit: 15,
      })
      .then((r) => r.data),

  placeholderData: (previousData) => previousData,
});

const { data: wdData, isLoading: wdLoading } = useQuery({
  queryKey: ['my-withdrawals'],
  queryFn: () =>
    withdrawAPI
      .myList({
        page: 1,
        limit: 20,
      })
      .then((r) => r.data),
});

const cancelMutation = useMutation({
  mutationFn: (id) => withdrawAPI.cancel(id),

  onSuccess: () => {
    toast.success('Cancelled. Amount refunded.');

    qc.invalidateQueries({
      queryKey: ['my-withdrawals'],
    });

    refetch();
  },
});

  const wallet = walletData?.wallet || {};
  const transactions = txData?.data || [];
  const withdrawals = wdData?.data || [];
  const txPag = txData?.pagination || {};

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Wallet & Payments</h1>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={16} className="text-indigo-300" />
              <span className="text-sm text-indigo-200">Available Balance</span>
            </div>
            <div className="text-3xl font-bold mb-4">Rs.{(wallet.balance || 0).toFixed(2)}</div>
            <button onClick={() => setShowWithdraw(true)} disabled={(wallet.balance || 0) < 10}
              className="flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition w-full">
              <ArrowDownToLine size={15} /> Withdraw
            </button>
          </div>
          <div className="space-y-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Total Earned</p>
              <p className="text-xl font-bold text-gray-900">Rs.{(wallet.totalEarned || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Total Withdrawn</p>
              <p className="text-xl font-bold text-gray-900">Rs.{(wallet.totalWithdrawn || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {(wallet.balance || 0) < 10 && (wallet.balance || 0) > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5 flex items-center gap-2 text-sm text-amber-700">
            <AlertCircle size={15} className="flex-shrink-0" />
            Minimum withdrawal is Rs.10. Keep earning!
          </div>
        )}

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
          {[{ id: 'transactions', label: 'Transactions' }, { id: 'withdrawals', label: 'Withdrawals' }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={'flex-1 text-sm font-medium py-2 rounded-lg transition ' + (activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'transactions' && (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-50">
            {txLoading ? [...Array(5)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg" />
                  <div><div className="h-4 bg-gray-100 rounded w-32 mb-1" /><div className="h-3 bg-gray-100 rounded w-20" /></div>
                </div>
                <div className="h-5 bg-gray-100 rounded w-16" />
              </div>
            )) : transactions.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">No transactions yet.</div>
            ) : transactions.map(tx => (
              <div key={tx._id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm ' + (txColor[tx.type] || 'text-gray-600 bg-gray-50')}>
                    {tx.amount > 0 ? '+' : '-'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{txLabel[tx.type] || tx.type}</p>
                    <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={'font-semibold text-sm ' + (tx.amount > 0 ? 'text-green-600' : 'text-red-600')}>
                    {tx.amount > 0 ? '+' : ''}Rs.{Math.abs(tx.amount).toFixed(2)}
                  </p>
                  {tx.balanceAfter != null && <p className="text-xs text-gray-400">Bal: Rs.{tx.balanceAfter.toFixed(2)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="space-y-3">
            {wdLoading ? [...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-20" />
            )) : withdrawals.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No withdrawal requests yet.</div>
            ) : withdrawals.map(wd => (
              <div key={wd._id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900">Rs.{wd.amount.toFixed(2)}</span>
                  <span className={'text-xs px-2.5 py-1 rounded-full font-medium capitalize ' + (statusBadge[wd.status] || 'bg-gray-100 text-gray-500')}>{wd.status}</span>
                </div>
                <p className="text-xs text-gray-400">{wd.payoutMethod === 'upi' ? 'UPI: ' + wd.upiId : 'Bank: ****' + wd.bankAccount?.accountNumber?.slice(-4)}</p>
                <p className="text-xs text-gray-400">{new Date(wd.createdAt).toLocaleString()}</p>
                {wd.razorpay?.utr && <p className="text-xs text-green-600 mt-1 font-mono">UTR: {wd.razorpay.utr}</p>}
                {wd.razorpay?.failureReason && <p className="text-xs text-red-500 mt-1">{wd.razorpay.failureReason}</p>}
                {wd.reviewNote && <p className="text-xs text-gray-500 mt-1 italic">{wd.reviewNote}</p>}
                {wd.status === 'pending' && (
                  <button onClick={() => cancelMutation.mutate(wd._id)} disabled={cancelMutation.isLoading}
                    className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium">Cancel request</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showWithdraw && (
        <WithdrawModal balance={wallet.balance || 0} onClose={() => setShowWithdraw(false)}
          onSuccess={() => { setShowWithdraw(false); qc.invalidateQueries({ queryKey: ['my-withdrawals'] }); qc.invalidateQueries({ queryKey: ['wallet'] }); setActiveTab('withdrawals'); }} />
      )}
    </Layout>
  );
}