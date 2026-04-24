import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Users, ClipboardList, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const roles = [
  {
    id: "admin",
    label: "Admin / Coordinator",
    icon: ShieldAlert,
    description: "Full system access. Manage tasks, volunteers, and analytics.",
    color: "border-primary bg-primary/5",
    path: "/",
  },
  {
    id: "requester",
    label: "Requester",
    icon: ClipboardList,
    description: "Create emergency tasks. Track progress and resolve incidents.",
    color: "border-orange-500 bg-orange-500/5",
    path: "/request",
  },
  {
    id: "volunteer",
    label: "Volunteer",
    icon: Users,
    description: "Accept and complete assigned tasks. Update status in real-time.",
    color: "border-green-500 bg-green-500/5",
    path: "/volunteer",
  },
];

const skillOptions = [
  "Medical", "Search and Rescue", "Swift Water Rescue", "Logistics",
  "Electrical", "Firefighting", "Paramedic", "Structural Rescue",
  "First Aid", "CPR", "Crowd Control", "Food Distribution",
  "Counseling", "Driving", "Communications", "Shelter Management",
];

export default function Login() {
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleLogin = async () => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!selectedRole) {
      toast.error("Please select a role");
      return;
    }

    setIsLoading(true);
    try {
      await login(name.trim(), selectedRole, selectedRole === "volunteer" ? selectedSkills : []);
      const role = roles.find((r) => r.id === selectedRole);
      toast.success(`Welcome, ${name}!`);
      navigate(role?.path || "/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Quick login presets for demo
  const quickLogin = async (preset: { name: string; role: string }) => {
    setIsLoading(true);
    try {
      await login(preset.name, preset.role, []);
      const role = roles.find((r) => r.id === preset.role);
      toast.success(`Welcome, ${preset.name}!`);
      navigate(role?.path || "/");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <ShieldAlert className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">SEVAK</h1>
          <p className="text-muted-foreground mt-1">Smart Resource Allocation Platform</p>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your name and select your role to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                placeholder="Enter your name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && selectedRole && handleLogin()}
              />
            </div>

            <div>
              <Label>Select Role</Label>
              <div className="grid gap-3 mt-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all",
                      selectedRole === role.id ? role.color : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <role.icon className={cn(
                      "h-5 w-5 mt-0.5 shrink-0",
                      selectedRole === role.id ? "text-foreground" : "text-muted-foreground"
                    )} />
                    <div>
                      <div className="font-medium text-sm">{role.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedRole === "volunteer" && (
              <div>
                <Label>Your Skills (optional)</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {skillOptions.map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs transition-colors",
                        selectedSkills.includes(skill)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      )}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              className="w-full h-11"
              onClick={handleLogin}
              disabled={isLoading || !name.trim() || !selectedRole}
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</>
              ) : (
                "Sign In"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Demo Access */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quick Demo Access</CardTitle>
            <CardDescription className="text-xs">Use preset accounts for testing</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => quickLogin({ name: "Command Admin", role: "admin" })} disabled={isLoading}>
              <ShieldAlert className="h-3.5 w-3.5 mr-1.5" /> Admin
            </Button>
            <Button size="sm" variant="outline" onClick={() => quickLogin({ name: "Field Officer", role: "requester" })} disabled={isLoading}>
              <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> Requester
            </Button>
            <Button size="sm" variant="outline" onClick={() => quickLogin({ name: "NGO Coordinator", role: "requester" })} disabled={isLoading}>
              <ClipboardList className="h-3.5 w-3.5 mr-1.5" /> NGO Requester
            </Button>
            {[1, 2, 3].map((i) => (
              <Button
                key={i}
                size="sm"
                variant="outline"
                onClick={() => quickLogin({ name: `Volunteer ${i}`, role: "volunteer" })}
                disabled={isLoading}
              >
                <Users className="h-3.5 w-3.5 mr-1.5" /> Volunteer {i}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
