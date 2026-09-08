import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createProject, deleteProject, listProjects, renameProject } from "@/services/api";
import { Button, Card, EmptyState, ErrorState, Input, Label, Modal, Spinner, Textarea } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string; description: string } | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["projects"] });

  const create = useMutation({
    mutationFn: (input: { name: string; description: string }) => createProject(input.name, input.description),
    onSuccess: () => { invalidate(); setCreating(false); },
  });
  const rename = useMutation({
    mutationFn: (input: { id: string; name: string; description: string }) =>
      renameProject(input.id, input.name, input.description),
    onSuccess: () => { invalidate(); setRenaming(null); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: invalidate,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Projects</h1>
          <p className="mt-0.5 text-sm text-gray-500">Transformation workspaces for your sources.</p>
        </div>
        <Button onClick={() => setCreating(true)}>Create Project</Button>
      </div>

      {(data ?? []).length === 0 ? (
        <EmptyState
          title="No projects yet."
          description="Create your first transformation workspace."
          action={<Button onClick={() => setCreating(true)}>Create Project</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((p) => (
            <Card key={p.id} className="flex flex-col p-4">
              <Link to={`/projects/${p.id}`} className="text-sm font-semibold text-gray-900 hover:text-blue-700">
                {p.name}
              </Link>
              <p className="mt-1 line-clamp-2 min-h-[2rem] text-xs text-gray-500">{p.description || "No description"}</p>
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <span>{p.documents[0]?.count ?? 0} sources</span>
                <span>{p.transformations[0]?.count ?? 0} transformations</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-400">{formatDate(p.updated_at)}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" className="px-2 py-1 text-xs"
                    onClick={() => setRenaming({ id: p.id, name: p.name, description: p.description ?? "" })}>
                    Rename
                  </Button>
                  <Button variant="danger" className="px-2 py-1 text-xs"
                    onClick={() => { if (confirm(`Delete project "${p.name}" and all its data?`)) remove.mutate(p.id); }}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="Create Project" onClose={() => setCreating(false)}>
          <NameDescriptionForm
            busy={create.isPending}
            error={create.error ? (create.error as Error).message : null}
            onSubmit={(name, description) => create.mutate({ name, description })}
          />
        </Modal>
      )}
      {renaming && (
        <Modal title="Rename Project" onClose={() => setRenaming(null)}>
          <NameDescriptionForm
            initialName={renaming.name} initialDescription={renaming.description}
            busy={rename.isPending}
            error={rename.error ? (rename.error as Error).message : null}
            onSubmit={(name, description) => rename.mutate({ ...renaming, name, description })}
          />
        </Modal>
      )}
    </div>
  );
}

function NameDescriptionForm({
  initialName = "", initialDescription = "", busy, error, onSubmit,
}: {
  initialName?: string; initialDescription?: string; busy: boolean;
  error: string | null; onSubmit: (name: string, description: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  function handle(e: FormEvent) {
    e.preventDefault();
    if (name.trim()) onSubmit(name.trim(), description.trim());
  }
  return (
    <form onSubmit={handle} className="space-y-4">
      <div>
        <Label htmlFor="project-name">Name</Label>
        <Input id="project-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="project-description">Description</Label>
        <Textarea id="project-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
    </form>
  );
}
