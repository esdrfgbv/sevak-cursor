import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, Upload, MapPin, Phone, User, AlertTriangle, CheckCircle2,
  Camera, X, ShieldAlert, Heart, LogOut, Clock, LocateFixed, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { tasksApi, type Task, type TaskCreateResponse, type MatchResult } from '@/lib/api';
import { getBrowserLocation } from '@/services/location';
import { assignmentLabel, matchTags, priorityReason, resultLabel } from '@/lib/decision-labels';

const skillOptions = [
  'Medical', 'Search and Rescue', 'Swift Water Rescue', 'Logistics',
  'Firefighting', 'Paramedic', 'Structural Rescue', 'First Aid',
  'CPR', 'Crowd Control', 'Food Distribution', 'Counseling',
  'Driving', 'Communications', 'Shelter Management', 'Electrical',
];

export default function RequesterDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('create');

  // Form state
  const [mode, setMode] = useState<'DISASTER' | 'NGO'>('DISASTER');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [incidentType, setIncidentType] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [taskLat, setTaskLat] = useState(user?.lat ?? 17.3850);
  const [taskLng, setTaskLng] = useState(user?.lng ?? 78.4867);
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [lastResult, setLastResult] = useState<TaskCreateResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // My tasks
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const fetchMyTasks = async () => {
    setLoadingTasks(true);
    try {
      const all = await tasksApi.list();
      setMyTasks(all.filter(t => t.requester_id === user?.id));
    } catch { /* ignore */ } finally { setLoadingTasks(false); }
  };

  useEffect(() => {
    fetchMyTasks();
    const interval = setInterval(fetchMyTasks, 10000);
    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    setTaskLat(user?.lat ?? 17.3850);
    setTaskLng(user?.lng ?? 78.4867);
  }, [user?.lat, user?.lng]);

  const toggleSkill = (skill: string) => {
    setRequiredSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image size should be less than 5MB'); return; }
    const reader = new FileReader();
    reader.onload = (e) => { setImage(e.target?.result as string); };
    reader.readAsDataURL(file);
  }, []);

  const removeImage = () => {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fetchCurrentLocation = async () => {
    setIsFetchingLocation(true);
    try {
      const location = await getBrowserLocation();
      setTaskLat(Number(location.lat.toFixed(6)));
      setTaskLng(Number(location.lng.toFixed(6)));
      toast.success('Current location added');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unable to fetch current location');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !incidentType) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (mode === 'DISASTER' && !image) {
      toast.error('DISASTER mode requires an image for verification');
      return;
    }
    if (!Number.isFinite(taskLat) || !Number.isFinite(taskLng)) {
      toast.error('Please enter valid latitude and longitude');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await tasksApi.create({
        requester_id: user?.id,
        incident_type: incidentType,
        title,
        description,
        required_skills: requiredSkills,
        people_count: peopleCount,
        lat: taskLat,
        lng: taskLng,
        mode,
        image_data: image,
      });
      setLastResult(result);

      if (mode === 'DISASTER') {
        toast.success(`Task created! ${result.assigned_count} volunteer(s) auto-assigned.`);
      } else {
        const matchCount = result.match_results?.top_volunteers?.length || 0;
        toast.success(`Task created! ${matchCount} volunteer(s) matched. Waiting for acceptance.`);
      }

      // Reset form
      setTitle('');
      setDescription('');
      setIncidentType('');
      setPeopleCount(1);
      setRequiredSkills([]);
      setImage(null);
      setActiveTab('result');
      fetchMyTasks();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (taskId: number) => {
    try {
      await tasksApi.update(taskId, { status: 'completed' });
      toast.success('Task resolved!');
      fetchMyTasks();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve task');
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold">SEVAK</div>
              <div className="text-xs text-muted-foreground">Requester: {user?.name}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4 mr-1" /> Logout</Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="create">Create Task</TabsTrigger>
            <TabsTrigger value="mytasks">My Tasks ({myTasks.length})</TabsTrigger>
            <TabsTrigger value="result">Last Result</TabsTrigger>
          </TabsList>

          {/* ── CREATE TAB ── */}
          <TabsContent value="create" className="mt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* MODE SELECTOR */}
              <Card>
                <CardHeader>
                  <CardTitle>Task Mode</CardTitle>
                  <CardDescription>Select the mode for this task</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <button type="button" onClick={() => setMode('DISASTER')}
                      className={cn("p-4 rounded-lg border-2 text-left transition-all",
                        mode === 'DISASTER' ? "border-red-500 bg-red-500/5" : "border-border hover:border-red-300")}>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <span className="font-semibold text-red-600">DISASTER</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Urgent automation. Image verification required. Volunteers auto-assigned.
                      </p>
                    </button>
                    <button type="button" onClick={() => setMode('NGO')}
                      className={cn("p-4 rounded-lg border-2 text-left transition-all",
                        mode === 'NGO' ? "border-green-500 bg-green-500/5" : "border-border hover:border-green-300")}>
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="h-5 w-5 text-green-500" />
                        <span className="font-semibold text-green-600">NGO</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Manual coordination. No image needed. Volunteers accept/decline.
                      </p>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* IMAGE (DISASTER only) */}
              {mode === 'DISASTER' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Camera className="w-5 h-5" /> Situation Photo <Badge variant="destructive" className="text-[10px]">Required</Badge></CardTitle>
                    <CardDescription>Upload a clear photo for verification</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!image ? (
                      <div onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                        <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Click to upload (PNG, JPG up to 5MB)</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <img src={image} alt="Uploaded" className="w-full h-48 object-cover rounded-lg" />
                        <button type="button" onClick={removeImage} className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </CardContent>
                </Card>
              )}

              {/* DETAILS */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Task Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Incident Type *</Label>
                    <Input placeholder="e.g., Medical Emergency, Flood Rescue" value={incidentType} onChange={e => setIncidentType(e.target.value)} required />
                  </div>
                  <div>
                    <Label>Title *</Label>
                    <Input placeholder="Brief task title..." value={title} onChange={e => setTitle(e.target.value)} required />
                  </div>
                  <div>
                    <Label>Description *</Label>
                    <Textarea placeholder="Describe the situation..." value={description} onChange={e => setDescription(e.target.value)} rows={3} required />
                  </div>
                  <div>
                    <Label>People Affected</Label>
                    <Input type="number" min={1} max={1000} value={peopleCount} onChange={e => setPeopleCount(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> Location Details
                      </Label>
                      <Button type="button" variant="outline" size="sm" onClick={fetchCurrentLocation} disabled={isFetchingLocation}>
                        {isFetchingLocation ? (
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        ) : (
                          <LocateFixed className="h-4 w-4 mr-1.5" />
                        )}
                        Current Location
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Latitude *</Label>
                        <Input
                          type="number"
                          step="any"
                          min={-90}
                          max={90}
                          placeholder="e.g., 17.3850"
                          value={Number.isFinite(taskLat) ? taskLat : ''}
                          onChange={e => setTaskLat(e.target.value === '' ? NaN : Number(e.target.value))}
                          required
                        />
                      </div>
                      <div>
                        <Label>Longitude *</Label>
                        <Input
                          type="number"
                          step="any"
                          min={-180}
                          max={180}
                          placeholder="e.g., 78.4867"
                          value={Number.isFinite(taskLng) ? taskLng : ''}
                          onChange={e => setTaskLng(e.target.value === '' ? NaN : Number(e.target.value))}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Required Skills</Label>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {skillOptions.map(skill => (
                        <button key={skill} type="button" onClick={() => toggleSkill(skill)}
                          className={cn("px-2.5 py-1 rounded-full text-xs transition-colors",
                            requiredSkills.includes(skill) ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground")}>
                          {skill}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" className="w-full h-12 text-lg" disabled={isSubmitting}>
                {isSubmitting ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Creating...</>) : (
                  mode === 'DISASTER' ? 'Create DISASTER Task (Auto-Assign)' : 'Create NGO Task (Manual Match)'
                )}
              </Button>
            </form>
          </TabsContent>

          {/* ── MY TASKS TAB ── */}
          <TabsContent value="mytasks" className="mt-6 space-y-4">
            {loadingTasks && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}
            {!loadingTasks && myTasks.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No tasks created yet</CardContent></Card>
            )}
            {myTasks.map(task => (
              <Card key={task.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn(task.mode === 'DISASTER' ? 'bg-red-500' : 'bg-green-500', 'text-white text-[10px]')}>{task.mode}</Badge>
                        <Badge variant="outline">{task.priority_level}</Badge>
                        <Badge variant="secondary">{task.status}</Badge>
                      </div>
                      <h3 className="font-semibold">{task.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{task.incident_type}</span>
                        <span>{task.assignments.length} assigned</span>
                        <span>{priorityReason(task)}</span>
                      </div>
                      {task.assignments.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {task.assignments.map(a => (
                            <div key={a.id} className="flex items-center gap-2 text-xs">
                              <span className="font-medium">{a.volunteer?.name || `Vol #${a.volunteer_id}`}</span>
                              <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                              <span className="text-muted-foreground truncate">{a.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {task.status !== 'completed' && (
                      <Button size="sm" variant="outline" onClick={() => handleResolve(task.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── RESULT TAB ── */}
          <TabsContent value="result" className="mt-6">
            {!lastResult ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No task created yet. Create one first.</CardContent></Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" /> Task Created
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className={cn(lastResult.request.mode === 'DISASTER' ? 'bg-red-500' : 'bg-green-500', 'text-white')}>{lastResult.request.mode}</Badge>
                      <Badge variant="outline">{lastResult.request.priority_level}</Badge>
                    </div>
                    <h3 className="font-semibold text-lg">{lastResult.request.title}</h3>
                    <p className="text-sm text-muted-foreground">{lastResult.request.description}</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><span className="text-muted-foreground">Assigned:</span> <strong>{lastResult.assigned_count}</strong></div>
                      <div><span className="text-muted-foreground">Priority:</span> <strong>{lastResult.request.priority_level}</strong></div>
                      <div><span className="text-muted-foreground">Duplicate:</span> <strong>{lastResult.duplicate_detected ? 'Yes' : 'No'}</strong></div>
                    </div>
                    <Alert className="border-amber-500/30 bg-amber-500/5">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Priority Reason</AlertTitle>
                      <AlertDescription>{priorityReason(lastResult.request)}</AlertDescription>
                    </Alert>
                    {lastResult.request.ai_insight && (
                      <Alert className="border-primary/40 bg-primary/10 shadow-sm">
                        <Sparkles className="h-4 w-4" />
                        <AlertTitle>AI Decision Insight</AlertTitle>
                        <AlertDescription>{lastResult.request.ai_insight}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Verification result (DISASTER) */}
                {lastResult.verification && lastResult.request.mode === 'DISASTER' && (
                  <Card>
                    <CardHeader><CardTitle>Image Verification</CardTitle></CardHeader>
                    <CardContent>
                      <Alert className={cn(lastResult.verification.is_disaster ? "border-green-500" : "border-yellow-500")}>
                        <AlertTitle>{lastResult.verification.is_disaster ? 'Verified' : 'Needs Review'}</AlertTitle>
                        <AlertDescription>
                          <p>{lastResult.verification.reason}</p>
                          {lastResult.verification.confidence != null && (
                            <p className="text-xs mt-1">Confidence: {(lastResult.verification.confidence * 100).toFixed(0)}%</p>
                          )}
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>
                )}

                {/* NGO match results */}
                {lastResult.match_results && lastResult.match_results.top_volunteers.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Matched Volunteers (Pending Acceptance)</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {lastResult.match_results.top_volunteers.map((m, i) => (
                        <div key={m.volunteer.id} className={cn("p-3 rounded-lg border", i === 0 ? "border-primary/30 bg-primary/5" : "border-border")}>
                          <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{m.volunteer.name}</span>
                            {i === 0 && <Badge className="ml-2 text-[10px]">Top Match</Badge>}
                          </div>
                            <Badge variant="secondary" className="text-[10px]">{resultLabel(m)}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{m.justification}</p>
                          <div className="flex gap-1 mt-2">
                            {matchTags(m.score, m.justification).map(tag => (
                              <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                            ))}
                            {m.volunteer.skills.slice(0, 4).map(s => (
                              <Badge key={s.id} variant="outline" className="text-[10px]">{s.name}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Auto-assigned volunteers (DISASTER) */}
                {lastResult.suggested_volunteers.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Auto-Assigned Volunteers</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {lastResult.suggested_volunteers.map(a => (
                        <div key={a.id} className="flex items-center justify-between p-2 rounded border">
                          <div>
                            <span className="font-medium text-sm">{a.volunteer?.name || `Vol #${a.volunteer_id}`}</span>
                            <p className="text-xs text-muted-foreground">{a.reason}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary" className="text-[10px]">{assignmentLabel(a)}</Badge>
                            <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Button onClick={() => setActiveTab('create')} className="w-full">Create Another Task</Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
