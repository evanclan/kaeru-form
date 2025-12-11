import { logout } from './auth/actions'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import React from 'react'

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-gray-50/50">
            <header className="bg-white border-b px-8 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="font-semibold text-xl">Admin Dashboard</div>
                <form action={logout}>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                    </Button>
                </form>
            </header>
            <main>
                {children}
            </main>
        </div>
    )
}
