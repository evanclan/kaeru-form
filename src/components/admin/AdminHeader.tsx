'use client';

import { logout } from '@/app/admin/auth/actions';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';
import { cn } from '@/lib/utils';

export default function AdminHeader() {
    const pathname = usePathname();
    const isCounselingPage = pathname === '/admin/counseling';

    return (
        <header className={cn(
            "bg-white border-b px-8 py-4 flex items-center justify-between sticky top-0 z-10",
            isCounselingPage && "hidden lg:flex"
        )}>
            <Link href="/admin" className="font-semibold text-xl hover:opacity-80 transition-opacity">Kaeru Support</Link>
            <form action={logout}>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                </Button>
            </form>
        </header>
    );
}
