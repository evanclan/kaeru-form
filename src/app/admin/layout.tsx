import AdminHeader from '@/components/admin/AdminHeader';
import React from 'react';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-50/50">
            <AdminHeader />
            <main>
                {children}
            </main>
        </div>
    )
}
