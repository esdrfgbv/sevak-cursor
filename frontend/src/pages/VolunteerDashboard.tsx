import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  MapPin, Star, CheckCircle2, Clock, Navigation, ThumbsUp, ThumbsDown,
  AlertTriangle, LogOut, Loader2, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { volunteersApi, assignmentsApi, type User, type Assignment } from '@/lib/api';

export default function VolunteerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [volunteer, setVolunteer] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchData = async () => {
    if (!user?.id) return;
    try {
      const [volData, assignData] = await Promise.all([
        volunteersApi.get(user.id).catch(() => null),
        volunteersApi.getAssignments(user.id).catch(() => []),
      ]);
      if (volData) setVolunteer(volData);
      setAssignments(assignData);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleAccept = async (assignmentId: number) => {
    try {
      await assignmentsApi.accept(assignmentId);
      toast.success('✅ Accepted!');
      fetchData();
      setShowDetail(false);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleDecline = async (assignmentId: number) => {
    try {
      await assignmentsApi.decline(assignmentId);
      toast.info('Declined');
      fetchData();
      setShowDetail(false);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleStatusUpdate = async (assignmentId: number, status: string) => {
    try {
      await assignmentsApi.updateStatus(assignmentId, status);
      toast.success(`Status: ${status}`);
      fetchData();
      setShowDetail(false);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleComplete = async (assignmentId: number) => {
    try {
      await assignmentsApi.complete(assignmentId);
      toast.success('🎉 Task completed!');
      fetchData();
      setShowDetail(false);
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed'); }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; emoji: string }> = {
      pending_acceptance: { color: 'bg-yellow-500', emoji: '⏳' },
      accepted: { color: 'bg-blue-500', emoji: '✓' },
      declined: { color: 'bg-gray-500', emoji: '✕' },
      en_route: { color: 'bg-orange-500', emoji: '🚗' },
      on_task: { color: 'bg-purple-500', emoji: '⚙️' },
      completed: { color: 'bg-green-500', emoji: '✓' },
    };
    const config = configs[status] || { color: 'bg-gray-500', emoji: '?' };
    return <Badge className={cn(config.color, 'text-white text-[10px]')}>{config.emoji} {status.replace(/_/g, ' ')}</Badge>;
  };

  const activeAssignments = assignments.filter(a => !['completed', 'declined'].includes(a.status));
  const completedAssignments = assignments.filter(a => a.status === 'completed');
  const pendingAcceptance = assignments.filter(a => a.status === 'pending_acceptance');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const initials = (volunteer?.name || user?.name || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Clean & Minimal */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-semibold text-lg">{volunteer?.name || user?.name}</h1>
              <p className="text-xs text-muted-foreground">{completedAssignments.length} tasks completed</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="font-semibold">{(volunteer?.rating || 0).toFixed(1)}</span>
              </div>
              <Badge variant={volunteer?.availability ? 'default' : 'secondary'} className="text-[10px] mt-1">
                {volunteer?.availability ? '🟢 Available' : '🔴 Busy'}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      {/* Pending Alert */}
      {pendingAcceptance.length > 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-800">
              {pendingAcceptance.length} task(s) need your response
            </span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tasks">Active ({activeAssignments.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedAssignments.length})</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          {/* ── ACTIVE TASKS ── */}
          <TabsContent value="tasks" className="space-y-3">
            {activeAssignments.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No active assignments</p>
                </CardContent>
              </Card>
            ) : (
              activeAssignments.map(assignment => (
                <Card key={assignment.id} className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
                  onClick={() => { setSelectedAssignment(assignment); setShowDetail(true); }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(assignment.status)}
                          <span className="text-xs text-muted-foreground font-mono">#{assignment.id}</span>
                        </div>
                        <h3 className="font-semibold text-sm line-clamp-2">Task #{assignment.request_id}: {assignment.reason?.split('\n')[0]}</h3>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span><Clock className="w-3 h-3 inline mr-1" />{new Date(assignment.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-2xl font-bold text-primary">{(assignment.score * 100).toFixed(0)}%</div>
                        <div className="text-[10px] text-muted-foreground">match</div>
                      </div>
                    </div>

                    {/* Quick Actions for pending acceptance */}
                    {assignment.status === 'pending_acceptance' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t" onClick={e => e.stopPropagation()}>
                        <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleAccept(assignment.id)}>
                          <ThumbsUp className="h-3 w-3 mr-1" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDecline(assignment.id)}>
                          <ThumbsDown className="h-3 w-3 mr-1" /> Decline
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ── COMPLETED ── */}
          <TabsContent value="completed" className="space-y-3">
            {completedAssignments.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No completed tasks yet</CardContent></Card>
            ) : (
              completedAssignments.map(assignment => (
                <Card key={assignment.id} className="opacity-75">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(assignment.status)}
                          <span className="text-xs text-muted-foreground font-mono">#{assignment.id}</span>
                        </div>
                        <h3 className="font-medium text-sm line-clamp-1">Task #{assignment.request_id}</h3>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="text-lg font-bold text-success">{(assignment.score * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ── PROFILE ── */}
          <TabsContent value="profile">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold mb-1">{completedAssignments.length}</div>
                  <div className="text-xs text-muted-foreground">Tasks Completed</div>
                  <Progress value={Math.min(completedAssignments.length * 5, 100)} className="mt-3" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{(volunteer?.rating || 0).toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Rating</div>
                  <Progress value={(volunteer?.rating || 0) * 20} className="mt-3" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl mb-2">{volunteer?.availability ? '🟢' : '🔴'}</div>
                  <div className="text-3xl font-bold mb-1 capitalize">{volunteer?.status || '—'}</div>
                  <div className="text-xs text-muted-foreground">{volunteer?.availability ? 'Available' : 'Busy'}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium text-sm">{volunteer?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium text-sm">{volunteer?.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium text-sm">{volunteer?.lat?.toFixed(2)}, {volunteer?.lng?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Workload</p>
                    <p className="font-medium text-sm">{volunteer?.workload || 0} active</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {volunteer?.skills?.map(skill => (
                      <Badge key={skill.id} variant="secondary" className="text-xs">{skill.name}</Badge>
                    ))}
                    {(!volunteer?.skills || volunteer.skills.length === 0) && (
                      <span className="text-xs text-muted-foreground">No skills</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Detail Modal */}
      {selectedAssignment && (
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Task #{selectedAssignment.request_id}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-2">
                {getStatusBadge(selectedAssignment.status)}
                <span className="text-xs font-mono">#{selectedAssignment.id}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Details</p>
                <p className="text-sm">{selectedAssignment.reason}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Match Score</p>
                <div className="flex items-center gap-2">
                  <Progress value={selectedAssignment.score * 100} className="flex-1" />
                  <span className="text-sm font-semibold">{(selectedAssignment.score * 100).toFixed(0)}%</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Created: {new Date(selectedAssignment.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              {selectedAssignment.status === 'pending_acceptance' && (
                <>
                  <Button onClick={() => handleAccept(selectedAssignment.id)} className="flex-1 bg-green-600 hover:bg-green-700">
                    Accept
                  </Button>
                  <Button onClick={() => handleDecline(selectedAssignment.id)} variant="outline" className="flex-1">
                    Decline
                  </Button>
                </>
              )}
              {selectedAssignment.status === 'accepted' && (
                <Button onClick={() => handleStatusUpdate(selectedAssignment.id, 'on_task')} className="w-full">
                  Mark as On-Task
                </Button>
              )}
              {selectedAssignment.status === 'on_task' && (
                <Button onClick={() => handleComplete(selectedAssignment.id)} className="w-full bg-green-600 hover:bg-green-700">
                  Mark Complete
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
