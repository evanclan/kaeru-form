'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, Settings, BookOpen } from 'lucide-react';

export default function AdminDashboard() {
    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Chat Builder
                        </CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Manage Flows</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Create and edit chat flows
                        </p>
                        <Link href="/admin/chatbuilder" className="mt-4 block">
                            <Button className="w-full">
                                Open Builder
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                {/* Placeholders for other potential admin features */}
                <Card className="opacity-60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Users
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">User Management</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Coming soon
                        </p>
                        <Button disabled className="w-full mt-4" variant="secondary">
                            View Users
                        </Button>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Counseling
                        </CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Counseling Guides</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Manage decision trees
                        </p>
                        <Link href="/admin/counseling" className="mt-4 block">
                            <Button className="w-full" variant="outline">
                                Manage Topics
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Sessions
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">User List</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            View counseling records
                        </p>
                        <Link href="/admin/counseling-sessions" className="mt-4 block">
                            <Button className="w-full" variant="outline">
                                View Sessions
                            </Button>
                        </Link>
                    </CardContent>
                </Card>

                <Card className="opacity-60">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Settings
                        </CardTitle>
                        <Settings className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">System Settings</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Coming soon
                        </p>
                        <Button disabled className="w-full mt-4" variant="secondary">
                            Configure
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
