import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button, Card, Input, Label } from "@/components/ui/primitives";

export default function SettingsPage() {
  const { profile, session } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setFullName(profile?.full_name ?? ""); }, [profile?.full_name]);

  async function save() {
    setNotice(null); setError(null);
    const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", session!.user.id);
    if (error) setError("Could not save your profile.");
    else setNotice("Profile updated.");
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Your ACT account.</p>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile?.email ?? session?.user.email ?? ""} disabled />
          </div>
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Input id="role" value={profile?.role ?? "OPERATOR"} disabled />
          </div>
          {notice && <p className="text-sm text-green-700">{notice}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button onClick={save}>Save</Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">Trust & Verification</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
          <li>· All generated claims are traceable to source evidence.</li>
          <li>· Every artefact requires human approval before it is final.</li>
          <li>· The ACT Quality Score is an internal verification metric, not a probability.</li>
        </ul>
      </Card>
    </div>
  );
}
