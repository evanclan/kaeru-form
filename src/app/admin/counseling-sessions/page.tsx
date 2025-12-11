'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Loader2, Trash2, Eye, Calendar, User, Phone, Mail } from 'lucide-react';
import { toast } from "sonner";
import Link from 'next/link';

interface Session {
    id: string;
    created_at: string;
    session_data: any[];
    memo: string;
    customer: {
        id: string;
        name: string;
        phone: string;
        email: string;
    };
}

export default function CounselingSessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('counseling_sessions')
            .select(`
                id,
                created_at,
                session_data,
                memo,
                customer:counseling_customers (id, name, phone, email)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching sessions:", error);
            toast.error("Failed to load sessions.");
        } else {
            console.log("Sessions data:", data);
            setSessions(data as any || []);
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row click
        if (!confirm("Are you sure you want to delete this session?")) return;

        const { error } = await supabase
            .from('counseling_sessions')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Error deleting session:", error);
            toast.error("Failed to delete session.");
        } else {
            toast.success("Session deleted.");
            setSessions(prev => prev.filter(s => s.id !== id));
            if (selectedSession?.id === id) {
                setIsSheetOpen(false);
                setSelectedSession(null);
            }
        }
    };

    const handleView = (session: Session) => {
        setSelectedSession(session);
        setIsSheetOpen(true);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Counseling User List</h1>
                <Link href="/admin">
                    <Button variant="outline">Back to Dashboard</Button>
                </Link>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
                </div>
            ) : sessions.length === 0 ? (
                <div className="text-center p-12 text-gray-500 border-2 border-dashed rounded-lg">
                    No counseling sessions found.
                </div>
            ) : (
                <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead className="hidden md:table-cell">Contact</TableHead>
                                <TableHead className="hidden md:table-cell">Memo Preview</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sessions.map((session) => (
                                <TableRow
                                    key={session.id}
                                    className="cursor-pointer hover:bg-gray-50"
                                    onClick={() => handleView(session)}
                                >
                                    <TableCell className="font-medium whitespace-nowrap text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Calendar size={14} />
                                            {new Date(session.created_at).toLocaleDateString()}
                                            <span className="text-xs text-gray-400">
                                                {new Date(session.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-semibold text-gray-900">{session.customer?.name || 'Unknown'}</div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <div className="space-y-1 text-sm text-gray-500">
                                            {session.customer?.phone && (
                                                <div className="flex items-center gap-2">
                                                    <Phone size={12} /> {session.customer.phone}
                                                </div>
                                            )}
                                            {session.customer?.email && (
                                                <div className="flex items-center gap-2">
                                                    <Mail size={12} /> {session.customer.email}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell max-w-xs truncate text-gray-500 italic">
                                        {session.memo || '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                onClick={(e) => { e.stopPropagation(); handleView(session); }}
                                            >
                                                <Eye size={16} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={(e) => handleDelete(session.id, e)}
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent side="right" className="sm:max-w-xl w-full overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <SheetTitle>Session Details</SheetTitle>
                        <SheetDescription>
                            Full details of the counseling session.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedSession && (
                        <div className="space-y-8">
                            {/* Customer Card */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-3">
                                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                    <User size={16} /> Customer Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <label className="text-gray-500 text-xs uppercase font-bold">Name</label>
                                        <div className="text-gray-900 font-medium">{selectedSession.customer?.name}</div>
                                    </div>
                                    <div>
                                        <label className="text-gray-500 text-xs uppercase font-bold">Date</label>
                                        <div className="text-gray-900">{new Date(selectedSession.created_at).toLocaleString()}</div>
                                    </div>
                                    {selectedSession.customer?.phone && (
                                        <div>
                                            <label className="text-gray-500 text-xs uppercase font-bold">Phone</label>
                                            <div className="text-gray-900">{selectedSession.customer.phone}</div>
                                        </div>
                                    )}
                                    {selectedSession.customer?.email && (
                                        <div>
                                            <label className="text-gray-500 text-xs uppercase font-bold">Email</label>
                                            <div className="text-gray-900 break-all">{selectedSession.customer.email}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Memo Section */}
                            {selectedSession.memo && (
                                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                                    <h3 className="font-semibold text-yellow-800 mb-2 text-sm uppercase">Counselor Memo</h3>
                                    <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                                        {selectedSession.memo}
                                    </p>
                                </div>
                            )}

                            {/* Session Timeline */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Calendar size={16} /> Session History
                                </h3>
                                <div className="space-y-0 relative border-l-2 border-slate-200 ml-3 pl-6 pb-2">
                                    {(selectedSession.session_data || []).map((item: any, index: number) => (
                                        <div key={index} className="mb-6 last:mb-0 relative">
                                            {/* Dot on timeline */}
                                            <div className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 ${item.type === 'topic' ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'
                                                }`} />

                                            <div className={`font-medium ${item.type === 'topic' ? 'text-lg text-blue-700' : 'text-md text-gray-700'
                                                }`}>
                                                {item.label}
                                            </div>
                                            {item.type === 'topic' && (
                                                <div className="text-xs text-blue-400 mt-1 uppercase font-bold tracking-wider">
                                                    New Topic
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 border-t flex justify-end">
                                <Button
                                    variant="destructive"
                                    onClick={(e) => handleDelete(selectedSession.id, e)}
                                >
                                    <Trash2 size={16} className="mr-2" />
                                    Delete Record
                                </Button>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
