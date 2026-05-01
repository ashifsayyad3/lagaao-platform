'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { User, MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useTokenStore } from '@/store/token-store';
import { createClientApi } from '@/lib/api';
import type { Address } from '@/types';

export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const token = useTokenStore((s) => s.token);
  const api = createClientApi(token ?? undefined);
  const qc = useQueryClient();

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: 'HOME',
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
  });

  const addAddressMutation = useMutation({
    mutationFn: () => api('/auth/addresses', { method: 'POST', body: JSON.stringify(addressForm) }),
    onSuccess: () => {
      toast.success('Address added');
      setShowAddressForm(false);
      qc.invalidateQueries({ queryKey: ['auth-profile'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="animate-pulse space-y-4 max-w-lg mx-auto">
          <div className="h-8 bg-forest-100 rounded w-40" />
          <div className="h-32 bg-forest-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <p className="text-gray-500">Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-forest-900 mb-6">My profile</h1>

      <div className="max-w-lg space-y-5">
        {/* User info */}
        <div className="rounded-2xl border border-forest-100 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2"><User className="h-4 w-4 text-forest-600" /> Account details</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">First name</p>
              <p className="font-medium text-gray-800">{user.firstName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Last name</p>
              <p className="font-medium text-gray-800">{user.lastName ?? '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-400 mb-0.5">Email</p>
              <p className="font-medium text-gray-800">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Role</p>
              <Badge variant="secondary" className="text-[10px]">{user.role}</Badge>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="rounded-2xl border border-forest-100 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2"><MapPin className="h-4 w-4 text-forest-600" /> Addresses</h2>
            <Button size="sm" variant="outline" onClick={() => setShowAddressForm((v) => !v)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>

          {user.addresses && user.addresses.length > 0 ? (
            <div className="space-y-3">
              {user.addresses.map((addr: Address) => (
                <div key={addr.id} className="rounded-xl border border-forest-100 p-3 text-sm text-gray-700 leading-relaxed">
                  <p className="font-medium text-forest-700 text-xs mb-1">{addr.label}</p>
                  <p>{addr.fullName} · {addr.phone}</p>
                  <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                  <p>{addr.city}, {addr.state} – {addr.pincode}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No saved addresses.</p>
          )}

          {showAddressForm && (
            <div className="border-t border-forest-100 pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Full name" value={addressForm.fullName} onChange={(e) => setAddressForm(f => ({ ...f, fullName: e.target.value }))} className="col-span-2 sm:col-span-1" />
                <Input placeholder="Phone" value={addressForm.phone} onChange={(e) => setAddressForm(f => ({ ...f, phone: e.target.value }))} className="col-span-2 sm:col-span-1" />
                <Input placeholder="Address line 1" value={addressForm.line1} onChange={(e) => setAddressForm(f => ({ ...f, line1: e.target.value }))} className="col-span-2" />
                <Input placeholder="Address line 2 (optional)" value={addressForm.line2} onChange={(e) => setAddressForm(f => ({ ...f, line2: e.target.value }))} className="col-span-2" />
                <Input placeholder="City" value={addressForm.city} onChange={(e) => setAddressForm(f => ({ ...f, city: e.target.value }))} />
                <Input placeholder="State" value={addressForm.state} onChange={(e) => setAddressForm(f => ({ ...f, state: e.target.value }))} />
                <Input placeholder="Pincode" value={addressForm.pincode} onChange={(e) => setAddressForm(f => ({ ...f, pincode: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={addAddressMutation.isPending} onClick={() => addAddressMutation.mutate()}>
                  Save address
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddressForm(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
